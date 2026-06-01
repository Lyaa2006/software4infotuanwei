require('dotenv').config();
const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool, types } = require("pg");


const PORT = Number(process.env.PORT || 3001);
const TOKEN_SECRET = String(process.env.TOKEN_SECRET || "dev-secret-change-me");
const TOKEN_EXPIRES_MS = Number(process.env.TOKEN_EXPIRES_MS || 7 * 24 * 60 * 60 * 1000);
const TRANSCRIPT_PATH_PLACEHOLDER = "-";

const DB_HOST = String(process.env.DB_HOST || "127.0.0.1");
const DB_PORT = Number(process.env.DB_PORT || 54321);
const DB_USER = String(process.env.DB_USER || "system");
const DB_PASSWORD = String(process.env.DB_PASSWORD || "123456");
const DB_NAME = String(process.env.DB_NAME || "student_service_platform");

const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value) => String(value ?? ""));

const PARTY_STAGES = [
  { value: "group_assessment", label: "党课学习小组学习", status: "党课学习小组学习中" },
  { value: "activist", label: "入党积极分子", status: "入党积极分子培养中" },
  { value: "dev_object", label: "发展对象（通过院党校推优）", status: "校党校学习中" },
  { value: "probationary", label: "预备党员", status: "预备党员培养中" },
  { value: "probationary_full_year", label: "预备期满一年", status: "预备期满一年" },
  { value: "full_member", label: "正式入党", status: "已正式入党" },
];

function ok(res, data) {
  res.json({ success: true, data });
}

function fail(res, code, message, status = 400) {
  res.status(status).json({ success: false, code, message });
}

function failExtra(res, code, message, status = 400, extra) {
  const safeExtra = extra && typeof extra === "object" ? extra : {};
  res.status(status).json({ success: false, code, message, ...safeExtra });
}

function buildPgDebug(err) {
  const out = {};
  const code = String(err?.code || "").trim();
  if (code) out.code = code;
  const column = String(err?.column || "").trim();
  if (column) out.column = column;
  const constraint = String(err?.constraint || "").trim();
  if (constraint) out.constraint = constraint;
  const detail = String(err?.detail || "").trim();
  if (detail) out.detail = detail;
  const table = String(err?.table || "").trim();
  if (table) out.table = table;
  const schema = String(err?.schema || "").trim();
  if (schema) out.schema = schema;
  const routine = String(err?.routine || "").trim();
  if (routine) out.routine = routine;
  return out;
}

async function ensureSchema(pool) {
  const schemaPath = path.join(__dirname, "schema.sql");
  if (!fs.existsSync(schemaPath)) return;
  const raw = fs.readFileSync(schemaPath, "utf8");
  const statements = raw
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }

  await ensurePartyStudentsSchema(pool);
  await ensureActivitySchema(pool);
  await ensureAcademicSchema(pool);
}

async function ensurePartyStudentsSchema(pool) {
  const resp = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='party_students'",
  );
  const existing = new Set((resp.rows || []).map((r) => String(r.column_name || "")));
  if (!existing.size) return;

  const additions = [
    { name: "name", ddl: "ALTER TABLE party_students ADD COLUMN name VARCHAR(64) NOT NULL DEFAULT ''" },
    { name: "tags", ddl: "ALTER TABLE party_students ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb" },
    { name: "application_date", ddl: "ALTER TABLE party_students ADD COLUMN application_date DATE NULL" },
    { name: "activist_date", ddl: "ALTER TABLE party_students ADD COLUMN activist_date DATE NULL" },
    { name: "dev_object_date", ddl: "ALTER TABLE party_students ADD COLUMN dev_object_date DATE NULL" },
    { name: "probationary_date", ddl: "ALTER TABLE party_students ADD COLUMN probationary_date DATE NULL" },
    {
      name: "probationary_full_year_date",
      ddl: "ALTER TABLE party_students ADD COLUMN probationary_full_year_date DATE NULL",
    },
    { name: "full_member_date", ddl: "ALTER TABLE party_students ADD COLUMN full_member_date DATE NULL" },
    {
      name: "current_stage",
      ddl: "ALTER TABLE party_students ADD COLUMN current_stage VARCHAR(32) NOT NULL DEFAULT 'group_assessment'",
    },
    { name: "current_status", ddl: "ALTER TABLE party_students ADD COLUMN current_status VARCHAR(128) NOT NULL DEFAULT ''" },
    { name: "next_report_due", ddl: "ALTER TABLE party_students ADD COLUMN next_report_due DATE NULL" },
    { name: "next_talk_due", ddl: "ALTER TABLE party_students ADD COLUMN next_talk_due DATE NULL" },
    { name: "created_at", ddl: "ALTER TABLE party_students ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0" },
    { name: "updated_at", ddl: "ALTER TABLE party_students ADD COLUMN updated_at BIGINT NOT NULL DEFAULT 0" },
  ];

  for (const add of additions) {
    if (existing.has(add.name)) continue;
    await pool.query(add.ddl);
  }
}

async function ensureActivitySchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS class_activity_reviews (
    activity_id BIGINT PRIMARY KEY,
    reviewed_by VARCHAR(64) NOT NULL DEFAULT '',
    reviewed_at BIGINT NOT NULL DEFAULT 0
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS class_activity_rejections (
    activity_id BIGINT PRIMARY KEY,
    reason VARCHAR(256) NOT NULL DEFAULT ''
  )`);

  try {
    const resp = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activity_reviews'",
    );
    const cols = new Set((resp.rows || []).map((r) => String(r.column_name || "")));
    if (cols.has("review_by") && !cols.has("reviewed_by")) {
      await pool.query("ALTER TABLE class_activity_reviews RENAME COLUMN review_by TO reviewed_by");
    }
    if (cols.has("review_at") && !cols.has("reviewed_at")) {
      await pool.query("ALTER TABLE class_activity_reviews RENAME COLUMN review_at TO reviewed_at");
    }
  } catch {}

  try {
    const resp = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activity_rejections'",
    );
    const cols = new Set((resp.rows || []).map((r) => String(r.column_name || "")));
    if (cols.has("reject_reason") && !cols.has("reason")) {
      await pool.query("ALTER TABLE class_activity_rejections RENAME COLUMN reject_reason TO reason");
    }
  } catch {}

  const resp = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activities'",
  );
  const existing = new Set((resp.rows || []).map((r) => String(r.column_name || "")));
  if (!existing.size) return;

  if (existing.has("reject_reason")) {
    try {
      await pool.query("ALTER TABLE class_activities DROP COLUMN reject_reason");
    } catch {
      await pool.query("UPDATE class_activities SET reject_reason='' WHERE reject_reason IS NULL");
      await pool.query("ALTER TABLE class_activities ALTER COLUMN reject_reason SET DEFAULT ''");
    }
  }

  if (existing.has("reviewed_by")) {
    try {
      await pool.query("ALTER TABLE class_activities DROP COLUMN reviewed_by");
    } catch {
      await pool.query("UPDATE class_activities SET reviewed_by='' WHERE reviewed_by IS NULL");
      await pool.query("ALTER TABLE class_activities ALTER COLUMN reviewed_by SET DEFAULT ''");
    }
  }

  if (existing.has("reviewed_at")) {
    try {
      await pool.query("ALTER TABLE class_activities DROP COLUMN reviewed_at");
    } catch {
      await pool.query("UPDATE class_activities SET reviewed_at=0 WHERE reviewed_at IS NULL");
      await pool.query("ALTER TABLE class_activities ALTER COLUMN reviewed_at SET DEFAULT 0");
    }
  }
}

async function ensureAcademicSchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS training_plans (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at BIGINT NOT NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS semester_courses (
    id BIGSERIAL PRIMARY KEY,
    semester VARCHAR(32) NOT NULL,
    course_code VARCHAR(64) NOT NULL DEFAULT '',
    course_name VARCHAR(128) NOT NULL DEFAULT '',
    credits NUMERIC(6,2) NOT NULL DEFAULT 0,
    module_name VARCHAR(64) NOT NULL DEFAULT '',
    updated_at BIGINT NOT NULL,
    UNIQUE (semester, course_code, course_name)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS student_transcripts (
    id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    plan_name VARCHAR(128) NOT NULL DEFAULT '',
    source_format VARCHAR(16) NOT NULL DEFAULT '',
    file_path VARCHAR(512) NOT NULL DEFAULT '-',
    parsed_file_path VARCHAR(512) NOT NULL DEFAULT '-',
    parsed_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    courses JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at BIGINT NOT NULL
  )`);

  const transcriptColsResp = await pool.query(
    "SELECT column_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='student_transcripts'",
  );
  const transcriptCols = new Set((transcriptColsResp.rows || []).map((r) => String(r.column_name || "")));
  const transcriptColDefaults = new Map(
    (transcriptColsResp.rows || []).map((r) => [String(r.column_name || ""), String(r.column_default || "")]),
  );
  if (transcriptCols.has("file_path")) {
    await pool.query("UPDATE student_transcripts SET file_path=$1 WHERE file_path IS NULL OR file_path=''", [TRANSCRIPT_PATH_PLACEHOLDER]);
    if (!/^'-'::/.test(transcriptColDefaults.get("file_path") || "")) {
      await pool.query("ALTER TABLE student_transcripts ALTER COLUMN file_path SET DEFAULT '-'");
    }
  }
  if (!transcriptCols.has("parsed_file_path")) {
    await pool.query("ALTER TABLE student_transcripts ADD COLUMN parsed_file_path VARCHAR(512) NOT NULL DEFAULT '-'");
  } else {
    await pool.query(
      "UPDATE student_transcripts SET parsed_file_path=$1 WHERE parsed_file_path IS NULL OR parsed_file_path=''",
      [TRANSCRIPT_PATH_PLACEHOLDER],
    );
    if (!/^'-'::/.test(transcriptColDefaults.get("parsed_file_path") || "")) {
      await pool.query("ALTER TABLE student_transcripts ALTER COLUMN parsed_file_path SET DEFAULT '-'");
    }
  }
  if (!transcriptCols.has("parsed_summary")) {
    await pool.query("ALTER TABLE student_transcripts ADD COLUMN parsed_summary JSONB NOT NULL DEFAULT '{}'::jsonb");
  } else {
    await pool.query("UPDATE student_transcripts SET parsed_summary='{}'::jsonb WHERE parsed_summary IS NULL");
    await pool.query("ALTER TABLE student_transcripts ALTER COLUMN parsed_summary SET DEFAULT '{}'::jsonb");
  }
}

const TEMPLATE_UPLOAD_DIR = path.join(__dirname, "templates", "uploads");
const HONOR_UPLOAD_DIR = path.join(__dirname, "uploads", "honor");
const ACTIVITY_UPLOAD_DIR = path.join(__dirname, "uploads", "activity");
function ensureDirSync(dirPath) {
  if (fs.existsSync(dirPath)) return;
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveStoragePath(storagePath) {
  const normalized = String(storagePath ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  const full = path.resolve(__dirname, normalized);
  const root = path.resolve(__dirname) + path.sep;
  if (!full.startsWith(root)) return null;
  return full;
}

async function ensureSeedDocumentTemplates(pool) {
  const samplePath = "template1.html";
  const full = resolveStoragePath(samplePath);
  if (!full || !fs.existsSync(full)) return;
  const exists = await pool.query("SELECT id FROM document_templates WHERE storage_path=$1 LIMIT 1", [samplePath]);
  if (exists.rows?.length) return;
  const now = Date.now();
  await pool.query(
    "INSERT INTO document_templates (title, category, format, storage_path, enabled, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)",
    ["请假条模板示例", "请假条", "html", samplePath, true, "system", now],
  );
}

function renderTemplateText(raw, values) {
  let out = String(raw ?? "");
  for (const [k, v] of Object.entries(values || {})) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), String(v ?? ""));
  }
  return out;
}

function htmlToText(html) {
  const s = String(html ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(tr|p|div|table)\s*>/gi, "\n")
    .replace(/<\/\s*td\s*>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

function wrapHtml(bodyHtml) {
  const body = String(bodyHtml ?? "");
  if (/<\s*html[\s>]/i.test(body)) return body;
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
body{font-family:PingFang SC,Microsoft YaHei,Arial,sans-serif;font-size:14px;color:#111;}
table{border-collapse:collapse;width:100%;}
td,th{border:1px solid #333;padding:6px;vertical-align:top;}
</style></head><body>${body}</body></html>`;
}

function mapPdfErrorMessage(err) {
  const msg = String(err?.message || err || "");
  const lower = msg.toLowerCase();
  if (lower.includes("could not find chrome") || lower.includes("could not find chromium")) {
    return {
      code: "BROWSER_MISSING",
      message: "未找到 Chromium 浏览器（puppeteer 的浏览器未安装）。请在 server 目录执行：npm install（必要时重新安装 puppeteer）",
    };
  }
  if (lower.includes("failed to launch") || lower.includes("browser was not found")) {
    return {
      code: "BROWSER_LAUNCH_FAILED",
      message: "PDF 生成失败：浏览器启动失败。请确认服务器环境允许启动 Chromium，并检查 puppeteer 安装是否完整",
    };
  }
  if (lower.includes("eacces") || lower.includes("eperm")) {
    return {
      code: "PERMISSION_DENIED",
      message: "PDF 生成失败：权限不足。请以有权限的方式运行后端，或检查模板文件/目录权限",
    };
  }
  if (lower.includes("timeout")) {
    return { code: "RENDER_TIMEOUT", message: "PDF 生成超时，请稍后重试或简化模板内容" };
  }
  return { code: "PDF_FAILED", message: `PDF 生成失败：${msg || "未知错误"}` };
}

function mapHonorDbError(err) {
  const code = String(err?.code || "");
  if (code === "42P01") {
    return { code: "SCHEMA_MISSING", message: "数据库表未初始化：请执行 schema.sql 更新 honor_items 表", status: 500 };
  }
  if (code === "22001") {
    return { code: "VALUE_TOO_LONG", message: "填写内容过长，请缩短后重试", status: 400 };
  }
  if (code === "23502") {
    const col = String(err?.column || "").trim();
    return { code: "FIELD_REQUIRED", message: col ? `缺少必填字段：${col}` : "缺少必填字段，请检查后重试", status: 400 };
  }
  return null;
}

function mapActivityDbError(err) {
  const code = String(err?.code || "");
  if (code === "28P01") {
    return { code: "DB_AUTH_FAILED", message: "数据库认证失败：请检查 DB_USER / DB_PASSWORD", status: 500 };
  }
  if (code === "42501") {
    return { code: "PERMISSION_DENIED", message: "数据库权限不足：请为当前数据库账号授权", status: 500 };
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EHOSTUNREACH" || code === "ENOTFOUND") {
    return { code: "DB_ERROR", message: "数据库连接失败：请检查数据库是否启动、端口是否正确、是否允许本机连接", status: 500 };
  }
  if (code === "42P01") {
    return {
      code: "SCHEMA_MISSING",
      message: "数据库表未初始化：请执行 schema.sql 更新 class_activities / class_activity_participants 表",
      status: 500,
    };
  }
  if (code === "42703") {
    return { code: "SCHEMA_MISMATCH", message: "数据库表结构不匹配：请重新执行 schema.sql 更新表结构", status: 500 };
  }
  if (code === "22001") {
    return { code: "VALUE_TOO_LONG", message: "填写内容过长，请缩短后重试", status: 400 };
  }
  if (code === "23502") {
    const col = String(err?.column || "").trim();
    return { code: "FIELD_REQUIRED", message: col ? `缺少必填字段：${col}` : "缺少必填字段，请检查后重试", status: 400 };
  }
  if (code === "22P02") {
    return { code: "INVALID_DATA", message: "提交数据格式错误，请检查日期/图片/参与人列表格式", status: 400 };
  }
  return null;
}

function mapAcademicDbError(err) {
  const code = String(err?.code || "");
  if (code === "42P01") {
    return { code: "SCHEMA_MISSING", message: "数据库表未初始化：请执行 schema.sql 更新学业预警相关表", status: 500 };
  }
  if (code === "42703") {
    return { code: "SCHEMA_MISMATCH", message: "数据库表结构不匹配：请重新执行 schema.sql 更新表结构", status: 500 };
  }
  if (code === "22001") {
    return { code: "VALUE_TOO_LONG", message: "填写内容过长，请缩短后重试", status: 400 };
  }
  if (code === "23502") {
    const col = String(err?.column || "").trim();
    return { code: "FIELD_REQUIRED", message: col ? `缺少必填字段：${col}` : "缺少必填字段，请检查后重试", status: 400 };
  }
  if (code === "22P02") {
    return { code: "INVALID_DATA", message: "提交数据格式错误，请检查学分/成绩单格式", status: 400 };
  }
  return null;
}

function partyStageIndex(stage) {
  const idx = PARTY_STAGES.findIndex((s) => s.value === stage);
  return idx >= 0 ? idx : 0;
}

function normalizePartyStage(stage) {
  const value = String(stage ?? "").trim();
  return PARTY_STAGES.some((s) => s.value === value) ? value : "group_assessment";
}

function partyStageFromDates(row) {
  const fullMember = row?.full_member_date;
  const probationaryFull = row?.probationary_full_year_date;
  const probationary = row?.probationary_date;
  const devObject = row?.dev_object_date;
  const activist = row?.activist_date;
  if (fullMember) return "full_member";
  if (probationaryFull) return "probationary_full_year";
  if (probationary) return "probationary";
  if (devObject) return "dev_object";
  if (activist) return "activist";
  return "group_assessment";
}

function partyStageLabel(stage) {
  return PARTY_STAGES.find((s) => s.value === stage)?.label || PARTY_STAGES[0].label;
}

function partyStageStatus(stage) {
  return PARTY_STAGES.find((s) => s.value === stage)?.status || PARTY_STAGES[0].status;
}

function normalizeYmdInput(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function safeFileBaseName(name) {
  const s = String(name ?? "")
    .replace(/[^\w.\-()]+/g, "_")
    .slice(0, 60);
  return s || "file";
}

function decodeHtmlEntities(input) {
  return String(input ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function parseNumberLoose(value) {
  const s = String(value ?? "").trim();
  if (!s) return 0;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCourseCode(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, "").toUpperCase();
}

function normalizeCourseName(value) {
  const s = String(value ?? "").trim();
  return s.replace(/\s+/g, " ");
}

function normalizeGrade(value) {
  return String(value ?? "").trim();
}

function isPassedGrade(grade) {
  const g = String(grade ?? "").trim();
  if (!g) return false;
  if (/[未不]通过/.test(g) || /不合格/.test(g) || /\bF\b/i.test(g)) return false;
  if (/合格|通过|PASS/i.test(g)) return true;
  const n = parseNumberLoose(g);
  return n >= 60;
}

function splitCsvLine(line) {
  const s = String(line ?? "");
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '"') {
      if (inQuote && s[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (!inQuote && ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => String(x ?? "").trim());
}

function parseTranscriptFromCsvText(text) {
  const lines = String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]);
  const idxCode = header.findIndex((h) => /代码|课程代码|course\s*code/i.test(h));
  const idxName = header.findIndex((h) => /课程|课程名称|名称|course\s*name/i.test(h));
  const idxCredits = header.findIndex((h) => /学分|credit/i.test(h));
  const idxGrade = header.findIndex((h) => /成绩|grade/i.test(h));

  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const code = normalizeCourseCode(cols[idxCode] ?? "");
    const name = normalizeCourseName(cols[idxName] ?? "");
    const credits = parseNumberLoose(cols[idxCredits] ?? "");
    const grade = normalizeGrade(cols[idxGrade] ?? "");
    if (!code && !name) continue;
    if (!credits && !grade) continue;
    out.push({ code, name, credits, grade });
  }
  return out;
}

function normalizeTranscriptPdfText(text) {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/\u3000/g, " ")
    .replace(/[ ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function splitTranscriptPdfLines(text) {
  return normalizeTranscriptPdfText(text)
    .split("\n")
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
}

function splitTranscriptRawLines(text) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => String(line ?? "").replace(/\u3000/g, " ").trim())
    .filter(Boolean);
}

function cleanTranscriptColumnText(text) {
  return String(text ?? "")
    .replace(/[ ]+/g, " ")
    .trim();
}

function isTranscriptPageLine(line) {
  const value = String(line ?? "").trim();
  if (!value) return false;
  return /^第?\s*\d+\s*页(?:\s*\/\s*共?\s*\d+\s*页)?$/i.test(value)
    || /^--\s*\d+\s*of\s*\d+\s*--$/i.test(value);
}

function isTranscriptMetaLine(line) {
  const value = String(line ?? "").trim();
  if (!value) return true;
  const compact = value.replace(/\s+/g, "");
  return /^(学生成绩单|成绩单|Transcript)$/i.test(compact)
    || /(学号[:：]|姓名[:：]|学院[:：]|院系[:：]|专业[:：]|层次[:：]|学制[:：]|班级[:：]|页号[:：]|制表单位[:：]|打印时间[:：])/i.test(compact)
    || /(课程名称.*学分.*成绩.*学分绩点)|(学分.*成绩.*学分绩点.*课程名称)/i.test(compact)
    || isTranscriptSummaryLine(compact)
    || isTranscriptPageLine(compact);
}

function splitTranscriptColumnsFromLine(line) {
  const parts = String(line ?? "").split("\t");
  if (parts.length <= 1) return [cleanTranscriptColumnText(line)].filter(Boolean);

  const leftPart = cleanTranscriptColumnText(parts[0] ?? "");
  const rightPart = cleanTranscriptColumnText(parts.slice(1).join(" "));
  return [leftPart, rightPart].filter(Boolean);
}

function stripTranscriptSemesterText(text) {
  return cleanTranscriptColumnText(
    String(text ?? "").replace(
      /20\d{2}\s*[-/]\s*20\d{2}.{0,8}?(?:秋季学期|春季学期|夏季学期|冬季学期|第?\s*[12一二]\s*学期|[12一二]学期)/,
      "",
    ),
  );
}

function buildTranscriptColumnSequence(text) {
  const rawLines = splitTranscriptRawLines(text);
  const out = [];

  for (const rawLine of rawLines) {
    const columns = splitTranscriptColumnsFromLine(rawLine);
    for (const columnText of columns) {
      if (!columnText) continue;

      const semester = findTranscriptSemesterInLine(columnText);
      const cleaned = semester ? stripTranscriptSemesterText(columnText) : columnText;

      if (semester && !cleaned) continue;
      if (!cleaned) continue;
      if (isTranscriptMetaLine(cleaned)) continue;
      out.push(cleaned);
    }
  }

  return out;
}

function getReorderedTranscriptText(text) {
  return buildTranscriptColumnSequence(text).join("\n");
}

function normalizeTranscriptSemester(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const match = text.match(/(20\d{2})\s*[-/]\s*(20\d{2}).{0,6}?(秋季|春季|夏季|冬季|[12一二])(?:学期)?/);
  if (!match) return text;
  const rawTerm = match[3];
  const term = rawTerm === "一" ? "1"
    : rawTerm === "二" ? "2"
      : rawTerm === "秋季" ? "1"
        : rawTerm === "春季" ? "2"
          : rawTerm === "夏季" ? "3"
            : rawTerm === "冬季" ? "4"
              : rawTerm;
  return `${match[1]}-${match[2]}-${term}`;
}

function findTranscriptSemesterInLine(line) {
  const direct = String(line ?? "").match(/20\d{2}\s*[-/]\s*20\d{2}.{0,8}?(?:秋季学期|春季学期|夏季学期|冬季学期|第?\s*[12一二]\s*学期|[12一二]学期)/);
  if (direct) return normalizeTranscriptSemester(direct[0]);
  const compact = String(line ?? "").match(/20\d{2}\s*[-/]\s*20\d{2}\s*[-/]\s*[12]/);
  if (compact) return compact[0].replace(/\s+/g, "");
  return "";
}

function looksLikeTranscriptCourseCode(token) {
  const value = String(token ?? "").trim();
  return /^[A-Za-z0-9_-]{2,30}$/.test(value) && (/[A-Za-z]/.test(value) || /\d{4,}/.test(value));
}

function parseTranscriptCredits(token) {
  const value = String(token ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 20) return null;
  return num;
}

function parseTranscriptScore(token) {
  const value = String(token ?? "").trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) return null;
  return num;
}

function parseTranscriptGradeToken(token) {
  const value = String(token ?? "").trim();
  if (!value) return "";
  if (/^(优秀|良好|中等|及格|不及格|通过|不通过|合格|不合格|A\+?|A-|B\+?|B-|C\+?|C-|D|F|P|NP)$/i.test(value)) return value;
  return "";
}

function shouldSkipTranscriptPdfLine(line) {
  return /^(序号|学号|姓名|学院|专业|课程类别|课程名称|成绩单|Transcript|GPA|平均学分绩点)/i.test(String(line ?? ""))
    || /(课程名称.*学分.*成绩.*学分绩点)|(学分.*成绩.*学分绩点.*课程名称)/i.test(String(line ?? ""))
    || isTranscriptMetaLine(line);
}

function isTranscriptSummaryLine(line) {
  return /(总取得学分|总学分绩点|平均学分绩点|GPA|核算方法|制表单位|日期|页号|每门课学分绩点|平均学分绩点计算)/i.test(String(line ?? ""))
    || /(?:^|\s)(?:A\(|A-\(|B\+\(|B\(|B-\(|C\+\(|C\(|C-\(|D\+\(|D\(|P\(|F\()/i.test(String(line ?? ""));
}

function looksLikeCourseName(text) {
  const value = normalizeCourseName(text);
  if (!value) return false;
  if (value.length < 2 || value.length > 80) return false;
  if (/^(学号|姓名|学院|专业|成绩单|课程类别|课程代码|课程名称|学分|成绩|等级|绩点|考试性质|修读方式)$/i.test(value)) return false;
  return /[\u4e00-\u9fa5A-Za-z]/.test(value);
}

function dedupeTranscriptCourses(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const key = [item.code, item.name, item.credits, item.grade].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildTranscriptCourse({ code = "", name = "", credits = 0, grade = "" }) {
  return {
    code: normalizeCourseCode(code),
    name: normalizeCourseName(name),
    credits: Number.isFinite(Number(credits)) ? Number(credits) : 0,
    grade: normalizeGrade(grade),
  };
}

function parseTranscriptFromPdfText(text) {
  const reorderedText = getReorderedTranscriptText(text);
  const lines = splitTranscriptPdfLines(reorderedText);
  const out = [];
  let pendingName = "";
  const gradePattern = "(?:A\\+?|A-|B\\+?|B-|C\\+?|C-|D|F|P|NP|\\d{2,3})";
  const metricLineRe = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(${gradePattern})\\s+\\d+(?:\\.\\d+)?$`, "i");
  const inlineCourseRe = new RegExp(`^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s+(${gradePattern})\\s+\\d+(?:\\.\\d+)?$`, "i");

  function pushCourse(name, credits, grade) {
    const item = buildTranscriptCourse({ name, credits, grade });
    if (!item.name) return;
    if (!item.credits && !item.grade) return;
    out.push(item);
  }

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = String(lines[i] ?? "").trim();
    if (!rawLine) continue;
    if (isTranscriptSummaryLine(rawLine)) continue;

    const foundSemester = findTranscriptSemesterInLine(rawLine);
    if (foundSemester) continue;

    const line = rawLine;

    if (shouldSkipTranscriptPdfLine(line)) continue;

    const inlineMatch = line.match(inlineCourseRe);
    if (inlineMatch) {
      pushCourse(inlineMatch[1], inlineMatch[2], inlineMatch[3]);
      pendingName = "";
      continue;
    }

    const metricMatch = line.match(metricLineRe);
    if (metricMatch) {
      if (pendingName) pushCourse(pendingName, metricMatch[1], metricMatch[2]);
      pendingName = "";
      continue;
    }

    if (looksLikeCourseName(line)) {
      pendingName = pendingName ? `${pendingName} ${line}` : line;
    }
  }

  return dedupeTranscriptCourses(out);
}

function buildTranscriptParseSummary({ sourceFormat, courses }) {
  const items = Array.isArray(courses) ? courses : [];
  const gradeKinds = [...new Set(items.map((item) => String(item?.grade ?? "").trim()).filter(Boolean))];
  return {
    sourceFormat: String(sourceFormat ?? ""),
    courseCount: items.length,
    coursesWithCode: items.filter((item) => String(item?.code ?? "").trim()).length,
    coursesWithCredits: items.filter((item) => Number(item?.credits || 0) > 0).length,
    coursesWithGrade: items.filter((item) => String(item?.grade ?? "").trim()).length,
    gradeKinds,
  };
}

function extractHtmlTableRows(html) {
  const raw = String(html ?? "");
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const rows = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  const tdRe = /<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi;
  const stripTagRe = /<[^>]+>/g;
  const trMatches = cleaned.match(trRe) || [];
  for (const tr of trMatches) {
    const cells = [];
    let m;
    while ((m = tdRe.exec(tr)) !== null) {
      const cellHtml = m[2] || "";
      const text = decodeHtmlEntities(cellHtml.replace(/<br\s*\/?>/gi, "\n").replace(stripTagRe, " "));
      const compact = String(text).replace(/\s+/g, " ").trim();
      cells.push(compact);
    }
    if (cells.length) rows.push(cells);
    tdRe.lastIndex = 0;
  }
  return rows;
}

function parseTranscriptFromHtml(html) {
  const rows = extractHtmlTableRows(html);
  if (!rows.length) return [];
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const joined = rows[i].join(" ");
    if (/学分/.test(joined) && /课程/.test(joined)) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) headerRowIndex = 0;
  const header = rows[headerRowIndex] || [];
  const idxCode = header.findIndex((h) => /代码|课程代码|course\s*code/i.test(h));
  const idxName = header.findIndex((h) => /课程名称|课程名|名称|course\s*name/i.test(h));
  const idxCredits = header.findIndex((h) => /学分|credit/i.test(h));
  const idxGrade = header.findIndex((h) => /成绩|grade/i.test(h));

  const out = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const cols = rows[i];
    const code = normalizeCourseCode(cols[idxCode] ?? "");
    const name = normalizeCourseName(cols[idxName] ?? "");
    const credits = parseNumberLoose(cols[idxCredits] ?? "");
    const grade = normalizeGrade(cols[idxGrade] ?? "");
    if (!code && !name) continue;
    if (!credits && !grade) continue;
    out.push({ code, name, credits, grade });
  }
  return out;
}

async function parseTranscriptFile({ filename, mime, buffer }) {
  const name = String(filename ?? "");
  const ext = path.extname(name).toLowerCase();
  const type = String(mime ?? "").toLowerCase();

  if (ext === ".csv" || type.includes("csv")) {
    return { format: "csv", courses: parseTranscriptFromCsvText(buffer.toString("utf8")) };
  }
  if (ext === ".txt" || type.includes("text/plain")) {
    return { format: "txt", courses: parseTranscriptFromCsvText(buffer.toString("utf8")) };
  }
  if (ext === ".html" || ext === ".htm" || type.includes("text/html")) {
    return { format: "html", courses: parseTranscriptFromHtml(buffer.toString("utf8")) };
  }
  if (ext === ".pdf" || type.includes("pdf")) {
    let PDFParse;
    try {
      ({ PDFParse } = require("pdf-parse"));
    } catch {
      const err = new Error("暂不支持PDF解析，请导出HTML或CSV成绩单后再上传");
      err.code = "PDF_PARSE_UNSUPPORTED";
      throw err;
    }
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy().catch(() => {});
    const text = String(parsed?.text ?? "");
    return { format: "pdf", courses: parseTranscriptFromPdfText(text) };
  }
  const err = new Error("不支持的文件类型：请上传 HTML / CSV / TXT / PDF");
  err.code = "UNSUPPORTED_FILE";
  throw err;
}

function parseTrainingPlanFromCsvText(text) {
  const lines = String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]);
  const idxModule = header.findIndex((h) => /模块|模块名称|module/i.test(h));
  const idxReq = header.findIndex((h) => /模块学分|要求学分|required/i.test(h));
  const idxCode = header.findIndex((h) => /代码|课程代码|course\s*code/i.test(h));
  const idxName = header.findIndex((h) => /课程名称|课程名|名称|course\s*name/i.test(h));
  const idxCredits = header.findIndex((h) => /学分|credit/i.test(h));

  const modMap = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const moduleName = String(cols[idxModule] ?? "").trim() || "必修";
    const code = normalizeCourseCode(cols[idxCode] ?? "");
    const name = normalizeCourseName(cols[idxName] ?? "");
    const credits = parseNumberLoose(cols[idxCredits] ?? "");
    const requiredCreditsHint = parseNumberLoose(cols[idxReq] ?? "");
    if (!code && !name) continue;
    if (!modMap.has(moduleName)) modMap.set(moduleName, { requiredCreditsHint: 0, courses: [] });
    const m = modMap.get(moduleName);
    m.courses.push({ code, name, credits });
    if (requiredCreditsHint > 0) m.requiredCreditsHint = Math.max(m.requiredCreditsHint, requiredCreditsHint);
  }

  const modules = [];
  for (const [name, v] of modMap.entries()) {
    let sum = 0;
    const uniq = new Set();
    const courses = [];
    for (const c of v.courses) {
      const key = `${c.code || ""}::${c.name || ""}`;
      if (uniq.has(key)) continue;
      uniq.add(key);
      courses.push(c);
      sum += Number(c.credits || 0);
    }
    modules.push({
      name,
      requiredCredits: v.requiredCreditsHint > 0 ? v.requiredCreditsHint : sum,
      courses,
    });
  }
  return modules;
}

function parseTrainingPlanFromHtml(html) {
  const rows = extractHtmlTableRows(html);
  if (!rows.length) return [];
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const joined = rows[i].join(" ");
    if (/模块/.test(joined) && /学分/.test(joined) && /课程/.test(joined)) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) headerRowIndex = 0;
  const header = rows[headerRowIndex] || [];
  const idxModule = header.findIndex((h) => /模块|模块名称|module/i.test(h));
  const idxReq = header.findIndex((h) => /模块学分|要求学分|required/i.test(h));
  const idxCode = header.findIndex((h) => /代码|课程代码|course\s*code/i.test(h));
  const idxName = header.findIndex((h) => /课程名称|课程名|名称|course\s*name/i.test(h));
  const idxCredits = header.findIndex((h) => /学分|credit/i.test(h));

  const modMap = new Map();
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const cols = rows[i];
    const moduleName = String(cols[idxModule] ?? "").trim() || "必修";
    const code = normalizeCourseCode(cols[idxCode] ?? "");
    const name = normalizeCourseName(cols[idxName] ?? "");
    const credits = parseNumberLoose(cols[idxCredits] ?? "");
    const requiredCreditsHint = parseNumberLoose(cols[idxReq] ?? "");
    if (!code && !name) continue;
    if (!modMap.has(moduleName)) modMap.set(moduleName, { requiredCreditsHint: 0, courses: [] });
    const m = modMap.get(moduleName);
    m.courses.push({ code, name, credits });
    if (requiredCreditsHint > 0) m.requiredCreditsHint = Math.max(m.requiredCreditsHint, requiredCreditsHint);
  }

  const modules = [];
  for (const [name, v] of modMap.entries()) {
    let sum = 0;
    const uniq = new Set();
    const courses = [];
    for (const c of v.courses) {
      const key = `${c.code || ""}::${c.name || ""}`;
      if (uniq.has(key)) continue;
      uniq.add(key);
      courses.push(c);
      sum += Number(c.credits || 0);
    }
    modules.push({
      name,
      requiredCredits: v.requiredCreditsHint > 0 ? v.requiredCreditsHint : sum,
      courses,
    });
  }
  return modules;
}

async function parseTrainingPlanFile({ filename, mime, buffer }) {
  const name = String(filename ?? "");
  const ext = path.extname(name).toLowerCase();
  const type = String(mime ?? "").toLowerCase();

  if (ext === ".csv" || type.includes("csv")) {
    return { format: "csv", modules: parseTrainingPlanFromCsvText(buffer.toString("utf8")) };
  }
  if (ext === ".txt" || type.includes("text/plain")) {
    return { format: "txt", modules: parseTrainingPlanFromCsvText(buffer.toString("utf8")) };
  }
  if (ext === ".html" || ext === ".htm" || type.includes("text/html")) {
    return { format: "html", modules: parseTrainingPlanFromHtml(buffer.toString("utf8")) };
  }
  const err = new Error("不支持的文件类型：请上传 HTML / CSV / TXT");
  err.code = "UNSUPPORTED_FILE";
  throw err;
}

function extractPlanNameFromTags(tags) {
  const list = Array.isArray(tags) ? tags : [];
  for (const t of list) {
    const s = String(t ?? "").trim();
    if (!s) continue;
    if (!s.includes("培养方案")) continue;
    const m = s.match(/培养方案[:：\-]\s*(.+)\s*$/);
    if (m) return String(m[1] ?? "").trim();
    const m2 = s.match(/培养方案\s*(.+)\s*$/);
    if (m2) return String(m2[1] ?? "").trim();
  }
  return "";
}

function buildAcademicReport({ plan, transcriptCourses, semesterCourses, semester }) {
  const modules = Array.isArray(plan?.modules) ? plan.modules : [];

  const bestByKey = new Map();
  for (const c of transcriptCourses || []) {
    const code = normalizeCourseCode(c.code);
    const name = normalizeCourseName(c.name);
    const credits = Number(c.credits || 0);
    const grade = normalizeGrade(c.grade);
    const passed = isPassedGrade(grade);
    const key = code || name;
    if (!key) continue;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, { code, name, credits, grade, passed });
      continue;
    }
    if (existing.passed) continue;
    if (passed) bestByKey.set(key, { code, name, credits, grade, passed });
  }

  const moduleReports = [];
  const missingCourses = [];
  for (const mod of modules) {
    const modName = String(mod?.name ?? "").trim();
    const requiredCredits = Number(mod?.requiredCredits || 0);
    const courses = Array.isArray(mod?.courses) ? mod.courses : [];

    let earned = 0;
    const courseReports = [];
    for (const rc of courses) {
      const code = normalizeCourseCode(rc?.code);
      const name = normalizeCourseName(rc?.name);
      const credits = Number(rc?.credits || 0);
      const key = code || name;
      const got = key ? bestByKey.get(key) : null;
      const completed = !!got?.passed;
      if (completed) earned += credits || Number(got?.credits || 0);
      else missingCourses.push({ code, name, credits, moduleName: modName });
      courseReports.push({
        code,
        name,
        credits,
        completed,
      });
    }

    const deficit = Math.max(0, requiredCredits - earned);
    moduleReports.push({
      name: modName,
      requiredCredits,
      earnedCredits: earned,
      deficitCredits: deficit,
      courses: courseReports,
    });
  }

  const semesterList = Array.isArray(semesterCourses) ? semesterCourses : [];
  const recs = [];
  for (const miss of missingCourses) {
    const code = normalizeCourseCode(miss.code);
    const name = normalizeCourseName(miss.name);
    for (const sc of semesterList) {
      const scCode = normalizeCourseCode(sc.courseCode);
      const scName = normalizeCourseName(sc.courseName);
      if (code && scCode && code === scCode) {
        recs.push({
          semester,
          courseCode: scCode,
          courseName: scName,
          credits: Number(sc.credits || 0),
          moduleName: String(sc.moduleName ?? miss.moduleName ?? ""),
          reason: miss.moduleName ? `补修：${miss.moduleName}` : "补修必修课",
        });
        break;
      }
      if (!code && name && scName && scName.includes(name)) {
        recs.push({
          semester,
          courseCode: scCode,
          courseName: scName,
          credits: Number(sc.credits || 0),
          moduleName: String(sc.moduleName ?? miss.moduleName ?? ""),
          reason: miss.moduleName ? `补修：${miss.moduleName}` : "补修必修课",
        });
        break;
      }
    }
  }

  const uniq = new Set();
  const recommendations = [];
  for (const r of recs) {
    const key = `${r.semester}::${r.courseCode || ""}::${r.courseName || ""}`;
    if (uniq.has(key)) continue;
    uniq.add(key);
    recommendations.push(r);
  }

  const uniqMissing = new Set();
  const missingCoursesUnique = [];
  for (const c of missingCourses) {
    const key = `${normalizeCourseCode(c.code)}::${normalizeCourseName(c.name)}::${String(c.moduleName ?? "")}`;
    if (uniqMissing.has(key)) continue;
    uniqMissing.add(key);
    missingCoursesUnique.push({
      code: normalizeCourseCode(c.code),
      name: normalizeCourseName(c.name),
      credits: Number(c.credits || 0),
      moduleName: String(c.moduleName ?? ""),
    });
  }

  const missingModuleCount = moduleReports.filter((m) => m.deficitCredits > 0).length;
  return {
    planName: String(plan?.name ?? ""),
    missingModuleCount,
    modules: moduleReports,
    missingCourses: missingCoursesUnique,
    recommendations,
  };
}

async function getStudentTags(pool, accountId) {
  const id = normalizeAccountId(accountId);
  if (!id) return [];
  const resp = await pool.query("SELECT tags FROM party_students WHERE account_id=$1 LIMIT 1", [id]);
  return normalizeStringArray(resp.rows?.[0]?.tags);
}

function hasTag(tags, tagValue) {
  const t = String(tagValue ?? "").trim();
  if (!t) return false;
  return (tags || []).some((x) => String(x) === t);
}

function toYmd(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const s = value.trim();
    const match = s.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/);
    return match ? match[1] : "";
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToUtcDate(ymd) {
  const s = String(ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function addMonthsYmd(ymd, months) {
  const dt = ymdToUtcDate(ymd);
  if (!dt) return "";
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const d = dt.getUTCDate();
  const next = new Date(Date.UTC(y, m + months, 1));
  const daysInTargetMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, daysInTargetMonth);
  next.setUTCDate(day);
  return toYmd(next);
}

function nextDueFromStart({ startYmd, periodMonths, nowYmd }) {
  const start = String(startYmd || "");
  const now = String(nowYmd || "");
  if (!start || !now) return "";
  const startDt = ymdToUtcDate(start);
  const nowDt = ymdToUtcDate(now);
  if (!startDt || !nowDt) return "";
  for (let k = 1; k <= 200; k += 1) {
    const due = addMonthsYmd(start, periodMonths * k);
    if (!due) continue;
    if (ymdToUtcDate(due).getTime() >= nowDt.getTime()) return due;
  }
  return "";
}

function mapPartyStudentRow(row) {
  const stage = normalizePartyStage(row?.current_stage);
  const status = String(row?.current_status ?? "").trim() || partyStageStatus(stage);
  return {
    accountId: String(row?.account_id ?? ""),
    name: String(row?.name ?? ""),
    applicationDate: toYmd(row?.application_date),
    activistDate: toYmd(row?.activist_date),
    devObjectDate: toYmd(row?.dev_object_date),
    probationaryDate: toYmd(row?.probationary_date),
    probationaryFullYearDate: toYmd(row?.probationary_full_year_date),
    fullMemberDate: toYmd(row?.full_member_date),
    currentStage: stage,
    currentStageLabel: partyStageLabel(stage),
    currentStageIndex: partyStageIndex(stage),
    currentStatus: status,
    nextReportDue: toYmd(row?.next_report_due),
    nextTalkDue: toYmd(row?.next_talk_due),
    updatedAt: Number(row?.updated_at || 0),
  };
}

function normalizeRole(role) {
  return role === "admin" ? "admin" : "student";
}

function normalizeAccountId(accountId) {
  return String(accountId ?? "").trim();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToString(s) {
  const pad = 4 - (s.length % 4 || 4);
  const padded = s + "=".repeat(pad);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function signToken(payload) {
  const json = JSON.stringify(payload);
  const body = base64UrlEncode(json);
  const sig = base64UrlEncode(crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest());
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = base64UrlEncode(crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest());
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(base64UrlDecodeToString(body));
    if (typeof payload?.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password, salt) {
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
  return derived.toString("hex");
}

function tokenizeKeywords(text) {
  const raw = String(text ?? "").toLowerCase();
  const tokens = [];
  const hanRuns = raw.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const alnum = raw.match(/[a-z0-9]{2,}/g) || [];
  for (const run of hanRuns) {
    const s = String(run);
    const maxLen = Math.min(4, s.length);
    for (let len = 2; len <= maxLen; len += 1) {
      for (let i = 0; i + len <= s.length; i += 1) {
        tokens.push(s.slice(i, i + len));
      }
    }
  }
  for (const t of alnum) tokens.push(t);

  const stop = new Set([
    "请问",
    "如何",
    "怎么",
    "怎样",
    "什么",
    "是否",
    "能否",
    "可以",
    "需要",
    "办理",
    "申请",
    "流程",
    "材料",
    "规定",
    "相关",
    "问题",
    "老师",
    "同学",
    "学校",
  ]);

  const freq = new Map();
  for (const token of tokens) {
    if (stop.has(token)) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);
}

function normalizeKeywordsField(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeStringArray(value) {
  const raw = Array.isArray(value) ? value : normalizeKeywordsField(value);
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function ensurePartyStudentRowExists(pool, accountId, now) {
  const normalized = normalizeAccountId(accountId);
  if (!normalized) return;
  const check = await pool.query("SELECT 1 AS ok FROM party_students WHERE account_id=$1 LIMIT 1", [normalized]);
  if (check.rows?.length) return;
  try {
    await pool.query("INSERT INTO party_students (account_id, created_at, updated_at) VALUES ($1,$2,$2)", [
      normalized,
      now,
    ]);
  } catch {}
}

async function main() {
  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    max: 10,
  });

  await ensureSchema(pool);
  ensureDirSync(TEMPLATE_UPLOAD_DIR);
  ensureDirSync(HONOR_UPLOAD_DIR);
  ensureDirSync(ACTIVITY_UPLOAD_DIR);
  await ensureSeedDocumentTemplates(pool);

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  function authRequired(req, res, next) {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyToken(token);
    if (!payload) {
      fail(res, "UNAUTHORIZED", "未登录或登录已过期", 401);
      return;
    }
    req.user = payload;
    next();
  }

  function adminRequired(req, res, next) {
    if (req.user?.role !== "admin") {
      fail(res, "NOT_ADMIN", "无管理员权限", 403);
      return;
    }
    next();
  }

  app.post("/api/auth/login", async (req, res) => {
    try {
      const role = normalizeRole(req.body?.role);
      const accountId = normalizeAccountId(req.body?.accountId);
      const password = String(req.body?.password ?? "");
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "请输入学工号");
      if (!password) return fail(res, "EMPTY_PASSWORD", "请输入密码");

      const perm = await pool.query(
        "SELECT id FROM permitted_accounts WHERE role=$1 AND account_id=$2 AND enabled=TRUE LIMIT 1",
        [role, accountId],
      );
      if (!perm.rows.length) return fail(res, "NOT_PERMITTED", "该学工号不在权限清单中", 403);

      const userQuery = await pool.query(
        "SELECT id, role, account_id, password_hash, salt FROM users WHERE role=$1 AND account_id=$2 LIMIT 1",
        [role, accountId],
      );

      const now = Date.now();
      let isNew = false;
      let userId;

      if (!userQuery.rows.length) {
        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = hashPassword(password, salt);
        const insert = await pool.query(
          "INSERT INTO users (role, account_id, password_hash, salt, created_at, last_login_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
          [role, accountId, passwordHash, salt, now, now],
        );
        userId = insert.rows[0].id;
        isNew = true;
      } else {
        const existing = userQuery.rows[0];
        const expected = hashPassword(password, existing.salt);
        if (existing.password_hash !== expected) return fail(res, "WRONG_PASSWORD", "密码错误", 403);
        userId = existing.id;
        await pool.query("UPDATE users SET last_login_at=$1 WHERE id=$2", [now, userId]);
      }

      const token = signToken({
        sub: String(userId),
        role,
        accountId,
        exp: now + TOKEN_EXPIRES_MS,
      });
      ok(res, { token, isNew, loginAt: now, user: { role, accountId } });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/qa/ask", authRequired, async (req, res) => {
    try {
      const question = String(req.body?.question ?? "").trim();
      if (!question) return fail(res, "EMPTY_QUESTION", "请输入问题");

      const questionLower = question.toLowerCase();
      const extracted = tokenizeKeywords(questionLower);
      const resp = await pool.query(
        "SELECT id, question, answer, keywords FROM knowledge_qa WHERE enabled=TRUE ORDER BY updated_at DESC LIMIT 300",
      );
      const rows = resp.rows || [];

      let best = null;
      let bestScore = -1;
      for (const row of rows) {
        const rawKeywords = normalizeKeywordsField(row.keywords);
        const keys = rawKeywords.map((x) => String(x).toLowerCase()).filter(Boolean);

        let overlap = 0;
        for (const k of extracted) {
          if (keys.includes(k)) overlap += 1;
        }

        let contains = 0;
        for (const kw of keys) {
          if (kw && questionLower.includes(kw)) contains += 1;
        }

        let score = overlap * 2 + contains;
        const stdQ = String(row.question ?? "");
        if (stdQ && questionLower.includes(stdQ.toLowerCase())) score += 2;
        if (score > bestScore) {
          best = row;
          bestScore = score;
        }
      }

      if (!best || bestScore <= 0) {
        ok(res, { answer: "未找到匹配答案", matchedQuestion: "", keywords: extracted });
        return;
      }

      ok(res, {
        answer: String(best.answer ?? ""),
        matchedQuestion: String(best.question ?? ""),
        keywords: extracted,
      });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/qa", authRequired, adminRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        "SELECT id, question, answer, keywords, enabled, updated_at FROM knowledge_qa ORDER BY updated_at DESC LIMIT 300",
      );
      const items = (resp.rows || []).map((r) => {
        const keywords = normalizeKeywordsField(r.keywords);
        return {
          _id: String(r.id),
          question: r.question,
          answer: r.answer,
          keywords,
          enabled: !!r.enabled,
          updatedAt: r.updated_at,
        };
      });
      ok(res, { items });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/qa", authRequired, adminRequired, async (req, res) => {
    try {
      const question = String(req.body?.question ?? "").trim();
      const answer = String(req.body?.answer ?? "").trim();
      const keywords = Array.isArray(req.body?.keywords)
        ? req.body.keywords.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (!question) return fail(res, "EMPTY_STD_QUESTION", "请填写标准问题");
      if (!answer) return fail(res, "EMPTY_ANSWER", "请填写标准答案");

      const now = Date.now();
      await pool.query(
        "INSERT INTO knowledge_qa (question, answer, keywords, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [question, answer, JSON.stringify(keywords), true, now, now],
      );
      ok(res, { ok: true });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.put("/api/qa/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");

      const question = String(req.body?.question ?? "").trim();
      const answer = String(req.body?.answer ?? "").trim();
      const keywords = Array.isArray(req.body?.keywords)
        ? req.body.keywords.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (!question) return fail(res, "EMPTY_STD_QUESTION", "请填写标准问题");
      if (!answer) return fail(res, "EMPTY_ANSWER", "请填写标准答案");

      const now = Date.now();
      await pool.query(
        "UPDATE knowledge_qa SET question=$1, answer=$2, keywords=$3, updated_at=$4 WHERE id=$5",
        [question, answer, JSON.stringify(keywords), now, id],
      );
      ok(res, { ok: true });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.delete("/api/qa/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      await pool.query("DELETE FROM knowledge_qa WHERE id=$1", [id]);
      ok(res, { ok: true });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/party/student/me", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const now = Date.now();
      await ensurePartyStudentRowExists(pool, accountId, now);

      const resp = await pool.query("SELECT * FROM party_students WHERE account_id=$1 LIMIT 1", [accountId]);
      const row = resp.rows?.[0] || null;
      if (!row) return fail(res, "NOT_FOUND", "学生信息不存在", 404);

      const mapped = mapPartyStudentRow(row);
      const today = toYmd(new Date());
      const fallbackReport =
        mapped.nextReportDue || (mapped.activistDate ? nextDueFromStart({ startYmd: mapped.activistDate, periodMonths: 3, nowYmd: today }) : "");
      const fallbackTalk =
        mapped.nextTalkDue || (mapped.activistDate ? nextDueFromStart({ startYmd: mapped.activistDate, periodMonths: 6, nowYmd: today }) : "");

      ok(res, {
        profile: {
          ...mapped,
          nextReportDue: fallbackReport,
          nextTalkDue: fallbackTalk,
        },
        stages: PARTY_STAGES,
        serverDate: today,
      });
    } catch (e) {
      if (String(e?.code || "") === "42P01") {
        fail(res, "SCHEMA_MISSING", "数据库表未初始化，请先执行 schema.sql", 500);
        return;
      }
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/party/admin/students", authRequired, adminRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        "SELECT account_id, name, current_stage, next_report_due, next_talk_due, updated_at FROM party_students ORDER BY updated_at DESC LIMIT 500",
      );
      const items = (resp.rows || []).map((r) => {
        const stage = normalizePartyStage(r.current_stage);
        return {
          accountId: String(r.account_id ?? ""),
          name: String(r.name ?? ""),
          currentStage: stage,
          currentStageLabel: partyStageLabel(stage),
          currentStageIndex: partyStageIndex(stage),
          nextReportDue: toYmd(r.next_report_due),
          nextTalkDue: toYmd(r.next_talk_due),
          updatedAt: Number(r.updated_at || 0),
        };
      });
      ok(res, { items, stages: PARTY_STAGES });
    } catch (e) {
      if (String(e?.code || "") === "42P01") {
        fail(res, "SCHEMA_MISSING", "数据库表未初始化，请先执行 schema.sql", 500);
        return;
      }
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/party/admin/students/:accountId", authRequired, adminRequired, async (req, res) => {
    try {
      const accountId = normalizeAccountId(req.params.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const now = Date.now();
      await ensurePartyStudentRowExists(pool, accountId, now);

      const resp = await pool.query("SELECT * FROM party_students WHERE account_id=$1 LIMIT 1", [accountId]);
      const row = resp.rows?.[0] || null;
      if (!row) return fail(res, "NOT_FOUND", "学生信息不存在", 404);
      ok(res, { profile: mapPartyStudentRow(row), stages: PARTY_STAGES });
    } catch (e) {
      if (String(e?.code || "") === "42P01") {
        fail(res, "SCHEMA_MISSING", "数据库表未初始化，请先执行 schema.sql", 500);
        return;
      }
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.put("/api/party/admin/students/:accountId", authRequired, adminRequired, async (req, res) => {
    try {
      const accountId = normalizeAccountId(req.params.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const name = String(req.body?.name ?? "").trim();
      const applicationDate = normalizeYmdInput(req.body?.applicationDate);
      const activistDate = normalizeYmdInput(req.body?.activistDate);
      const devObjectDate = normalizeYmdInput(req.body?.devObjectDate);
      const probationaryDate = normalizeYmdInput(req.body?.probationaryDate);
      const probationaryFullYearDate = normalizeYmdInput(req.body?.probationaryFullYearDate);
      const fullMemberDate = normalizeYmdInput(req.body?.fullMemberDate);

      const computedStage = partyStageFromDates({
        activist_date: activistDate,
        dev_object_date: devObjectDate,
        probationary_date: probationaryDate,
        probationary_full_year_date: probationaryFullYearDate,
        full_member_date: fullMemberDate,
      });
      const providedStage = normalizePartyStage(req.body?.currentStage);
      const finalStage =
        partyStageIndex(providedStage) < partyStageIndex(computedStage) ? computedStage : providedStage;

      const providedStatus = String(req.body?.currentStatus ?? "").trim();
      const currentStatus = providedStatus || partyStageStatus(finalStage);

      const today = toYmd(new Date());
      const hasNextReportDue = Object.prototype.hasOwnProperty.call(req.body || {}, "nextReportDue");
      const hasNextTalkDue = Object.prototype.hasOwnProperty.call(req.body || {}, "nextTalkDue");
      const nextReportDueRaw = hasNextReportDue ? normalizeYmdInput(req.body?.nextReportDue) : undefined;
      const nextTalkDueRaw = hasNextTalkDue ? normalizeYmdInput(req.body?.nextTalkDue) : undefined;
      if (hasNextReportDue && String(req.body?.nextReportDue ?? "").trim() && !nextReportDueRaw) {
        return fail(res, "INVALID_DATE", "思想汇报截止日期格式错误，应为 YYYY-MM-DD");
      }
      if (hasNextTalkDue && String(req.body?.nextTalkDue ?? "").trim() && !nextTalkDueRaw) {
        return fail(res, "INVALID_DATE", "谈话截止日期格式错误，应为 YYYY-MM-DD");
      }
      const nextReportDue = hasNextReportDue
        ? nextReportDueRaw
        : activistDate
          ? nextDueFromStart({ startYmd: activistDate, periodMonths: 3, nowYmd: today })
          : null;
      const nextTalkDue = hasNextTalkDue
        ? nextTalkDueRaw
        : activistDate
          ? nextDueFromStart({ startYmd: activistDate, periodMonths: 6, nowYmd: today })
          : null;

      const now = Date.now();
      const update = await pool.query(
        `UPDATE party_students SET
          name=$2,
          application_date=$3,
          activist_date=$4,
          dev_object_date=$5,
          probationary_date=$6,
          probationary_full_year_date=$7,
          full_member_date=$8,
          current_stage=$9,
          current_status=$10,
          next_report_due=$11,
          next_talk_due=$12,
          updated_at=$13
         WHERE account_id=$1`,
        [
          accountId,
          name,
          applicationDate,
          activistDate,
          devObjectDate,
          probationaryDate,
          probationaryFullYearDate,
          fullMemberDate,
          finalStage,
          currentStatus,
          nextReportDue,
          nextTalkDue,
          now,
        ],
      );
      if (!update.rowCount) {
        await pool.query(
          `INSERT INTO party_students
            (account_id, name, application_date, activist_date, dev_object_date, probationary_date, probationary_full_year_date, full_member_date, current_stage, current_status, next_report_due, next_talk_due, created_at, updated_at)
           VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
          [
            accountId,
            name,
            applicationDate,
            activistDate,
            devObjectDate,
            probationaryDate,
            probationaryFullYearDate,
            fullMemberDate,
            finalStage,
            currentStatus,
            nextReportDue,
            nextTalkDue,
            now,
          ],
        );
      }

      const resp = await pool.query("SELECT * FROM party_students WHERE account_id=$1 LIMIT 1", [accountId]);
      const row = resp.rows?.[0] || null;
      ok(res, { profile: mapPartyStudentRow(row), stages: PARTY_STAGES });
    } catch (e) {
      if (String(e?.code || "") === "42P01") {
        fail(res, "SCHEMA_MISSING", "数据库表未初始化，请先执行 schema.sql", 500);
        return;
      }
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/reminder/my", authRequired, async (req, res) => {
    try {
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const resp = await pool.query(
        `SELECT
          n.id,
          n.title,
          n.content,
          n.created_by,
          n.created_at,
          t.read_at
         FROM student_notification_targets t
         JOIN student_notifications n ON n.id=t.notification_id
         WHERE t.account_id=$1
         ORDER BY n.created_at DESC
         LIMIT 200`,
        [accountId],
      );

      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        content: String(r.content ?? ""),
        createdBy: String(r.created_by ?? ""),
        createdAt: Number(r.created_at || 0),
        readAt: r.read_at ? Number(r.read_at) : 0,
      }));
      ok(res, { items });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/reminder/my/:id/read", authRequired, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const now = Date.now();
      await pool.query(
        "UPDATE student_notification_targets SET read_at=$3 WHERE notification_id=$1 AND account_id=$2 AND read_at IS NULL",
        [id, accountId, now],
      );
      ok(res, { ok: true });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/reminder/admin/messages", authRequired, adminRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        `SELECT
          n.id,
          n.title,
          n.content,
          n.target_type,
          n.target_tags,
          n.created_by,
          n.created_at,
          COUNT(t.id) AS target_count,
          SUM(CASE WHEN t.read_at IS NOT NULL THEN 1 ELSE 0 END) AS read_count
         FROM student_notifications n
         LEFT JOIN student_notification_targets t ON t.notification_id=n.id
         GROUP BY n.id
         ORDER BY n.created_at DESC
         LIMIT 200`,
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        content: String(r.content ?? ""),
        targetType: String(r.target_type ?? "all"),
        targetTags: normalizeStringArray(r.target_tags),
        createdBy: String(r.created_by ?? ""),
        createdAt: Number(r.created_at || 0),
        targetCount: Number(r.target_count || 0),
        readCount: Number(r.read_count || 0),
      }));
      ok(res, { items });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/reminder/admin/messages", authRequired, adminRequired, async (req, res) => {
    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();
    const targetType = String(req.body?.targetType ?? "all") === "tags" ? "tags" : "all";
    const targetTags = normalizeStringArray(req.body?.targetTags);

    if (!title) return fail(res, "EMPTY_TITLE", "请填写标题");
    if (!content) return fail(res, "EMPTY_CONTENT", "请填写内容");
    if (targetType === "tags" && !targetTags.length) return fail(res, "EMPTY_TAGS", "请选择标签");

    const now = Date.now();
    const createdBy = normalizeAccountId(req.user?.accountId);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const perm = await client.query(
        "SELECT account_id FROM permitted_accounts WHERE role='student' AND enabled=TRUE ORDER BY account_id ASC",
      );
      const allAccounts = (perm.rows || []).map((r) => normalizeAccountId(r.account_id)).filter(Boolean);
      if (!allAccounts.length) {
        await client.query("ROLLBACK");
        fail(res, "NO_STUDENTS", "暂无可推送的学生账号", 400);
        return;
      }

      let recipients = allAccounts;
      if (targetType === "tags") {
        const tagResp = await client.query("SELECT account_id, tags FROM party_students");
        const tagMap = new Map();
        for (const row of tagResp.rows || []) {
          const id = normalizeAccountId(row.account_id);
          if (!id) continue;
          tagMap.set(id, normalizeStringArray(row.tags));
        }
        const wanted = new Set(targetTags);
        recipients = allAccounts.filter((id) => {
          const tags = tagMap.get(id) || [];
          return tags.some((t) => wanted.has(t));
        });
      }

      recipients = Array.from(new Set(recipients));
      if (!recipients.length) {
        await client.query("ROLLBACK");
        fail(res, "NO_TARGETS", "没有匹配该标签的学生", 400);
        return;
      }

      const insert = await client.query(
        `INSERT INTO student_notifications
          (title, content, target_type, target_tags, created_by, created_at)
         VALUES
          ($1,$2,$3,$4::jsonb,$5,$6)
         RETURNING id`,
        [title, content, targetType, JSON.stringify(targetTags), createdBy, now],
      );
      const notificationId = Number(insert.rows?.[0]?.id || 0);
      if (!notificationId) throw new Error("CREATE_NOTIFICATION_FAILED");

      const chunkSize = 200;
      for (let i = 0; i < recipients.length; i += chunkSize) {
        const chunk = recipients.slice(i, i + chunkSize);
        const params = [];
        const values = [];
        for (let k = 0; k < chunk.length; k += 1) {
          const base = k * 3;
          params.push(notificationId, chunk[k], now);
          values.push(`($${base + 1},$${base + 2},$${base + 3})`);
        }
        await client.query(
          `INSERT INTO student_notification_targets (notification_id, account_id, created_at) VALUES ${values.join(",")}`,
          params,
        );
      }

      await client.query("COMMIT");
      ok(res, { ok: true, id: notificationId, targetCount: recipients.length });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    } finally {
      client.release();
    }
  });

  app.get("/api/reminder/admin/students", authRequired, adminRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        `SELECT
          p.account_id,
          COALESCE(ps.name,'') AS name,
          COALESCE(ps.tags, '[]'::jsonb) AS tags
         FROM permitted_accounts p
         LEFT JOIN party_students ps ON ps.account_id=p.account_id
         WHERE p.role='student' AND p.enabled=TRUE
         ORDER BY p.account_id ASC
         LIMIT 2000`,
      );
      const items = (resp.rows || []).map((r) => ({
        accountId: String(r.account_id ?? ""),
        name: String(r.name ?? ""),
        tags: normalizeStringArray(r.tags),
      }));
      ok(res, { items });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.put("/api/reminder/admin/students/:accountId/tags", authRequired, adminRequired, async (req, res) => {
    try {
      const accountId = normalizeAccountId(req.params.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const tags = normalizeStringArray(req.body?.tags);
      const now = Date.now();
      await ensurePartyStudentRowExists(pool, accountId, now);
      await pool.query("UPDATE party_students SET tags=$2::jsonb, updated_at=$3 WHERE account_id=$1", [
        accountId,
        JSON.stringify(tags),
        now,
      ]);
      ok(res, { ok: true });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/cert/templates", authRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        "SELECT id, title, category, format, enabled, created_at, updated_at FROM document_templates WHERE enabled=TRUE ORDER BY updated_at DESC LIMIT 200",
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        category: String(r.category ?? ""),
        format: String(r.format ?? ""),
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { items });
    } catch (e) {
      if (String(e?.code || "") === "42P01") {
        fail(res, "SCHEMA_MISSING", "数据库表未初始化，请先执行 schema.sql", 500);
        return;
      }
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/cert/admin/templates", authRequired, adminRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        "SELECT id, title, category, format, storage_path, enabled, created_by, created_at, updated_at FROM document_templates ORDER BY updated_at DESC LIMIT 500",
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        category: String(r.category ?? ""),
        format: String(r.format ?? ""),
        storagePath: String(r.storage_path ?? ""),
        enabled: !!r.enabled,
        createdBy: String(r.created_by ?? ""),
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { items });
    } catch (e) {
      if (String(e?.code || "") === "42P01") {
        fail(res, "SCHEMA_MISSING", "数据库表未初始化，请先执行 schema.sql", 500);
        return;
      }
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/cert/admin/templates", authRequired, adminRequired, async (req, res) => {
    try {
      const title = String(req.body?.title ?? "").trim();
      const category = String(req.body?.category ?? "").trim();
      const formatRaw = String(req.body?.format ?? "").trim().toLowerCase();
      const format = formatRaw === "xlsx" ? "xlsx" : formatRaw === "txt" ? "txt" : "html";
      const fileNameRaw = String(req.body?.fileName ?? "").trim();
      const fileBase64 = String(req.body?.fileBase64 ?? "").trim();

      if (!title) return fail(res, "EMPTY_TITLE", "请填写模板标题");
      if (!fileNameRaw) return fail(res, "EMPTY_FILENAME", "请选择文件");
      if (!fileBase64) return fail(res, "EMPTY_FILE", "缺少文件内容");

      const safeName = fileNameRaw.replace(/[^\w.\-()\u4e00-\u9fa5]+/g, "_").slice(0, 80) || "template";
      const ext = path.extname(safeName).toLowerCase();
      const wantExt = format === "xlsx" ? ".xlsx" : format === "txt" ? ".txt" : ".html";
      const finalName = ext ? safeName : `${safeName}${wantExt}`;
      const stamp = Date.now();
      const rand = crypto.randomBytes(6).toString("hex");
      const storedName = `${stamp}_${rand}_${finalName}`;
      const relPath = `templates/uploads/${storedName}`;
      const full = resolveStoragePath(relPath);
      if (!full) return fail(res, "INVALID_PATH", "文件路径非法", 400);

      ensureDirSync(TEMPLATE_UPLOAD_DIR);

      const buf = Buffer.from(fileBase64, "base64");
      if (!buf.length) return fail(res, "EMPTY_FILE", "文件为空");
      if (buf.length > 5 * 1024 * 1024) return fail(res, "FILE_TOO_LARGE", "文件过大（最大 5MB）");
      fs.writeFileSync(full, buf);

      const now = Date.now();
      const createdBy = normalizeAccountId(req.user?.accountId) || "admin";
      const insert = await pool.query(
        "INSERT INTO document_templates (title, category, format, storage_path, enabled, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id",
        [title, category, format, relPath, true, createdBy, now],
      );
      ok(res, { ok: true, id: Number(insert.rows?.[0]?.id || 0) });
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/cert/templates/:id/file", authRequired, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const resp = await pool.query(
        "SELECT id, title, format, storage_path, enabled FROM document_templates WHERE id=$1 LIMIT 1",
        [id],
      );
      const row = resp.rows?.[0] || null;
      if (!row || !row.enabled) return fail(res, "NOT_FOUND", "模板不存在", 404);

      const full = resolveStoragePath(row.storage_path);
      if (!full || !fs.existsSync(full)) return fail(res, "FILE_NOT_FOUND", "模板文件不存在", 404);

      const format = String(row.format ?? "");
      const mime =
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : format === "txt"
            ? "text/plain; charset=utf-8"
            : "text/html; charset=utf-8";
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `attachment; filename="template_${id}${format === "xlsx" ? ".xlsx" : format === "txt" ? ".txt" : ".html"}"`);
      fs.createReadStream(full).pipe(res);
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/cert/templates/:id/pdf", authRequired, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const resp = await pool.query(
        "SELECT id, title, format, storage_path, enabled FROM document_templates WHERE id=$1 LIMIT 1",
        [id],
      );
      const tpl = resp.rows?.[0] || null;
      if (!tpl || !tpl.enabled) return fail(res, "NOT_FOUND", "模板不存在", 404);
      if (String(tpl.format) === "xlsx") return fail(res, "NOT_SUPPORTED", "暂不支持 xlsx 自动生成 PDF", 400);

      const full = resolveStoragePath(tpl.storage_path);
      if (!full || !fs.existsSync(full)) return fail(res, "FILE_NOT_FOUND", "模板文件不存在", 404);

      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const now = Date.now();
      await ensurePartyStudentRowExists(pool, accountId, now);
      const profileResp = await pool.query("SELECT * FROM party_students WHERE account_id=$1 LIMIT 1", [accountId]);
      const profile = profileResp.rows?.[0] || {};

      const values = {
        accountId,
        name: String(profile.name ?? "") || accountId,
        college: String(req.query?.college ?? ""),
        platoon: String(req.query?.platoon ?? ""),
        reason: String(req.query?.reason ?? ""),
        proof: String(req.query?.proof ?? ""),
        date: toYmd(new Date()),
      };

      const raw = fs.readFileSync(full, "utf8");
      const rendered = renderTemplateText(raw, values);
      const html = wrapHtml(rendered);

      let puppeteer;
      try {
        puppeteer = require("puppeteer");
      } catch {
        fail(res, "DEPENDENCY_MISSING", "缺少依赖 puppeteer，请在 server 目录执行 npm install", 500);
        return;
      }

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "load" });
        const pdf = await page.pdf({ format: "A4", printBackground: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="template_${id}.pdf"`);
        res.end(pdf);
      } finally {
        await browser.close();
      }
    } catch (e) {
      const mapped = mapPdfErrorMessage(e);
      fail(res, mapped.code, mapped.message, 500);
    }
  });

  app.get("/api/honor/users", authRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        `SELECT
          h.account_id,
          COALESCE(ps.name,'') AS name,
          COUNT(h.id) AS public_count,
          MAX(h.updated_at) AS updated_at
         FROM honor_items h
         LEFT JOIN party_students ps ON ps.account_id=h.account_id
         WHERE h.is_public=TRUE
         GROUP BY h.account_id, ps.name
         ORDER BY updated_at DESC
         LIMIT 500`,
      );
      const items = (resp.rows || []).map((r) => ({
        accountId: String(r.account_id ?? ""),
        name: String(r.name ?? ""),
        publicCount: Number(r.public_count || 0),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { items });
    } catch (e) {
      const mapped = mapHonorDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/honor/users/:accountId", authRequired, async (req, res) => {
    try {
      const accountId = normalizeAccountId(req.params.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const user = await pool.query("SELECT COALESCE(name,'') AS name FROM party_students WHERE account_id=$1 LIMIT 1", [
        accountId,
      ]);
      const name = String(user.rows?.[0]?.name ?? "");
      const resp = await pool.query(
        "SELECT id, title, description, issuer, honor_date, image_path, is_public, created_at, updated_at FROM honor_items WHERE account_id=$1 AND is_public=TRUE ORDER BY updated_at DESC LIMIT 50",
        [accountId],
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        description: String(r.description ?? ""),
        issuer: String(r.issuer ?? ""),
        honorDate: toYmd(r.honor_date),
        imagePath: String(r.image_path ?? ""),
        isPublic: !!r.is_public,
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { user: { accountId, name }, items });
    } catch (e) {
      const mapped = mapHonorDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/honor/me", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const resp = await pool.query(
        "SELECT id, title, description, issuer, honor_date, image_path, is_public, created_at, updated_at FROM honor_items WHERE account_id=$1 ORDER BY updated_at DESC LIMIT 10",
        [accountId],
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        description: String(r.description ?? ""),
        issuer: String(r.issuer ?? ""),
        honorDate: toYmd(r.honor_date),
        imagePath: String(r.image_path ?? ""),
        isPublic: !!r.is_public,
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { items });
    } catch (e) {
      const mapped = mapHonorDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/honor/me", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const count = await pool.query("SELECT COUNT(1) AS c FROM honor_items WHERE account_id=$1", [accountId]);
      if (Number(count.rows?.[0]?.c || 0) >= 10) return fail(res, "LIMIT_EXCEEDED", "最多只能上传10条荣誉");

      const title = String(req.body?.title ?? "").trim();
      if (!title) return fail(res, "EMPTY_TITLE", "请填写荣誉名称");
      const description = String(req.body?.description ?? "").trim();
      const issuer = String(req.body?.issuer ?? "").trim();
      const honorDate = normalizeYmdInput(req.body?.honorDate);
      const isPublic = req.body?.isPublic === false ? false : true;
      const imagePath = String(req.body?.imagePath ?? "").trim();

      const now = Date.now();
      const insert = await pool.query(
        "INSERT INTO honor_items (account_id, title, description, issuer, honor_date, image_path, is_public, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id",
        [accountId, title, description, issuer, honorDate, imagePath, isPublic, now],
      );
      ok(res, { ok: true, id: Number(insert.rows?.[0]?.id || 0) });
    } catch (e) {
      const mapped = mapHonorDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.put("/api/honor/me/:id", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");

      const title = String(req.body?.title ?? "").trim();
      if (!title) return fail(res, "EMPTY_TITLE", "请填写荣誉名称");
      const description = String(req.body?.description ?? "").trim();
      const issuer = String(req.body?.issuer ?? "").trim();
      const honorDate = normalizeYmdInput(req.body?.honorDate);
      const isPublic = req.body?.isPublic === false ? false : true;
      const imagePath = String(req.body?.imagePath ?? "").trim();

      const now = Date.now();
      const upd = await pool.query(
        "UPDATE honor_items SET title=$3, description=$4, issuer=$5, honor_date=$6, image_path=$7, is_public=$8, updated_at=$9 WHERE id=$1 AND account_id=$2",
        [id, accountId, title, description, issuer, honorDate, imagePath, isPublic, now],
      );
      if (!upd.rowCount) return fail(res, "NOT_FOUND", "记录不存在", 404);
      ok(res, { ok: true });
    } catch (e) {
      const mapped = mapHonorDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.delete("/api/honor/me/:id", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const del = await pool.query("DELETE FROM honor_items WHERE id=$1 AND account_id=$2", [id, accountId]);
      if (!del.rowCount) return fail(res, "NOT_FOUND", "记录不存在", 404);
      ok(res, { ok: true });
    } catch (e) {
      const mapped = mapHonorDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/honor/me/upload", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      let Busboy;
      try {
        Busboy = require("busboy");
      } catch {
        fail(res, "DEPENDENCY_MISSING", "缺少依赖 busboy，请在 server 目录执行 npm install", 500);
        return;
      }

      const busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
      let savedRel = "";
      let gotFile = false;

      busboy.on("file", (fieldname, file, info) => {
        gotFile = true;
        const filename = safeFileBaseName(info?.filename || "image");
        const ext = path.extname(filename).toLowerCase();
        const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
        const finalExt = allowed.has(ext) ? ext : ".jpg";
        const stamp = Date.now();
        const rand = crypto.randomBytes(6).toString("hex");
        const stored = `${accountId}_${stamp}_${rand}${finalExt}`;
  // return a path that starts with a leading slash so frontend can use it as an absolute URL
  const rel = (`/uploads/honor/${stored}`).replace(/\\/g, "/");
        const full = resolveStoragePath(rel);
        if (!full) {
          file.resume();
          return;
        }
        savedRel = `/${rel}`;
        const ws = fs.createWriteStream(full);
        file.pipe(ws);
      });

      busboy.on("finish", () => {
        if (!gotFile || !savedRel) {
          fail(res, "EMPTY_FILE", "未选择图片文件", 400);
          return;
        }
        ok(res, { path: savedRel });
      });

      req.pipe(busboy);
    } catch (e) {
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  function defaultSemesterFromNow() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return m <= 7 ? `${y}-春` : `${y}-秋`;
  }

  app.get("/api/academic/plans", authRequired, async (req, res) => {
    try {
      const resp = await pool.query("SELECT id, name, updated_at FROM training_plans ORDER BY updated_at DESC LIMIT 500");
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        name: String(r.name ?? ""),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { items });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/academic/student/report", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const tags = await getStudentTags(pool, accountId);
      const requestedPlanName = String(req.query?.planName ?? "").trim();
      let planName = requestedPlanName || extractPlanNameFromTags(tags);
      if (!planName) {
        const plans = await pool.query("SELECT name FROM training_plans ORDER BY updated_at DESC LIMIT 500");
        const names = (plans.rows || []).map((r) => String(r.name ?? "")).filter(Boolean);
        if (names.length === 1) planName = names[0];
        else return fail(res, "NO_PLAN_SELECTED", names.length ? `请选择培养方案：${names.slice(0, 10).join("、")}` : "暂无培养方案，请联系管理员配置", 400);
      }

      const planResp = await pool.query("SELECT id, name, modules, updated_at FROM training_plans WHERE name=$1 LIMIT 1", [
        planName,
      ]);
      const plan = planResp.rows?.[0] || null;
      if (!plan) return fail(res, "PLAN_NOT_FOUND", "培养方案不存在，请联系管理员配置", 404);

      const latest = await pool.query(
        "SELECT id, plan_name, source_format, file_path, parsed_file_path, parsed_summary, courses, created_at FROM student_transcripts WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1",
        [accountId],
      );
      const row = latest.rows?.[0] || null;
      if (!row) return ok(res, { hasTranscript: false, planName: String(plan.name ?? ""), modules: plan.modules || [] });

      const semester = String(req.query?.semester ?? "").trim() || defaultSemesterFromNow();
      const semResp = await pool.query(
        "SELECT semester, course_code, course_name, credits, module_name FROM semester_courses WHERE semester=$1 ORDER BY course_code ASC, course_name ASC LIMIT 2000",
        [semester],
      );
      const semesterCourses = (semResp.rows || []).map((r) => ({
        semester: String(r.semester ?? ""),
        courseCode: String(r.course_code ?? ""),
        courseName: String(r.course_name ?? ""),
        credits: Number(r.credits || 0),
        moduleName: String(r.module_name ?? ""),
      }));

      const report = buildAcademicReport({
        plan: { name: plan.name, modules: plan.modules },
        transcriptCourses: Array.isArray(row.courses) ? row.courses : normalizeKeywordsField(row.courses),
        semesterCourses,
        semester,
      });
      ok(res, {
        hasTranscript: true,
        transcript: {
          id: String(row.id),
          createdAt: Number(row.created_at || 0),
          filePath: String(row.file_path ?? "") === TRANSCRIPT_PATH_PLACEHOLDER ? "" : String(row.file_path ?? ""),
          parsedFilePath:
            String(row.parsed_file_path ?? "") === TRANSCRIPT_PATH_PLACEHOLDER ? "" : String(row.parsed_file_path ?? ""),
          parsedSummary: row.parsed_summary || {},
          sourceFormat: String(row.source_format ?? ""),
          planNameAtUpload: String(row.plan_name ?? ""),
        },
        ...report,
      });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/academic/student/transcript/upload", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const tags = await getStudentTags(pool, accountId);
      const requestedPlanName = String(req.query?.planName ?? "").trim();
      let planName = requestedPlanName || extractPlanNameFromTags(tags);
      if (!planName) {
        const plans = await pool.query("SELECT name FROM training_plans ORDER BY updated_at DESC LIMIT 500");
        const names = (plans.rows || []).map((r) => String(r.name ?? "")).filter(Boolean);
        if (names.length === 1) planName = names[0];
        else return fail(res, "NO_PLAN_SELECTED", names.length ? `请选择培养方案：${names.slice(0, 10).join("、")}` : "暂无培养方案，请联系管理员配置", 400);
      }

      const planResp = await pool.query("SELECT id, name, modules, updated_at FROM training_plans WHERE name=$1 LIMIT 1", [planName]);
      const plan = planResp.rows?.[0] || null;
      if (!plan) return fail(res, "PLAN_NOT_FOUND", "培养方案不存在，请联系管理员配置", 404);

      let Busboy;
      try {
        Busboy = require("busboy");
      } catch {
        fail(res, "DEPENDENCY_MISSING", "缺少依赖 busboy，请在 server 目录执行 npm install", 500);
        return;
      }

      const busboy = Busboy({ headers: req.headers, limits: { fileSize: 6 * 1024 * 1024, files: 1 } });
      let gotFile = false;
      let originalName = "";
      let mime = "";
      const chunks = [];

      busboy.on("file", (fieldname, file, info) => {
        gotFile = true;
        originalName = String(info?.filename || "transcript");
        mime = String(info?.mimeType || "");
        file.on("data", (d) => {
          chunks.push(d);
        });
      });

      busboy.on("finish", async () => {
        if (!gotFile) return fail(res, "EMPTY_FILE", "未选择文件", 400);
        const buf = Buffer.concat(chunks);
        if (!buf.length) return fail(res, "EMPTY_FILE", "文件为空", 400);

        let parsed;
        try {
          parsed = await parseTranscriptFile({ filename: originalName, mime, buffer: buf });
        } catch (e2) {
          const msg = String(e2?.message || "");
          return fail(res, String(e2?.code || "PARSE_FAILED"), msg || "成绩单解析失败", 400);
        }

        const courses = Array.isArray(parsed.courses) ? parsed.courses : [];
        if (!courses.length) return fail(res, "NO_COURSES", "未识别到课程信息，请上传HTML/CSV格式的成绩单", 400);

        const now = Date.now();
        const parseSummary = buildTranscriptParseSummary({
          sourceFormat: parsed.format,
          courses,
        });
        await pool.query(
          "INSERT INTO student_transcripts (account_id, plan_name, source_format, file_path, parsed_file_path, parsed_summary, courses, created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)",
          [
            accountId,
            planName,
            parsed.format,
            TRANSCRIPT_PATH_PLACEHOLDER,
            TRANSCRIPT_PATH_PLACEHOLDER,
            JSON.stringify(parseSummary),
            JSON.stringify(courses),
            now,
          ],
        );

        const semester = String(req.query?.semester ?? "").trim() || defaultSemesterFromNow();
        const semResp = await pool.query(
          "SELECT semester, course_code, course_name, credits, module_name FROM semester_courses WHERE semester=$1 ORDER BY course_code ASC, course_name ASC LIMIT 2000",
          [semester],
        );
        const semesterCourses = (semResp.rows || []).map((r) => ({
          semester: String(r.semester ?? ""),
          courseCode: String(r.course_code ?? ""),
          courseName: String(r.course_name ?? ""),
          credits: Number(r.credits || 0),
          moduleName: String(r.module_name ?? ""),
        }));

        const report = buildAcademicReport({
          plan: { name: plan.name, modules: plan.modules },
          transcriptCourses: courses,
          semesterCourses,
          semester,
        });
        ok(res, { ok: true, uploadedAt: now, filePath: "", ...report });
      });

      req.pipe(busboy);
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/academic/admin/plans", authRequired, adminRequired, async (req, res) => {
    try {
      const resp = await pool.query("SELECT id, name, modules, updated_at FROM training_plans ORDER BY updated_at DESC LIMIT 200");
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        name: String(r.name ?? ""),
        modules: r.modules || [],
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { items });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/academic/admin/plans/import", authRequired, adminRequired, async (req, res) => {
    try {
      let Busboy;
      try {
        Busboy = require("busboy");
      } catch {
        fail(res, "DEPENDENCY_MISSING", "缺少依赖 busboy，请在 server 目录执行 npm install", 500);
        return;
      }

      const busboy = Busboy({ headers: req.headers, limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 20 } });
      let planName = "";
      let gotFile = false;
      let originalName = "";
      let mime = "";
      const chunks = [];

      busboy.on("field", (fieldname, val) => {
        if (fieldname === "name") planName = String(val ?? "").trim();
      });

      busboy.on("file", (fieldname, file, info) => {
        gotFile = true;
        originalName = String(info?.filename || "plan");
        mime = String(info?.mimeType || "");
        file.on("data", (d) => chunks.push(d));
      });

      busboy.on("finish", async () => {
        if (!planName) return fail(res, "EMPTY_NAME", "请填写培养方案名称", 400);
        if (!gotFile) return fail(res, "EMPTY_FILE", "未选择文件", 400);
        const buf = Buffer.concat(chunks);
        if (!buf.length) return fail(res, "EMPTY_FILE", "文件为空", 400);

        let parsed;
        try {
          parsed = await parseTrainingPlanFile({ filename: originalName, mime, buffer: buf });
        } catch (e2) {
          return fail(res, String(e2?.code || "PARSE_FAILED"), String(e2?.message || "导入失败"), 400);
        }

        const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
        if (!modules.length) return fail(res, "EMPTY_MODULES", "未识别到培养方案课程信息，请检查文件格式", 400);

        const now = Date.now();
        const existing = await pool.query("SELECT id FROM training_plans WHERE name=$1 LIMIT 1", [planName]);
        const existingId = Number(existing.rows?.[0]?.id || 0);
        if (existingId) {
          await pool.query("UPDATE training_plans SET modules=$2::jsonb, updated_at=$3 WHERE id=$1", [
            existingId,
            JSON.stringify(modules),
            now,
          ]);
          ok(res, { ok: true, id: existingId, name: planName, modules, updatedAt: now, sourceFormat: parsed.format });
          return;
        }

        const ins = await pool.query(
          "INSERT INTO training_plans (name, modules, updated_at) VALUES ($1,$2::jsonb,$3) RETURNING id",
          [planName, JSON.stringify(modules), now],
        );
        ok(res, {
          ok: true,
          id: Number(ins.rows?.[0]?.id || 0),
          name: planName,
          modules,
          updatedAt: now,
          sourceFormat: parsed.format,
        });
      });

      req.pipe(busboy);
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/academic/admin/plans", authRequired, adminRequired, async (req, res) => {
    try {
      const name = String(req.body?.name ?? "").trim();
      if (!name) return fail(res, "EMPTY_NAME", "请填写培养方案名称");
      let modules = req.body?.modules;
      if (typeof modules === "string") {
        try {
          modules = JSON.parse(modules);
        } catch {
          return fail(res, "INVALID_MODULES", "modules 不是合法 JSON", 400);
        }
      }
      if (!Array.isArray(modules)) return fail(res, "INVALID_MODULES", "modules 必须是数组", 400);
      const now = Date.now();
      const ins = await pool.query(
        "INSERT INTO training_plans (name, modules, updated_at) VALUES ($1,$2::jsonb,$3) RETURNING id",
        [name, JSON.stringify(modules), now],
      );
      ok(res, { ok: true, id: Number(ins.rows?.[0]?.id || 0) });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.put("/api/academic/admin/plans/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const name = String(req.body?.name ?? "").trim();
      if (!name) return fail(res, "EMPTY_NAME", "请填写培养方案名称");
      let modules = req.body?.modules;
      if (typeof modules === "string") {
        try {
          modules = JSON.parse(modules);
        } catch {
          return fail(res, "INVALID_MODULES", "modules 不是合法 JSON", 400);
        }
      }
      if (!Array.isArray(modules)) return fail(res, "INVALID_MODULES", "modules 必须是数组", 400);
      const now = Date.now();
      const upd = await pool.query("UPDATE training_plans SET name=$2, modules=$3::jsonb, updated_at=$4 WHERE id=$1", [
        id,
        name,
        JSON.stringify(modules),
        now,
      ]);
      if (!upd.rowCount) return fail(res, "NOT_FOUND", "培养方案不存在", 404);
      ok(res, { ok: true });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.delete("/api/academic/admin/plans/:id", authRequired, adminRequired, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const del = await pool.query("DELETE FROM training_plans WHERE id=$1", [id]);
      if (!del.rowCount) return fail(res, "NOT_FOUND", "培养方案不存在", 404);
      ok(res, { ok: true });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/academic/admin/semester-courses", authRequired, adminRequired, async (req, res) => {
    try {
      const semester = String(req.query?.semester ?? "").trim() || defaultSemesterFromNow();
      const resp = await pool.query(
        "SELECT id, semester, course_code, course_name, credits, module_name, updated_at FROM semester_courses WHERE semester=$1 ORDER BY course_code ASC, course_name ASC LIMIT 2000",
        [semester],
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        semester: String(r.semester ?? ""),
        courseCode: String(r.course_code ?? ""),
        courseName: String(r.course_name ?? ""),
        credits: Number(r.credits || 0),
        moduleName: String(r.module_name ?? ""),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { semester, items });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/academic/admin/semester-courses", authRequired, adminRequired, async (req, res) => {
    try {
      const semester = String(req.body?.semester ?? "").trim() || defaultSemesterFromNow();
      const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!itemsRaw.length) return fail(res, "EMPTY_ITEMS", "缺少课程列表", 400);
      const now = Date.now();

      const cleaned = [];
      for (const it of itemsRaw) {
        const courseCode = normalizeCourseCode(it?.courseCode);
        const courseName = normalizeCourseName(it?.courseName);
        const credits = Number(it?.credits || 0);
        const moduleName = String(it?.moduleName ?? "").trim();
        if (!courseCode && !courseName) continue;
        cleaned.push({ semester, courseCode, courseName, credits, moduleName });
      }
      if (!cleaned.length) return fail(res, "EMPTY_ITEMS", "课程列表为空", 400);

      const chunkSize = 200;
      for (let i = 0; i < cleaned.length; i += chunkSize) {
        const chunk = cleaned.slice(i, i + chunkSize);
        const params = [];
        const values = [];
        for (let k = 0; k < chunk.length; k += 1) {
          const base = k * 6;
          params.push(chunk[k].semester, chunk[k].courseCode, chunk[k].courseName, chunk[k].credits, chunk[k].moduleName, now);
          values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
        }
        await pool.query(
          `INSERT INTO semester_courses (semester, course_code, course_name, credits, module_name, updated_at)
           VALUES ${values.join(",")}
           ON CONFLICT (semester, course_code, course_name)
           DO UPDATE SET credits=EXCLUDED.credits, module_name=EXCLUDED.module_name, updated_at=EXCLUDED.updated_at`,
          params,
        );
      }

      ok(res, { ok: true, semester, saved: cleaned.length });
    } catch (e) {
      const mapped = mapAcademicDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/activity/me", authRequired, async (req, res) => {
    try {
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

      const resp = await pool.query(
        `SELECT
          a.id,
          a.title,
          a.summary,
          a.activity_date,
          a.target_tag,
          a.photo_paths,
          a.status,
          COALESCE(r.reason,'') AS reject_reason,
          a.created_by,
          a.created_at,
          a.updated_at,
          p.role
         FROM class_activity_participants p
         JOIN class_activities a ON a.id=p.activity_id
         LEFT JOIN class_activity_rejections r ON r.activity_id=a.id
         WHERE p.account_id=$1 AND a.status='approved'
         ORDER BY a.activity_date DESC NULLS LAST, a.updated_at DESC
         LIMIT 200`,
        [accountId],
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        summary: String(r.summary ?? ""),
        activityDate: toYmd(r.activity_date),
        targetTag: String(r.target_tag ?? ""),
        photoPaths: normalizeStringArray(r.photo_paths),
        status: String(r.status ?? ""),
        rejectReason: String(r.reject_reason ?? ""),
        createdBy: String(r.created_by ?? ""),
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0),
        myRole: String(r.role ?? "participant"),
      }));
      ok(res, { items });
    } catch (e) {
      const mapped = mapActivityDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/activity/cadre/mine", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const tags = await getStudentTags(pool, accountId);
      if (!hasTag(tags, "班团骨干")) return fail(res, "NOT_CADRE", "无班团骨干权限", 403);

      const resp = await pool.query(
        `SELECT
          a.id,
          a.title,
          a.summary,
          a.activity_date,
          a.target_tag,
          a.photo_paths,
          a.status,
          COALESCE(r.reason,'') AS reject_reason,
          a.created_by,
          a.created_at,
          a.updated_at,
          COALESCE(rv.reviewed_by,'') AS reviewed_by,
          COALESCE(rv.reviewed_at,0) AS reviewed_at,
          COALESCE(pc.participant_count,0) AS participant_count
         FROM class_activities a
         LEFT JOIN (
          SELECT activity_id, COUNT(id) AS participant_count
          FROM class_activity_participants
          GROUP BY activity_id
         ) pc ON pc.activity_id=a.id
         LEFT JOIN class_activity_reviews rv ON rv.activity_id=a.id
         LEFT JOIN class_activity_rejections r ON r.activity_id=a.id
         WHERE a.created_by=$1
         ORDER BY a.updated_at DESC
         LIMIT 200`,
        [accountId],
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        summary: String(r.summary ?? ""),
        activityDate: toYmd(r.activity_date),
        targetTag: String(r.target_tag ?? ""),
        photoPaths: normalizeStringArray(r.photo_paths),
        status: String(r.status ?? ""),
        rejectReason: String(r.reject_reason ?? ""),
        createdBy: String(r.created_by ?? ""),
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0),
        reviewedBy: String(r.reviewed_by ?? ""),
        reviewedAt: Number(r.reviewed_at || 0),
        participantCount: Number(r.participant_count || 0),
      }));
      ok(res, { items });
    } catch (e) {
      const mapped = mapActivityDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/activity/cadre", authRequired, async (req, res) => {
    const accountId = normalizeAccountId(req.user?.accountId);
    if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
    if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");

    try {
      const tags = await getStudentTags(pool, accountId);
      if (!hasTag(tags, "班团骨干")) return fail(res, "NOT_CADRE", "无班团骨干权限", 403);

      const title = String(req.body?.title ?? "").trim();
      if (!title) return fail(res, "EMPTY_TITLE", "请填写活动标题");
      const summary = String(req.body?.summary ?? "").trim();
      const activityDate = normalizeYmdInput(req.body?.activityDate);
      const targetTag = String(req.body?.targetTag ?? "").trim();
      const photoPaths = normalizeStringArray(req.body?.photoPaths);
      const participantsRaw = req.body?.participants || {};
      const organizers = normalizeStringArray(participantsRaw.organizers);
      const helpers = normalizeStringArray(participantsRaw.helpers);
      const participants = normalizeStringArray(participantsRaw.participants);

      let finalParticipants = participants;
      if (!finalParticipants.length && targetTag) {
        const perm = await pool.query(
          "SELECT account_id FROM permitted_accounts WHERE role='student' AND enabled=TRUE ORDER BY account_id ASC",
        );
        const allAccounts = (perm.rows || []).map((r) => normalizeAccountId(r.account_id)).filter(Boolean);
        const tagResp = await pool.query("SELECT account_id, tags FROM party_students");
        const tagMap = new Map();
        for (const row of tagResp.rows || []) {
          const id = normalizeAccountId(row.account_id);
          if (!id) continue;
          tagMap.set(id, normalizeStringArray(row.tags));
        }
        finalParticipants = allAccounts.filter((id) => (tagMap.get(id) || []).includes(targetTag));
      }

      const now = Date.now();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const ins = await client.query(
          `INSERT INTO class_activities
            (title, summary, activity_date, target_tag, photo_paths, status, created_by, created_at, updated_at)
           VALUES
            ($1,$2,$3,$4,$5::jsonb,'pending',$6,$7,$7)
           RETURNING id`,
          [title, summary, activityDate, targetTag, JSON.stringify(photoPaths), accountId, now],
        );
        const activityId = Number(ins.rows?.[0]?.id || 0);
        if (!activityId) throw new Error("CREATE_ACTIVITY_FAILED");

        const rows = [];
        for (const id of organizers) rows.push({ accountId: id, role: "organizer" });
        for (const id of helpers) rows.push({ accountId: id, role: "helper" });
        for (const id of finalParticipants) rows.push({ accountId: id, role: "participant" });
        const uniq = new Set();
        const normalizedRows = [];
        for (const r of rows) {
          const aid = normalizeAccountId(r.accountId);
          if (!aid) continue;
          const key = `${aid}::${r.role}`;
          if (uniq.has(key)) continue;
          uniq.add(key);
          normalizedRows.push({ accountId: aid, role: r.role });
        }
        const chunkSize = 200;
        for (let i = 0; i < normalizedRows.length; i += chunkSize) {
          const chunk = normalizedRows.slice(i, i + chunkSize);
          const params = [];
          const values = [];
          for (let k = 0; k < chunk.length; k += 1) {
            const base = k * 4;
            params.push(activityId, chunk[k].accountId, chunk[k].role, now);
            values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4})`);
          }
          await client.query(
            `INSERT INTO class_activity_participants (activity_id, account_id, role, created_at) VALUES ${values.join(",")}`,
            params,
          );
        }

        await client.query("COMMIT");
        ok(res, { ok: true, id: activityId });
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      const mapped = mapActivityDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.put("/api/activity/cadre/:id", authRequired, async (req, res) => {
    const accountId = normalizeAccountId(req.user?.accountId);
    if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
    if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
    const id = Number(req.params.id);
    if (!id) return fail(res, "EMPTY_ID", "缺少ID");

    try {
      const tags = await getStudentTags(pool, accountId);
      if (!hasTag(tags, "班团骨干")) return fail(res, "NOT_CADRE", "无班团骨干权限", 403);

      const existing = await pool.query(
        "SELECT status FROM class_activities WHERE id=$1 AND created_by=$2 LIMIT 1",
        [id, accountId],
      );
      const row = existing.rows?.[0] || null;
      if (!row) return fail(res, "NOT_FOUND", "活动不存在", 404);
      const status = String(row.status ?? "");
      if (status === "approved") return fail(res, "FORBIDDEN", "已通过审核的活动不可修改", 403);

      const title = String(req.body?.title ?? "").trim();
      if (!title) return fail(res, "EMPTY_TITLE", "请填写活动标题");
      const summary = String(req.body?.summary ?? "").trim();
      const activityDate = normalizeYmdInput(req.body?.activityDate);
      const targetTag = String(req.body?.targetTag ?? "").trim();
      const photoPaths = normalizeStringArray(req.body?.photoPaths);
      const participantsRaw = req.body?.participants || {};
      const organizers = normalizeStringArray(participantsRaw.organizers);
      const helpers = normalizeStringArray(participantsRaw.helpers);
      const participants = normalizeStringArray(participantsRaw.participants);

      const now = Date.now();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "UPDATE class_activities SET title=$2, summary=$3, activity_date=$4, target_tag=$5, photo_paths=$6::jsonb, status='pending', updated_at=$7 WHERE id=$1 AND created_by=$8",
          [id, title, summary, activityDate, targetTag, JSON.stringify(photoPaths), now, accountId],
        );
        await client.query("DELETE FROM class_activity_rejections WHERE activity_id=$1", [id]);
        await client.query("DELETE FROM class_activity_reviews WHERE activity_id=$1", [id]);
        await client.query("DELETE FROM class_activity_participants WHERE activity_id=$1", [id]);

        const rows = [];
        for (const aid of organizers) rows.push({ accountId: aid, role: "organizer" });
        for (const aid of helpers) rows.push({ accountId: aid, role: "helper" });
        for (const aid of participants) rows.push({ accountId: aid, role: "participant" });
        const uniq = new Set();
        const normalizedRows = [];
        for (const r of rows) {
          const aid = normalizeAccountId(r.accountId);
          if (!aid) continue;
          const key = `${aid}::${r.role}`;
          if (uniq.has(key)) continue;
          uniq.add(key);
          normalizedRows.push({ accountId: aid, role: r.role });
        }

        const chunkSize = 200;
        for (let i = 0; i < normalizedRows.length; i += chunkSize) {
          const chunk = normalizedRows.slice(i, i + chunkSize);
          const params = [];
          const values = [];
          for (let k = 0; k < chunk.length; k += 1) {
            const base = k * 4;
            params.push(id, chunk[k].accountId, chunk[k].role, now);
            values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4})`);
          }
          await client.query(
            `INSERT INTO class_activity_participants (activity_id, account_id, role, created_at) VALUES ${values.join(",")}`,
            params,
          );
        }

        await client.query("COMMIT");
        ok(res, { ok: true });
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      const mapped = mapActivityDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/api/activity/admin/pending", authRequired, adminRequired, async (req, res) => {
    try {
      const resp = await pool.query(
        `SELECT
          a.id, a.title, a.summary, a.activity_date, a.target_tag, a.photo_paths, a.status, COALESCE(r.reason,'') AS reject_reason, a.created_by, a.created_at, a.updated_at
         FROM class_activities
         a
         LEFT JOIN class_activity_rejections r ON r.activity_id=a.id
         WHERE a.status='pending'
         ORDER BY a.created_at DESC
         LIMIT 200`,
      );
      const items = (resp.rows || []).map((r) => ({
        _id: String(r.id),
        title: String(r.title ?? ""),
        summary: String(r.summary ?? ""),
        activityDate: toYmd(r.activity_date),
        targetTag: String(r.target_tag ?? ""),
        photoPaths: normalizeStringArray(r.photo_paths),
        status: String(r.status ?? ""),
        rejectReason: String(r.reject_reason ?? ""),
        createdBy: String(r.created_by ?? ""),
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0),
      }));
      ok(res, { items });
    } catch (e) {
      const mapped = mapActivityDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/activity/admin/:id/approve", authRequired, adminRequired, async (req, res) => {
    const debugOn = process.env.NODE_ENV !== "production";
    let step = "init";
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const now = Date.now();
      const tokenBy = normalizeAccountId(req.user?.accountId);
      const bodyBy = normalizeAccountId(req.body?.reviewed_by ?? req.body?.reviewedBy);
      const by = tokenBy || bodyBy || "unknown";
      const client = await pool.connect();
      try {
        step = "begin";
        await client.query("BEGIN");
        step = "update_activity";
        const upd = await client.query(
          "UPDATE class_activities SET status='approved', updated_at=$2 WHERE id=$1 AND status='pending'",
          [id, now],
        );
        if (!upd.rowCount) {
          await client.query("ROLLBACK");
          return fail(res, "NOT_FOUND", "活动不存在或已处理", 404);
        }
        step = "update_activity_review_cols";
        const reviewedByCol = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activities' AND column_name='reviewed_by' LIMIT 1",
        );
        const reviewedAtCol = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activities' AND column_name='reviewed_at' LIMIT 1",
        );
        if (reviewedByCol.rowCount || reviewedAtCol.rowCount) {
          const sets = [];
          const params = [id];
          if (reviewedByCol.rowCount) {
            params.push(by);
            sets.push(`reviewed_by=$${params.length}`);
          }
          if (reviewedAtCol.rowCount) {
            params.push(now);
            sets.push(`reviewed_at=$${params.length}`);
          }
          await client.query(`UPDATE class_activities SET ${sets.join(", ")} WHERE id=$1`, params);
        }
        step = "upsert_review";
        await client.query(
          `INSERT INTO class_activity_reviews (activity_id, reviewed_by, reviewed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (activity_id) DO UPDATE SET reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at`,
          [id, by, now],
        );
        step = "delete_rejection";
        await client.query("DELETE FROM class_activity_rejections WHERE activity_id=$1", [id]);
        step = "commit";
        await client.query("COMMIT");
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw e;
      } finally {
        client.release();
      }
      ok(res, { ok: true });
    } catch (e) {
      const mapped = mapActivityDbError(e);
      const debug = {
        route: "/api/activity/admin/:id/approve",
        method: "POST",
        step,
        id: String(req.params?.id ?? ""),
        user: { role: String(req.user?.role ?? ""), accountId: String(req.user?.accountId ?? "") },
        pg: buildPgDebug(e),
      };
      if (mapped) {
        console.error({ ...debug, mapped });
        return debugOn
          ? failExtra(res, mapped.code, mapped.message, mapped.status, { debug })
          : fail(res, mapped.code, mapped.message, mapped.status);
      }
      console.error({ ...debug, error: String(e?.message || e) });
      return debugOn ? failExtra(res, "SERVER_ERROR", "服务器异常", 500, { debug }) : fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/activity/admin/:id/reject", authRequired, adminRequired, async (req, res) => {
    const debugOn = process.env.NODE_ENV !== "production";
    let step = "init";
    try {
      const id = Number(req.params.id);
      if (!id) return fail(res, "EMPTY_ID", "缺少ID");
      const reason = String(req.body?.reason ?? "").trim();
      const now = Date.now();
      const tokenBy = normalizeAccountId(req.user?.accountId);
      const bodyBy = normalizeAccountId(req.body?.reviewed_by ?? req.body?.reviewedBy);
      const by = tokenBy || bodyBy || "unknown";
      const client = await pool.connect();
      try {
        step = "begin";
        await client.query("BEGIN");
        step = "update_activity";
        const upd = await client.query(
          "UPDATE class_activities SET status='rejected', updated_at=$2 WHERE id=$1 AND status='pending'",
          [id, now],
        );
        if (!upd.rowCount) {
          await client.query("ROLLBACK");
          return fail(res, "NOT_FOUND", "活动不存在或已处理", 404);
        }
        step = "update_activity_review_cols";
        const reviewedByCol = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activities' AND column_name='reviewed_by' LIMIT 1",
        );
        const reviewedAtCol = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activities' AND column_name='reviewed_at' LIMIT 1",
        );
        if (reviewedByCol.rowCount || reviewedAtCol.rowCount) {
          const sets = [];
          const params = [id];
          if (reviewedByCol.rowCount) {
            params.push(by);
            sets.push(`reviewed_by=$${params.length}`);
          }
          if (reviewedAtCol.rowCount) {
            params.push(now);
            sets.push(`reviewed_at=$${params.length}`);
          }
          await client.query(`UPDATE class_activities SET ${sets.join(", ")} WHERE id=$1`, params);
        }
        step = "upsert_review";
        await client.query(
          `INSERT INTO class_activity_reviews (activity_id, reviewed_by, reviewed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (activity_id) DO UPDATE SET reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at`,
          [id, by, now],
        );
        step = "upsert_rejection";
        const rejColsResp = await client.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='class_activity_rejections'",
        );
        const rejCols = new Set((rejColsResp.rows || []).map((r) => String(r.column_name || "")));
        const colNames = ["activity_id"];
        const values = [id];
        if (rejCols.has("reason")) {
          colNames.push("reason");
          values.push(reason);
        }
        const byCol = rejCols.has("reviewed_by") ? "reviewed_by" : rejCols.has("rejected_by") ? "rejected_by" : "";
        if (byCol) {
          colNames.push(byCol);
          values.push(by);
        }
        const atCol = rejCols.has("reviewed_at") ? "reviewed_at" : rejCols.has("rejected_at") ? "rejected_at" : "";
        if (atCol) {
          colNames.push(atCol);
          values.push(now);
        }
        const placeholders = colNames.map((_, idx) => `$${idx + 1}`);
        const updateCols = colNames.filter((c) => c !== "activity_id");
        const updateSql = updateCols.length ? ` DO UPDATE SET ${updateCols.map((c) => `${c}=EXCLUDED.${c}`).join(", ")}` : " DO NOTHING";
        await client.query(
          `INSERT INTO class_activity_rejections (${colNames.join(", ")})
           VALUES (${placeholders.join(", ")})
           ON CONFLICT (activity_id)${updateSql}`,
          values,
        );
        step = "commit";
        await client.query("COMMIT");
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw e;
      } finally {
        client.release();
      }
      ok(res, { ok: true });
    } catch (e) {
      const mapped = mapActivityDbError(e);
      const debug = {
        route: "/api/activity/admin/:id/reject",
        method: "POST",
        step,
        id: String(req.params?.id ?? ""),
        bodyKeys: Object.keys(req.body || {}),
        user: { role: String(req.user?.role ?? ""), accountId: String(req.user?.accountId ?? "") },
        pg: buildPgDebug(e),
      };
      if (mapped) {
        console.error({ ...debug, mapped });
        return debugOn
          ? failExtra(res, mapped.code, mapped.message, mapped.status, { debug })
          : fail(res, mapped.code, mapped.message, mapped.status);
      }
      console.error({ ...debug, error: String(e?.message || e) });
      return debugOn ? failExtra(res, "SERVER_ERROR", "服务器异常", 500, { debug }) : fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.post("/api/activity/cadre/upload", authRequired, async (req, res) => {
    try {
      if (req.user?.role !== "student") return fail(res, "NOT_STUDENT", "无学生权限", 403);
      const accountId = normalizeAccountId(req.user?.accountId);
      if (!accountId) return fail(res, "EMPTY_ACCOUNT", "缺少学号");
      const tags = await getStudentTags(pool, accountId);
      if (!hasTag(tags, "班团骨干")) return fail(res, "NOT_CADRE", "无班团骨干权限", 403);

      let Busboy;
      try {
        Busboy = require("busboy");
      } catch {
        fail(res, "DEPENDENCY_MISSING", "缺少依赖 busboy，请在 server 目录执行 npm install", 500);
        return;
      }

      const busboy = Busboy({ headers: req.headers, limits: { fileSize: 6 * 1024 * 1024, files: 1 } });
      let savedRel = "";
      let gotFile = false;

      busboy.on("file", (fieldname, file, info) => {
        gotFile = true;
        const filename = safeFileBaseName(info?.filename || "image");
        const ext = path.extname(filename).toLowerCase();
        const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
        const finalExt = allowed.has(ext) ? ext : ".jpg";
        const stamp = Date.now();
        const rand = crypto.randomBytes(6).toString("hex");
        const stored = `${accountId}_${stamp}_${rand}${finalExt}`;
        const rel = `uploads/activity/${stored}`.replace(/\\/g, "/");
        const full = resolveStoragePath(rel);
        if (!full) {
          file.resume();
          return;
        }
        savedRel = `/${rel}`;
        const ws = fs.createWriteStream(full);
        file.pipe(ws);
      });

      busboy.on("finish", () => {
        if (!gotFile || !savedRel) {
          fail(res, "EMPTY_FILE", "未选择图片文件", 400);
          return;
        }
        ok(res, { path: savedRel });
      });

      req.pipe(busboy);
    } catch (e) {
      const mapped = mapActivityDbError(e);
      if (mapped) return fail(res, mapped.code, mapped.message, mapped.status);
      fail(res, "SERVER_ERROR", "服务器异常", 500);
    }
  });

  app.get("/health", async (req, res) => {
    try {
      const resp = await pool.query("SELECT 1 AS ok");
      ok(res, { ok: resp?.rows?.[0]?.ok === 1 });
    } catch (e) {
      fail(res, "DB_ERROR", "数据库连接失败", 500);
    }
  });

  const server = app.listen(PORT, () => {});
  server.on("error", (err) => {
    console.error("Server failed to start:", err);
    process.exitCode = 1;
  });
}

main().catch((err) => {
  console.error("Application bootstrap failed:", err);
  process.exitCode = 1;
});
