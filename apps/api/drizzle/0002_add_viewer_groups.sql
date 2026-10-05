CREATE TABLE `viewer_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`student_id` text NOT NULL,
	`national_id_hash` text NOT NULL,
	`display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`group_id`) REFERENCES `viewer_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_viewer_credentials_group` ON `viewer_credentials` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_viewer_credentials_student` ON `viewer_credentials` (`student_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_viewer_credentials_group_student` ON `viewer_credentials` (`group_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `viewer_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_viewer_groups_org` ON `viewer_groups` (`org_id`);--> statement-breakpoint
ALTER TABLE `links` ADD `access_group_id` text;