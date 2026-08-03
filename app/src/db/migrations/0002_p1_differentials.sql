ALTER TABLE `loads` ADD `suppressor_mv_delta_fps` real;--> statement-breakpoint
ALTER TABLE `loads` ADD `suppressor_zero_shift_mils_elev` real;--> statement-breakpoint
ALTER TABLE `loads` ADD `suppressor_zero_shift_mils_wind` real;--> statement-breakpoint
ALTER TABLE `cold_bore_events` ADD `load_id` text;--> statement-breakpoint
ALTER TABLE `cold_bore_events` ADD `suppressor_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `shot_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`rifle_id` text NOT NULL,
	`load_id` text NOT NULL,
	`range_yards` real NOT NULL,
	`elev_hold_mils` real NOT NULL,
	`wind_hold_mils` real,
	`impact_offset_mils_elev` real,
	`impact_offset_mils_wind` real,
	`suppressor_enabled` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rifle_id`) REFERENCES `rifles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`load_id`) REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE cascade
);
