/**
 * Drizzle SQLite schema for Aim.
 *
 * Design decisions:
 * - All PKs are UUIDs (text), generated client-side. Enables future QR export
 *   and merge without autoincrement conflicts.
 * - Multiple loads per rifle, one marked isActive. Enables hunting/comp load
 *   switching without rebuilding a profile.
 * - atmosphericSnapshot on zeros stored as JSON text — a snapshot of the exact
 *   conditions used when zeroing, preserved for truing calculations.
 * - All temporal fields stored as ISO-8601 text (SQLite has no native datetime).
 */
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ─── rifles ──────────────────────────────────────────────────────────────────

export const rifles = sqliteTable('rifles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  caliber: text('caliber').notNull(),
  /** Barrel twist rate in inches per turn (e.g. 8 = 1:8"). */
  twistRateIn: real('twist_rate_in'),
  barrelLengthIn: real('barrel_length_in'),
  /** Whether a suppressor is currently attached — affects MV and POI. */
  suppressorEnabled: integer('suppressor_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── loads ───────────────────────────────────────────────────────────────────

export const loads = sqliteTable('loads', {
  id: text('id').primaryKey(),
  rifleId: text('rifle_id')
    .notNull()
    .references(() => rifles.id, { onDelete: 'cascade' }),
  /** Only one load per rifle can be active at a time. */
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  bulletName: text('bullet_name').notNull(),
  weightGrains: real('weight_grains').notNull(),
  diameterInches: real('diameter_inches').notNull(),
  /** Ballistic coefficient in lb/in² for the selected drag model. */
  bc: real('bc').notNull(),
  /** 'G7' for long-range boat-tail bullets, 'G1' for general purpose. */
  dragModel: text('drag_model', { enum: ['G1', 'G7'] }).notNull().default('G7'),
  muzzleVelocityFps: real('muzzle_velocity_fps').notNull(),
  powderCharge: text('powder_charge'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── scopes ──────────────────────────────────────────────────────────────────

export const scopes = sqliteTable('scopes', {
  id: text('id').primaryKey(),
  rifleId: text('rifle_id')
    .notNull()
    .references(() => rifles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Clicks per milliradian — typically 10 for most modern scopes, 4 for 1/4 MOA. */
  clicksPerMrad: real('clicks_per_mrad').notNull().default(10),
  /** Turret elevation cap in milliradians before re-indexing required. */
  turretCapMrad: real('turret_cap_mrad'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── zeros ───────────────────────────────────────────────────────────────────

export const zeros = sqliteTable('zeros', {
  id: text('id').primaryKey(),
  loadId: text('load_id')
    .notNull()
    .references(() => loads.id, { onDelete: 'cascade' }),
  scopeId: text('scope_id')
    .notNull()
    .references(() => scopes.id, { onDelete: 'cascade' }),
  zeroRangeYards: real('zero_range_yards').notNull().default(100),
  scopeHeightInches: real('scope_height_inches').notNull().default(1.5),
  zeroDate: text('zero_date').notNull(),
  /**
   * JSON snapshot of AtmosphericConditions at zero time.
   * Schema: { temperatureFahrenheit, pressureInHg, relativeHumidityPct }
   */
  atmosphericSnapshot: text('atmospheric_snapshot').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// ─── coldBoreEvents ──────────────────────────────────────────────────────────

export const coldBoreEvents = sqliteTable('cold_bore_events', {
  id: text('id').primaryKey(),
  rifleId: text('rifle_id')
    .notNull()
    .references(() => rifles.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  tempFahrenheit: real('temp_fahrenheit'),
  /** First-shot POI offset from zero in milliradians (positive = high). */
  firstShotOffsetMrad: real('first_shot_offset_mrad').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// ─── relations ───────────────────────────────────────────────────────────────

export const riflesRelations = relations(rifles, ({ many }) => ({
  loads: many(loads),
  scopes: many(scopes),
  coldBoreEvents: many(coldBoreEvents),
}));

export const loadsRelations = relations(loads, ({ one, many }) => ({
  rifle: one(rifles, { fields: [loads.rifleId], references: [rifles.id] }),
  zeros: many(zeros),
}));

export const scopesRelations = relations(scopes, ({ one, many }) => ({
  rifle: one(rifles, { fields: [scopes.rifleId], references: [rifles.id] }),
  zeros: many(zeros),
}));

export const zerosRelations = relations(zeros, ({ one }) => ({
  load: one(loads, { fields: [zeros.loadId], references: [loads.id] }),
  scope: one(scopes, { fields: [zeros.scopeId], references: [scopes.id] }),
}));

export const coldBoreEventsRelations = relations(coldBoreEvents, ({ one }) => ({
  rifle: one(rifles, {
    fields: [coldBoreEvents.rifleId],
    references: [rifles.id],
  }),
}));
