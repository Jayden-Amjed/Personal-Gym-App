CREATE TABLE `push_subscriptions` (
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`subscription` text,
	`active_timer_id` text,
	`latest_set_at` integer DEFAULT 0 NOT NULL,
	`latest_sequence` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `device_id`)
);
--> statement-breakpoint
CREATE TABLE `push_timers` (
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`timer_id` text NOT NULL,
	`status` text NOT NULL,
	`message_id` text,
	`operation_id` text,
	`ends_at` integer DEFAULT 0 NOT NULL,
	`set_at` integer DEFAULT 0 NOT NULL,
	`set_sequence` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `device_id`, `timer_id`)
);
--> statement-breakpoint
CREATE TABLE `session_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workout_id` text NOT NULL,
	`date` text NOT NULL,
	`routine` text NOT NULL,
	`muscles` text NOT NULL,
	`original_key` text NOT NULL,
	`composite_key` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_photos_user_workout` ON `session_photos` (`user_id`,`workout_id`);