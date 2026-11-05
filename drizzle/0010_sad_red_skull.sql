CREATE TABLE `studio_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_account_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `studio_admins` (
	`id` integer PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_admins_account_id_unique` ON `studio_admins` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_admins_auth_user_id_unique` ON `studio_admins` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `studio_project_members` (
	`project_id` text NOT NULL,
	`account_id` text NOT NULL,
	`added_by` text NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `account_id`),
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`added_by`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `studio_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cms_project_id` text,
	`created_by` text NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cms_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
