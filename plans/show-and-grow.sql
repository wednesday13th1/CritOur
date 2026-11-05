-- Additive rollout draft. No existing project becomes visible.
CREATE TABLE cm_showcase (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES studio_projects(id),
 build_id TEXT NOT NULL REFERENCES cm_builds(id), owner_id TEXT NOT NULL REFERENCES member_accounts(id),
 title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('wip','ready')), seeking INTEGER NOT NULL DEFAULT 1,
 visible INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
 UNIQUE(project_id,build_id)
);
CREATE INDEX cm_showcase_feed ON cm_showcase(visible,hidden,updated_at);
CREATE TABLE cm_showcase_comments (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES cm_showcase(id),
 author_id TEXT NOT NULL REFERENCES member_accounts(id), parent_id TEXT REFERENCES cm_showcase_comments(id),
 kind TEXT NOT NULL CHECK(kind IN ('love','idea','confused')), body TEXT NOT NULL,
 hidden INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX cm_showcase_thread ON cm_showcase_comments(listing_id,created_at);
CREATE TABLE cm_showcase_blocks (
 account_id TEXT NOT NULL REFERENCES member_accounts(id), blocked_id TEXT NOT NULL REFERENCES member_accounts(id),
 PRIMARY KEY(account_id,blocked_id)
);
CREATE TABLE cm_showcase_reports (
 reporter_id TEXT NOT NULL REFERENCES member_accounts(id), listing_id TEXT NOT NULL REFERENCES cm_showcase(id),
 target_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(reporter_id,listing_id,target_id)
);
