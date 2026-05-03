/**
 * backup.ts — iCloud / Files backup and restore for Aim.
 *
 * Uses the legacy expo-file-system API for maximum compatibility.
 * (The new OOP File/Directory API in expo-file-system v18+ is still
 * unstable and its TypeScript source contains unfixed override errors
 * that break our strict tsconfig when that package is imported.)
 *
 * Export: serialises every rifle, load, scope, zero, and cold-bore event
 * to a single JSON file in the app's document directory, then shares it
 * via expo-sharing (Files app on iOS, device storage on Android).
 *
 * Import: picks a JSON file via expo-document-picker, validates schema
 * version, inserts all records with fresh UUIDs to avoid conflicts.
 */
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { db } from '../db/client';
import { rifles, loads, scopes, zeros, coldBoreEvents } from '../db/schema';
import { upsertRifle, upsertLoad, upsertScope, upsertZero } from '../db/queries';

// ─── Lazy import of legacy FileSystem API ─────────────────────────────────────
// We type-erase the import to avoid pulling expo-file-system's src/ into tsc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
async function getFS(): Promise<AnyRecord> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system') as AnyRecord;
}

const BACKUP_VERSION = 1;

export type BackupMeta = {
  version: number;
  createdAt: string;
  rifleCount: number;
};

type BackupPayload = {
  version: number;
  createdAt: string;
  rifles: Record<string, unknown>[];
  loads: Record<string, unknown>[];
  scopes: Record<string, unknown>[];
  zeros: Record<string, unknown>[];
  coldBoreEvents: Record<string, unknown>[];
};

// ─── Export ────────────────────────────────────────────────────────────────────

export async function exportBackup(): Promise<string> {
  const FS = await getFS();

  const [rifleRows, loadRows, scopeRows, zeroRows, coldBoreRows] = await Promise.all([
    db.select().from(rifles),
    db.select().from(loads),
    db.select().from(scopes),
    db.select().from(zeros),
    db.select().from(coldBoreEvents),
  ]);

  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    rifles: rifleRows as Record<string, unknown>[],
    loads: loadRows as Record<string, unknown>[],
    scopes: scopeRows as Record<string, unknown>[],
    zeros: zeroRows as Record<string, unknown>[],
    coldBoreEvents: coldBoreRows as Record<string, unknown>[],
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `aim-backup-${date}.json`;
  const docDir: string = (FS.documentDirectory as string | undefined) ?? 'file:///';
  const uri = `${docDir}${filename}`;

  await (FS.writeAsStringAsync as (uri: string, content: string) => Promise<void>)(
    uri,
    JSON.stringify(payload, null, 2),
  );

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save Aim backup',
      UTI: 'public.json',
    });
  }

  return uri;
}

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportResult = {
  riflesImported: number;
  loadsImported: number;
  scopesImported: number;
  zerosImported: number;
  coldBoreImported: number;
};

export async function importBackup(): Promise<ImportResult | null> {
  const FS = await getFS();

  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets?.[0]) return null;

  const text: string = await (FS.readAsStringAsync as (uri: string) => Promise<string>)(
    picked.assets[0].uri,
  );
  const payload = JSON.parse(text) as BackupPayload;

  if (payload.version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version ${payload.version}. Supports version ${BACKUP_VERSION}.`,
    );
  }

  const rifleIdMap: Record<string, string> = {};
  const loadIdMap: Record<string, string> = {};
  const scopeIdMap: Record<string, string> = {};

  let riflesImported = 0;
  let loadsImported = 0;
  let scopesImported = 0;
  let zerosImported = 0;
  let coldBoreImported = 0;

  for (const r of payload.rifles ?? []) {
    const oldId = r['id'] as string;
    const newId = Crypto.randomUUID();
    rifleIdMap[oldId] = newId;
    try {
      await upsertRifle({ ...(r as Parameters<typeof upsertRifle>[0]), id: newId });
      riflesImported++;
    } catch { /* skip */ }
  }

  for (const l of payload.loads ?? []) {
    const oldId = l['id'] as string;
    const newId = Crypto.randomUUID();
    loadIdMap[oldId] = newId;
    const newRifleId = rifleIdMap[l['rifleId'] as string];
    if (!newRifleId) continue;
    try {
      await upsertLoad({ ...(l as Parameters<typeof upsertLoad>[0]), id: newId, rifleId: newRifleId });
      loadsImported++;
    } catch { /* skip */ }
  }

  for (const s of payload.scopes ?? []) {
    const oldId = s['id'] as string;
    const newId = Crypto.randomUUID();
    scopeIdMap[oldId] = newId;
    const newRifleId = rifleIdMap[s['rifleId'] as string];
    if (!newRifleId) continue;
    try {
      await upsertScope({ ...(s as Parameters<typeof upsertScope>[0]), id: newId, rifleId: newRifleId });
      scopesImported++;
    } catch { /* skip */ }
  }

  for (const z of payload.zeros ?? []) {
    const newLoadId = loadIdMap[z['loadId'] as string];
    const newScopeId = scopeIdMap[z['scopeId'] as string];
    if (!newLoadId || !newScopeId) continue;
    try {
      await upsertZero({
        ...(z as Parameters<typeof upsertZero>[0]),
        id: Crypto.randomUUID(),
        loadId: newLoadId,
        scopeId: newScopeId,
      });
      zerosImported++;
    } catch { /* skip */ }
  }

  for (const ev of payload.coldBoreEvents ?? []) {
    const newRifleId = rifleIdMap[ev['rifleId'] as string];
    if (!newRifleId) continue;
    try {
      await db.insert(coldBoreEvents).values({
        ...(ev as typeof coldBoreEvents.$inferInsert),
        id: Crypto.randomUUID(),
        rifleId: newRifleId,
      }).onConflictDoNothing();
      coldBoreImported++;
    } catch { /* skip */ }
  }

  return { riflesImported, loadsImported, scopesImported, zerosImported, coldBoreImported };
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function getLastBackupMeta(): Promise<BackupMeta | null> {
  try {
    const FS = await getFS();
    const docDir: string = (FS.documentDirectory as string | undefined) ?? 'file:///';
    const allFiles: string[] = await (FS.readDirectoryAsync as (dir: string) => Promise<string[]>)(docDir);
    const backups = allFiles
      .filter((f) => f.startsWith('aim-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    const latest = backups[0];
    if (!latest) return null;

    const text: string = await (FS.readAsStringAsync as (uri: string) => Promise<string>)(
      `${docDir}${latest}`,
    );
    const payload = JSON.parse(text) as BackupPayload;
    return {
      version: payload.version,
      createdAt: payload.createdAt,
      rifleCount: payload.rifles?.length ?? 0,
    };
  } catch {
    return null;
  }
}
