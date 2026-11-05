CREATE TABLE `admin_login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`attempts` integer NOT NULL
);
