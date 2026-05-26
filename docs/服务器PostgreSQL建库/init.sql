-- PostgreSQL 正式服务器初始化脚本
-- 目标：
-- 1. 与 server/schema.sql 保持一致
-- 2. 仅保留正式部署所需的最小初始化数据
-- 3. 不写入大批虚构业务数据
--
-- 使用方式：
-- 1. 先创建数据库，例如：
--    CREATE DATABASE student_service_platform ENCODING 'UTF8';
-- 2. 连接到 student_service_platform 后执行本脚本
--
-- 说明：
-- 1. 示例账号统一使用纯数字 10 位格式
-- 2. users 表不预置密码数据，首次登录时由后端按 permitted_accounts 自动创建账号密码摘要
-- 3. 文档模板按当前真实实现保存为 html 文件，再由 /api/cert/templates/:id/pdf 渲染生成 PDF

BEGIN;

CREATE TABLE IF NOT EXISTS public.permitted_accounts (
  id BIGSERIAL PRIMARY KEY,
  role VARCHAR(16) NOT NULL CHECK (role IN ('student','admin')),
  account_id VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  UNIQUE (role, account_id)
);

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  role VARCHAR(16) NOT NULL CHECK (role IN ('student','admin')),
  account_id VARCHAR(64) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  last_login_at BIGINT NOT NULL,
  UNIQUE (role, account_id)
);

CREATE TABLE IF NOT EXISTS public.knowledge_qa (
  id BIGSERIAL PRIMARY KEY,
  question VARCHAR(512) NOT NULL,
  answer TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.party_students (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  application_date DATE NULL,
  activist_date DATE NULL,
  dev_object_date DATE NULL,
  probationary_date DATE NULL,
  probationary_full_year_date DATE NULL,
  full_member_date DATE NULL,
  current_stage VARCHAR(32) NOT NULL DEFAULT 'group_assessment' CHECK (
    current_stage IN (
      'group_assessment',
      'activist',
      'dev_object',
      'probationary',
      'probationary_full_year',
      'full_member'
    )
  ),
  current_status VARCHAR(128) NOT NULL DEFAULT '',
  next_report_due DATE NULL,
  next_talk_due DATE NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_notifications (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  content TEXT NOT NULL,
  target_type VARCHAR(16) NOT NULL CHECK (target_type IN ('all','tags')),
  target_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(64) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_notification_targets (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  read_at BIGINT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE (notification_id, account_id)
);

CREATE TABLE IF NOT EXISTS public.document_templates (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT '',
  format VARCHAR(16) NOT NULL CHECK (format IN ('html','txt','xlsx')),
  storage_path VARCHAR(512) NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(64) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.honor_items (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  issuer VARCHAR(128) NOT NULL DEFAULT '',
  honor_date DATE NULL,
  image_path VARCHAR(512) NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.class_activities (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  activity_date DATE NULL,
  target_tag VARCHAR(64) NOT NULL DEFAULT '',
  photo_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending','approved','rejected')),
  created_by VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.class_activity_rejections (
  activity_id BIGINT PRIMARY KEY,
  reason VARCHAR(256) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.class_activity_reviews (
  activity_id BIGINT PRIMARY KEY,
  reviewed_by VARCHAR(64) NOT NULL DEFAULT '',
  reviewed_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.class_activity_participants (
  id BIGSERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('participant','organizer','helper')),
  created_at BIGINT NOT NULL,
  UNIQUE (activity_id, account_id, role)
);

CREATE TABLE IF NOT EXISTS public.training_plans (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.semester_courses (
  id BIGSERIAL PRIMARY KEY,
  semester VARCHAR(32) NOT NULL,
  course_code VARCHAR(64) NOT NULL DEFAULT '',
  course_name VARCHAR(128) NOT NULL DEFAULT '',
  credits NUMERIC(6,2) NOT NULL DEFAULT 0,
  module_name VARCHAR(64) NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL,
  UNIQUE (semester, course_code, course_name)
);

CREATE TABLE IF NOT EXISTS public.student_transcripts (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  plan_name VARCHAR(128) NOT NULL DEFAULT '',
  source_format VARCHAR(16) NOT NULL DEFAULT '',
  file_path VARCHAR(512) NOT NULL DEFAULT '',
  parsed_file_path VARCHAR(512) NOT NULL DEFAULT '',
  parsed_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  courses JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL
);

-- 最小权限白名单
-- 账号统一使用纯数字 10 位格式
INSERT INTO public.permitted_accounts (id, role, account_id, enabled, created_at)
VALUES
  (1, 'admin', '2024200001', TRUE, 1740000000000),
  (2, 'student', '2024201575', TRUE, 1740000000000)
ON CONFLICT (role, account_id) DO UPDATE
SET enabled = EXCLUDED.enabled;

-- 最小知识问答
INSERT INTO public.knowledge_qa (id, question, answer, keywords, enabled, created_at, updated_at)
VALUES
  (
    1,
    '系统无法登录时应该先检查什么？',
    '请先检查当前账号是否已加入 permitted_accounts 白名单，再检查后端环境变量中的数据库连接配置是否正确，最后确认数据库服务与后端服务都已正常启动。',
    '["登录","白名单","数据库配置"]'::jsonb,
    TRUE,
    1740000001000,
    1740000001000
  ),
  (
    2,
    '证书模板为什么保存为 html 而不是 pdf？',
    '当前系统的真实实现是先保存 html 模板文件，再由后端读取模板并结合用户信息渲染页面，最后通过 /api/cert/templates/:id/pdf 在线生成 PDF 文件。',
    '["证书","模板","html","pdf"]'::jsonb,
    TRUE,
    1740000002000,
    1740000002000
  )
ON CONFLICT (id) DO UPDATE
SET
  question = EXCLUDED.question,
  answer = EXCLUDED.answer,
  keywords = EXCLUDED.keywords,
  enabled = EXCLUDED.enabled,
  updated_at = EXCLUDED.updated_at;

-- 最小文档模板
-- 这里的 format 必须是 html，因为当前后端会读取 html 文件并动态生成 PDF
-- storage_path 对应 server/template1.html
INSERT INTO public.document_templates (
  id, title, category, format, storage_path, enabled, created_by, created_at, updated_at
)
VALUES
  (
    1,
    '请假条模板',
    '请假条',
    'html',
    'template1.html',
    TRUE,
    'system',
    1740000003000,
    1740000003000
  )
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  format = EXCLUDED.format,
  storage_path = EXCLUDED.storage_path,
  enabled = EXCLUDED.enabled,
  created_by = EXCLUDED.created_by,
  updated_at = EXCLUDED.updated_at;

-- 修正序列，避免显式插入 id 后 nextval 冲突
SELECT setval(pg_get_serial_sequence('public.permitted_accounts', 'id'), COALESCE((SELECT MAX(id) FROM public.permitted_accounts), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.users', 'id'), COALESCE((SELECT MAX(id) FROM public.users), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.knowledge_qa', 'id'), COALESCE((SELECT MAX(id) FROM public.knowledge_qa), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.party_students', 'id'), COALESCE((SELECT MAX(id) FROM public.party_students), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.student_notifications', 'id'), COALESCE((SELECT MAX(id) FROM public.student_notifications), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.student_notification_targets', 'id'), COALESCE((SELECT MAX(id) FROM public.student_notification_targets), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.document_templates', 'id'), COALESCE((SELECT MAX(id) FROM public.document_templates), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.honor_items', 'id'), COALESCE((SELECT MAX(id) FROM public.honor_items), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.class_activities', 'id'), COALESCE((SELECT MAX(id) FROM public.class_activities), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.class_activity_participants', 'id'), COALESCE((SELECT MAX(id) FROM public.class_activity_participants), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.training_plans', 'id'), COALESCE((SELECT MAX(id) FROM public.training_plans), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.semester_courses', 'id'), COALESCE((SELECT MAX(id) FROM public.semester_courses), 1), TRUE);
SELECT setval(pg_get_serial_sequence('public.student_transcripts', 'id'), COALESCE((SELECT MAX(id) FROM public.student_transcripts), 1), TRUE);

COMMIT;
