const nodemailer = require("nodemailer");

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || String(value).trim() === "" ? fallback : String(value).trim();
}

function isMailEnabled() {
  return env("SMTP_DISABLED", "false") !== "true";
}

function createTransporter() {
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  if (!host || !user || !pass) {
    throw new Error("SMTP 配置不完整，请检查 SMTP_HOST、SMTP_USER、SMTP_PASS");
  }
  const port = Number(env("SMTP_PORT", "465"));
  const secure = env("SMTP_SECURE", "true") === "true";
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: { servername: host },
  });
}

async function sendPasswordResetCode({ to, accountId, code, expiresMinutes }) {
  if (!isMailEnabled()) {
    throw new Error("邮件发送功能已关闭");
  }
  const transporter = createTransporter();
  const from = env("SMTP_FROM", env("SMTP_USER"));
  const subject = "第3组学生服务平台密码重置验证码";
  const text = [
    "您好：",
    "",
    "您正在进行软件工程导论第3组的学生服务平台密码重置操作。",
    "",
    `学号：${accountId}`,
    `验证码：${code}`,
    "",
    `验证码 ${expiresMinutes} 分钟内有效，请勿泄露给他人。`,
    "",
    "如非本人操作，请忽略此邮件。",
  ].join("\n");

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
}

async function sendReminderEmail({ to, title, content }) {
  if (!isMailEnabled()) {
    throw new Error("邮件发送功能已关闭");
  }
  const transporter = createTransporter();
  const from = env("SMTP_FROM", env("SMTP_USER"));
  const safeTitle = String(title || "").trim();
  const safeContent = String(content || "").trim();
  const subject = `第3组学生服务平台通知：${safeTitle}`;
  const text = [
    "您好：",
    "",
    "您收到一条来自软件工程导论第3组学生服务平台的通知。",
    "",
    `通知标题：${safeTitle}`,
    "",
    "通知内容：",
    safeContent,
    "",
    "如对通知内容有疑问，请联系学院相关负责老师或系统管理员。",
  ].join("\n");

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
}

module.exports = {
  sendPasswordResetCode,
  sendReminderEmail,
};
