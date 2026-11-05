CREATE TABLE `direct_conversation_participants` (
	`conversation_id` text NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`conversation_id`, `member_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `direct_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direct_conversations_pair_key_unique` ON `direct_conversations` (`pair_key`);--> statement-breakpoint
CREATE TABLE `direct_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`max_uses` integer NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_code_hash_unique` ON `invitations` (`code_hash`);--> statement-breakpoint
CREATE TABLE `member_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`public_member_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`bio` text DEFAULT '' NOT NULL,
	`pin_hash` text NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`activated_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`public_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_accounts_public_member_id_unique` ON `member_accounts` (`public_member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_accounts_auth_user_id_unique` ON `member_accounts` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `member_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`public_member_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`public_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_activations_token_hash_unique` ON `member_activations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`message_id` text NOT NULL,
	`member_id` text NOT NULL,
	`emoji` text NOT NULL,
	PRIMARY KEY(`message_id`, `member_id`, `emoji`),
	FOREIGN KEY (`message_id`) REFERENCES `team_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `message_reads` (
	`member_id` text NOT NULL,
	`channel` text NOT NULL,
	`read_at` text NOT NULL,
	PRIMARY KEY(`member_id`, `channel`),
	FOREIGN KEY (`member_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`reply_to_message_id` text,
	FOREIGN KEY (`sender_id`) REFERENCES `member_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspace_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `activity` ADD `actor_id` text;--> statement-breakpoint
ALTER TABLE `activity` ADD `actor_name` text;