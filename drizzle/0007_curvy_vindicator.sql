CREATE TABLE `google_login_flows` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL,
	`reauth_account_id` text
);
