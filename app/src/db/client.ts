/**
 * Singleton SQLite database client — Drizzle ORM over expo-sqlite.
 * Call `initDb()` once from the root layout before any queries.
 */
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';
import migrations from './migrations/migrations';

const sqlite = openDatabaseSync('aim.db', { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });

let initialised = false;

/** Run Drizzle migrations. Safe to call multiple times — idempotent. */
export async function initDb(): Promise<void> {
  if (initialised) return;
  await migrate(db, migrations);
  initialised = true;
}
