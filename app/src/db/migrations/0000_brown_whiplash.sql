CREATE TABLE `cold_bore_events` (
	`id` text PRIMARY KEY NOT NULL,
	`rifle_id` text NOT NULL,
	`date` text NOT NULL,
	`temp_fahrenheit` real,
	`first_shot_offset_mrad` real NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rifle_id`) REFERENCES `rifles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `loads` (
	`id` text PRIMARY KEY NOT NULL,
	`rifle_id` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`bullet_name` text NOT NULL,
	`weight_grains` real NOT NULL,
	`diameter_inches` real NOT NULL,
	`bc` real NOT NULL,
	`drag_model` text DEFAULT 'G7' NOT NULL,
	`muzzle_velocity_fps` real NOT NULL,
	`powder_charge` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`rifle_id`) REFERENCES `rifles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rifles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`caliber` text NOT NULL,
	`twist_rate_in` real,
	`barrel_length_in` real,
	`suppressor_enabled` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`rifle_id` text NOT NULL,
	`name` text NOT NULL,
	`clicks_per_mrad` real DEFAULT 10 NOT NULL,
	`turret_cap_mrad` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`rifle_id`) REFERENCES `rifles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `zeros` (
	`id` text PRIMARY KEY NOT NULL,
	`load_id` text NOT NULL,
	`scope_id` text NOT NULL,
	`zero_range_yards` real DEFAULT 100 NOT NULL,
	`scope_height_inches` real DEFAULT 1.5 NOT NULL,
	`zero_date` text NOT NULL,
	`atmospheric_snapshot` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`load_id`) REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
