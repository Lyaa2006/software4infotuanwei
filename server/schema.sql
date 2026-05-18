CREATE TABLE IF NOT EXISTS permitted_accounts (
  id BIGSERIAL PRIMARY KEY,
  role VARCHAR(16) NOT NULL CHECK (role IN ('student','admin')),
  account_id VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  UNIQUE (role, account_id)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  role VARCHAR(16) NOT NULL CHECK (role IN ('student','admin')),
  account_id VARCHAR(64) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  last_login_at BIGINT NOT NULL,
  UNIQUE (role, account_id)
);

CREATE TABLE IF NOT EXISTS knowledge_qa (
  id BIGSERIAL PRIMARY KEY,
  question VARCHAR(512) NOT NULL,
  answer TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS party_students (
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

CREATE TABLE IF NOT EXISTS student_notifications (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  content TEXT NOT NULL,
  target_type VARCHAR(16) NOT NULL CHECK (target_type IN ('all','tags')),
  target_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(64) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_notification_targets (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  read_at BIGINT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE (notification_id, account_id)
);

CREATE TABLE IF NOT EXISTS document_templates (
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

CREATE TABLE IF NOT EXISTS honor_items (
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

CREATE TABLE IF NOT EXISTS class_activities (
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

CREATE TABLE IF NOT EXISTS class_activity_rejections (
  activity_id BIGINT PRIMARY KEY,
  reason VARCHAR(256) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS class_activity_reviews (
  activity_id BIGINT PRIMARY KEY,
  reviewed_by VARCHAR(64) NOT NULL DEFAULT '',
  reviewed_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS class_activity_participants (
  id BIGSERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('participant','organizer','helper')),
  created_at BIGINT NOT NULL,
  UNIQUE (activity_id, account_id, role)
);

CREATE TABLE IF NOT EXISTS training_plans (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS semester_courses (
  id BIGSERIAL PRIMARY KEY,
  semester VARCHAR(32) NOT NULL,
  course_code VARCHAR(64) NOT NULL DEFAULT '',
  course_name VARCHAR(128) NOT NULL DEFAULT '',
  credits NUMERIC(6,2) NOT NULL DEFAULT 0,
  module_name VARCHAR(64) NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL,
  UNIQUE (semester, course_code, course_name)
);

CREATE TABLE IF NOT EXISTS student_transcripts (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  plan_name VARCHAR(128) NOT NULL DEFAULT '',
  source_format VARCHAR(16) NOT NULL DEFAULT '',
  file_path VARCHAR(512) NOT NULL DEFAULT '',
  courses JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL
);
