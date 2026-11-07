-- Additive, local validation first. Never applied to production automatically.
CREATE TABLE IF NOT EXISTS cr_requests (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES cm_showcase(id),
 owner_id TEXT NOT NULL REFERENCES member_accounts(id), kind TEXT NOT NULL CHECK(kind IN ('test','idea','design','code')),
 title TEXT NOT NULL, instructions TEXT NOT NULL, minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 480),
 difficulty TEXT NOT NULL CHECK(difficulty IN ('beginner','intermediate','advanced')), no_code INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cr_request_listing ON cr_requests(listing_id,status,created_at);
CREATE TABLE IF NOT EXISTS cr_contributions (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES cr_requests(id), author_id TEXT NOT NULL REFERENCES member_accounts(id),
 body TEXT NOT NULL, feedback_kind TEXT NOT NULL CHECK(feedback_kind IN ('good','idea','improve')),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewed','adopted','implemented')),
 decision TEXT CHECK(decision IN ('accepted','declined')), improvement TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, mutation TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(request_id,author_id)
);
CREATE INDEX IF NOT EXISTS cr_contribution_author ON cr_contributions(author_id,status,updated_at);
CREATE TABLE IF NOT EXISTS cr_history (
 id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL REFERENCES cr_contributions(id), actor_id TEXT NOT NULL REFERENCES member_accounts(id),
 status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(contribution_id,version)
);
CREATE TABLE IF NOT EXISTS cr_replies (
 id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL REFERENCES cr_contributions(id), author_id TEXT NOT NULL REFERENCES member_accounts(id),
 body TEXT NOT NULL, client_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(author_id,client_id)
);
CREATE TABLE IF NOT EXISTS cr_notifications (
 id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES member_accounts(id), listing_id TEXT NOT NULL REFERENCES cm_showcase(id),
 contribution_id TEXT REFERENCES cr_contributions(id), kind TEXT NOT NULL, title TEXT NOT NULL,
 event_key TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL, UNIQUE(recipient_id,event_key)
);
CREATE INDEX IF NOT EXISTS cr_notification_recipient ON cr_notifications(recipient_id,read_at,created_at);
-- Explicit opt-in publications. Existing listings never become public automatically.
CREATE TABLE IF NOT EXISTS cr_publications (
 token TEXT PRIMARY KEY, listing_id TEXT NOT NULL UNIQUE REFERENCES cm_showcase(id),
 creator_label TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, confirmed_by TEXT NOT NULL REFERENCES member_accounts(id),
 confirmed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cr_public_profiles (
 account_id TEXT PRIMARY KEY REFERENCES member_accounts(id), public_label TEXT NOT NULL DEFAULT '',
 show_name INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cr_impact_publications (
 token TEXT PRIMARY KEY, contribution_id TEXT NOT NULL UNIQUE REFERENCES cr_contributions(id),
 published INTEGER NOT NULL DEFAULT 0, confirmed_by TEXT NOT NULL REFERENCES member_accounts(id), confirmed_at TEXT NOT NULL
);
-- No IP, email, user agent, account ID, arbitrary URL or free-form payload is stored.
CREATE TABLE IF NOT EXISTS cr_analytics (
 event_id TEXT PRIMARY KEY, event TEXT NOT NULL CHECK(event IN ('project_viewed','share_clicked','collaboration_started','contribution_submitted','contribution_accepted','impact_viewed','returning_user')),
 visitor TEXT NOT NULL, listing_id TEXT NOT NULL REFERENCES cm_showcase(id), source TEXT NOT NULL CHECK(source IN ('direct','share')),
 occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cr_analytics_time ON cr_analytics(occurred_at,event);
CREATE TABLE IF NOT EXISTS cr_feedback_links (
 contribution_id TEXT PRIMARY KEY REFERENCES cr_contributions(id),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('showcase','internal')), source_id TEXT NOT NULL,
 linked_by TEXT NOT NULL REFERENCES member_accounts(id), linked_at TEXT NOT NULL,
 UNIQUE(source_kind,source_id)
);
CREATE TABLE IF NOT EXISTS cr_request_details (
 request_id TEXT PRIMARY KEY REFERENCES cr_requests(id), required_skills TEXT NOT NULL DEFAULT ''
);
