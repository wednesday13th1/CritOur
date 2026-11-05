CREATE TABLE `workspace_bootstrap` (
	`id` integer PRIMARY KEY NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER bootstrap_only_empty BEFORE INSERT ON workspace_bootstrap WHEN EXISTS(SELECT 1 FROM allowed_emails) BEGIN SELECT RAISE(ABORT,'Already configured'); END;
