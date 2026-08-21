-- Run this in your Neon SQL editor

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL DEFAULT '',
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL DEFAULT '',
  credit_hours INTEGER NOT NULL DEFAULT 3,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  target_grade DECIMAL(5,2) NOT NULL DEFAULT 90,
  avg_homework_hours DECIMAL(4,2),        -- user's typical hours per homework assignment
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add column to existing tables (safe to run multiple times)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS avg_homework_hours DECIMAL(4,2);

CREATE TABLE IF NOT EXISTS assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    DATE NOT NULL,
  type        TEXT NOT NULL DEFAULT 'homework',
  weight      DECIMAL(5,2) NOT NULL DEFAULT 10,
  score       DECIMAL(6,2),
  max_score   DECIMAL(6,2) NOT NULL DEFAULT 100,
  tentative   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add tentative column to existing table (safe to run multiple times)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS tentative BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS study_blocks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id    UUID REFERENCES assignments(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  duration         INTEGER NOT NULL DEFAULT 30,
  is_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_study_blocks_course ON study_blocks(course_id);
CREATE INDEX IF NOT EXISTS idx_study_blocks_date ON study_blocks(date);
