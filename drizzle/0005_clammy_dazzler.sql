CREATE TABLE `allowed_emails` (
	`email` text PRIMARY KEY NOT NULL,
	`public_member_id` text NOT NULL,
	`created_at` text NOT NULL,
	`disabled_at` text,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`public_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allowed_emails_public_member_id_unique` ON `allowed_emails` (`public_member_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_name` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_challenges` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
ALTER TABLE `member_accounts` ADD `email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `member_accounts_email_unique` ON `member_accounts` (`email`);--> statement-breakpoint
ALTER TABLE `workspace_sessions` ADD `verified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit logs are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER allowed_emails_no_delete BEFORE DELETE ON allowed_emails BEGIN SELECT RAISE(ABORT, 'Revoke approved emails instead of deleting history'); END;
--> statement-breakpoint
CREATE TRIGGER allowed_emails_no_rebind BEFORE UPDATE OF email,public_member_id ON allowed_emails WHEN NEW.email != OLD.email OR NEW.public_member_id != OLD.public_member_id BEGIN SELECT RAISE(ABORT, 'Identity mappings cannot be transferred'); END;
--> statement-breakpoint
CREATE TRIGGER allowed_emails_last_admin BEFORE UPDATE OF disabled_at ON allowed_emails
WHEN OLD.disabled_at IS NULL AND NEW.disabled_at IS NOT NULL AND EXISTS(SELECT 1 FROM member_accounts WHERE email=OLD.email)
AND NOT EXISTS(SELECT 1 FROM allowed_emails e JOIN member_accounts a ON a.email=e.email WHERE e.disabled_at IS NULL AND e.email != OLD.email)
BEGIN SELECT RAISE(ABORT, 'Cannot revoke the last active Admin'); END;
--> statement-breakpoint
CREATE TRIGGER allowed_emails_added AFTER INSERT ON allowed_emails BEGIN
INSERT INTO audit_logs(id,actor_id,actor_name,action,resource,created_at) VALUES(lower(hex(randomblob(16))),NEW.updated_by,NEW.updated_by,'allowlist.add',NEW.email,strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
--> statement-breakpoint
CREATE TRIGGER allowed_emails_changed AFTER UPDATE OF disabled_at ON allowed_emails WHEN OLD.disabled_at IS NOT NEW.disabled_at BEGIN
INSERT INTO audit_logs(id,actor_id,actor_name,action,resource,created_at) VALUES(lower(hex(randomblob(16))),NEW.updated_by,NEW.updated_by,CASE WHEN NEW.disabled_at IS NULL THEN 'allowlist.restore' ELSE 'allowlist.revoke' END,NEW.email,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
DELETE FROM workspace_sessions WHERE auth_user_id IN (SELECT auth_user_id FROM member_accounts WHERE email=NEW.email);
DELETE FROM email_challenges WHERE email=NEW.email;
END;
