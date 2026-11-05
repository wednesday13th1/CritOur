-- Apply after codemate-mvp.sql.
CREATE TABLE IF NOT EXISTS cm_preview_details (
  build_id TEXT PRIMARY KEY REFERENCES cm_builds(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'game')),
  device TEXT,
  recording_url TEXT
);
