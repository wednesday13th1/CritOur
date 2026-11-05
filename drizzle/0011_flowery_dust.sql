CREATE TABLE `studio_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`archived_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_channel_name` ON `studio_channels` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `studio_files` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scope_id` text NOT NULL,
	`project_id` text,
	`studio_message_id` text,
	`direct_message_id` text,
	`team_message_id` text,
	`uploaded_by` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`studio_message_id`) REFERENCES `studio_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`direct_message_id`) REFERENCES `direct_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_message_id`) REFERENCES `team_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_files_storage_key_unique` ON `studio_files` (`storage_key`);--> statement-breakpoint
CREATE TABLE `studio_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`parent_id` text,
	`sender_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`client_id` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `studio_channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_messages_id_unique` ON `studio_messages` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_message_client` ON `studio_messages` (`sender_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `studio_message_channel_seq` ON `studio_messages` (`channel_id`,`seq`);--> statement-breakpoint
CREATE TABLE `studio_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`channel_id` text,
	`title` text NOT NULL,
	`event_key` text NOT NULL,
	`read_at` text,
	`available_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_notification_event` ON `studio_notifications` (`recipient_id`,`event_key`);--> statement-breakpoint
CREATE TABLE `studio_reactions` (
	`message_id` text NOT NULL,
	`account_id` text NOT NULL,
	`emoji` text NOT NULL,
	PRIMARY KEY(`message_id`, `account_id`, `emoji`),
	FOREIGN KEY (`message_id`) REFERENCES `studio_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `studio_reads` (
	`channel_id` text NOT NULL,
	`account_id` text NOT NULL,
	`last_seq` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`channel_id`, `account_id`),
	FOREIGN KEY (`channel_id`) REFERENCES `studio_channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `studio_task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`project_id` text NOT NULL,
	`account_id` text NOT NULL,
	`content` text NOT NULL,
	`client_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `studio_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_comment_client` ON `studio_task_comments` (`account_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `studio_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assignee_ids` text DEFAULT '[]' NOT NULL,
	`due_date` text,
	`source_message_id` text,
	`github_url` text,
	`version` integer DEFAULT 1 NOT NULL,
	`mutation_id` text NOT NULL,
	`client_id` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_message_id`) REFERENCES `studio_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_tasks_source_message_id_unique` ON `studio_tasks` (`source_message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_task_client` ON `studio_tasks` (`project_id`,`created_by`,`client_id`);--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `direct_message_client` ON `direct_messages` (`sender_id`,`client_id`);--> statement-breakpoint
ALTER TABLE `studio_projects` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `team_messages` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `team_messages` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `team_message_client` ON `team_messages` (`sender_id`,`client_id`);