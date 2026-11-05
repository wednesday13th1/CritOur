CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admins` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`avatar` text,
	`bio` text,
	`skills` text DEFAULT '[]' NOT NULL,
	`social_links` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`publish_date` text NOT NULL,
	`cover_image` text,
	`excerpt` text,
	`body` text NOT NULL,
	`related_project_id` text,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_posts_slug_unique` ON `news_posts` (`slug`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`short_description` text NOT NULL,
	`description` text,
	`cover_image` text,
	`gallery` text DEFAULT '[]' NOT NULL,
	`year` text,
	`status` text DEFAULT 'In Development' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`team_members` text DEFAULT '[]' NOT NULL,
	`tech_stack` text DEFAULT '[]' NOT NULL,
	`why_we_made_it` text,
	`process` text,
	`links` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`team_name` text NOT NULL,
	`site_title` text NOT NULL,
	`logo_text` text NOT NULL,
	`hero_motto` text NOT NULL,
	`hero_description` text NOT NULL,
	`about_heading` text NOT NULL,
	`about_statement` text NOT NULL,
	`about_description` text NOT NULL,
	`about_image` text,
	`social_links` text DEFAULT '{}' NOT NULL,
	`contact_email` text,
	`footer_text` text,
	`seo_title` text,
	`seo_description` text,
	`default_language` text DEFAULT 'EN' NOT NULL,
	`updated_at` text NOT NULL
);
