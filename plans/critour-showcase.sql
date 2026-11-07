-- Additive rollout. Existing media and visibility are unchanged.
CREATE TABLE IF NOT EXISTS cr_showcase_media (
 listing_id TEXT PRIMARY KEY REFERENCES cm_showcase(id),
 cover_id TEXT REFERENCES cm_assets(id),
 screenshots TEXT NOT NULL DEFAULT '[]',
 demo_url TEXT,
 video_url TEXT,
 github_url TEXT
);
