-- Additive only. Keep legacy credentials, identities and sessions intact.
-- Review grants and backups before applying to production. No automatic rollout.
CREATE TABLE IF NOT EXISTS cr_oauth_identities (
 provider TEXT NOT NULL CHECK(provider IN ('google','github')), subject TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES member_accounts(id), created_at TEXT NOT NULL,
 PRIMARY KEY(provider,subject), UNIQUE(account_id,provider)
);
CREATE TABLE IF NOT EXISTS cr_oauth_flows (
 token_hash TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('google','github')),
 verifier TEXT NOT NULL, nonce TEXT NOT NULL, return_to TEXT NOT NULL,
 link_account_id TEXT REFERENCES member_accounts(id), link_session_hash TEXT,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cr_oauth_pending_links (
 token_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL,
 display_name TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES member_accounts(id),
 session_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
);
