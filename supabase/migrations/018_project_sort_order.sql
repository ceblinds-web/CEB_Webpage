-- Migration 018: manual ordering for projects (non-destructive)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
