CREATE TABLE `push_vapid_tokens` (
	`public_key` text NOT NULL,
	`audience` text NOT NULL,
	`subject` text NOT NULL,
	`authorization` text NOT NULL,
	`refresh_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`public_key`, `audience`, `subject`)
);
