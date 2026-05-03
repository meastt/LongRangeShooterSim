/**
 * Singleton SQLite database client — Drizzle ORM over expo-sqlite.
 *
 * Migrations are run once from the root layout (_layout.tsx) using
 * `migrate(db, migrations)` from drizzle-orm/expo-sqlite/migrator.
 * Do not call `migrate` here — it runs at the module level before React
 * has initialised, which can race with the splash screen.
 */
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const sqlite = openDatabaseSync('aim.db', { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });
