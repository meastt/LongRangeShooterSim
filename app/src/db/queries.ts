/**
 * Typed query helpers for the Aim database.
 * All DB calls go through here — no raw drizzle calls in components.
 */
import { eq, and, desc } from 'drizzle-orm';
import { db } from './client';
import { rifles, loads, scopes, zeros, coldBoreEvents } from './schema';
import type {
  AtmosphericConditions,
} from '@aim/solver';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RifleRow = typeof rifles.$inferSelect;
export type LoadRow = typeof loads.$inferSelect;
export type ScopeRow = typeof scopes.$inferSelect;
export type ZeroRow = typeof zeros.$inferSelect;
export type ColdBoreEventRow = typeof coldBoreEvents.$inferSelect;

export type RifleWithActiveLoad = RifleRow & {
  activeLoad: LoadRow | null;
  activeScope: ScopeRow | null;
};

/** The full denormalised record the Field HUD needs — one DB call. */
export type FieldProfile = {
  rifle: RifleRow;
  load: LoadRow;
  scope: ScopeRow;
  zero: ZeroRow;
  atmosphericSnapshot: AtmosphericConditions;
};

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Returns all rifles with their active load and scope for the profile list. */
export async function getRiflesWithActiveLoad(): Promise<RifleWithActiveLoad[]> {
  const allRifles = await db.select().from(rifles);

  return Promise.all(
    allRifles.map(async (rifle) => {
      const [activeLoad = null] = await db
        .select()
        .from(loads)
        .where(and(eq(loads.rifleId, rifle.id), eq(loads.isActive, true)))
        .limit(1);

      const [activeScope = null] = await db
        .select()
        .from(scopes)
        .where(eq(scopes.rifleId, rifle.id))
        .limit(1);

      return { ...rifle, activeLoad, activeScope };
    }),
  );
}

/**
 * Returns the full field profile for a given rifle ID, or null if incomplete.
 * "Incomplete" = no active load, no scope, or no zero recorded yet.
 */
export async function getFieldProfile(
  rifleId: string,
): Promise<FieldProfile | null> {
  const [rifle] = await db
    .select()
    .from(rifles)
    .where(eq(rifles.id, rifleId))
    .limit(1);
  if (!rifle) return null;

  const [load] = await db
    .select()
    .from(loads)
    .where(and(eq(loads.rifleId, rifleId), eq(loads.isActive, true)))
    .limit(1);
  if (!load) return null;

  const [scope] = await db
    .select()
    .from(scopes)
    .where(eq(scopes.rifleId, rifleId))
    .limit(1);
  if (!scope) return null;

  const [zero] = await db
    .select()
    .from(zeros)
    .where(eq(zeros.loadId, load.id))
    .limit(1);
  if (!zero) return null;

  const atmosphericSnapshot: AtmosphericConditions = JSON.parse(
    zero.atmosphericSnapshot,
  );

  return { rifle, load, scope, zero, atmosphericSnapshot };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

export async function upsertRifle(
  data: Omit<RifleRow, 'createdAt' | 'updatedAt'>,
): Promise<void> {
  await db
    .insert(rifles)
    .values({ ...data, createdAt: now(), updatedAt: now() })
    .onConflictDoUpdate({
      target: rifles.id,
      set: { ...data, updatedAt: now() },
    });
}

export async function upsertLoad(
  data: Omit<LoadRow, 'createdAt' | 'updatedAt'>,
): Promise<void> {
  await db
    .insert(loads)
    .values({ ...data, createdAt: now(), updatedAt: now() })
    .onConflictDoUpdate({
      target: loads.id,
      set: { ...data, updatedAt: now() },
    });
}

/** Sets the given load as active and deactivates all other loads for the same rifle. */
export async function setActiveLoad(
  rifleId: string,
  loadId: string,
): Promise<void> {
  await db
    .update(loads)
    .set({ isActive: false })
    .where(eq(loads.rifleId, rifleId));
  await db
    .update(loads)
    .set({ isActive: true })
    .where(eq(loads.id, loadId));
}

export async function upsertScope(
  data: Omit<ScopeRow, 'createdAt' | 'updatedAt'>,
): Promise<void> {
  await db
    .insert(scopes)
    .values({ ...data, createdAt: now(), updatedAt: now() })
    .onConflictDoUpdate({
      target: scopes.id,
      set: { ...data, updatedAt: now() },
    });
}

export async function upsertZero(
  data: Omit<ZeroRow, 'createdAt'>,
): Promise<void> {
  await db
    .insert(zeros)
    .values({ ...data, createdAt: now() })
    .onConflictDoUpdate({
      target: zeros.id,
      set: data,
    });
}

export async function deleteRifle(rifleId: string): Promise<void> {
  // Cascade deletes loads, scopes, zeros via FK constraints.
  await db.delete(rifles).where(eq(rifles.id, rifleId));
}

/** Toggles the suppressor flag on a rifle and bumps updatedAt. */
export async function updateSuppressor(
  rifleId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(rifles)
    .set({ suppressorEnabled: enabled, updatedAt: now() })
    .where(eq(rifles.id, rifleId));
}

// ─── Cold-bore events ─────────────────────────────────────────────────────────

/** Returns all cold-bore events for a rifle, newest first. */
export async function getColdBoreEvents(
  rifleId: string,
): Promise<ColdBoreEventRow[]> {
  return db
    .select()
    .from(coldBoreEvents)
    .where(eq(coldBoreEvents.rifleId, rifleId))
    .orderBy(desc(coldBoreEvents.date));
}

/** Inserts a new cold-bore event. Caller is responsible for generating `id`. */
export async function insertColdBoreEvent(
  data: Omit<ColdBoreEventRow, 'createdAt'>,
): Promise<void> {
  await db.insert(coldBoreEvents).values({ ...data, createdAt: now() });
}
