/**
 * importStrelokCSV — parse a Strelok Pro profile export CSV into FieldProfile fields.
 *
 * Strelok Pro exports a CSV with rows like:
 *   Name,Caliber,BC,BC type,Weight (gr),Diameter (in),MV (fps),Zero range (yd),
 *   Scope height (in),Zero temp (F),Zero pressure (inHg),Zero humidity (%)
 *
 * The first row is the header. Each subsequent row is one profile.
 *
 * Strelok labels BC type as "G1" or "G7". If unrecognised we default to G1.
 *
 * Returns an array of partial profile objects ready for the new-rifle modal or
 * direct DB insertion. The caller is responsible for generating UUIDs and
 * inserting into the DB.
 *
 * ─── Hornady 4DOF JSON ──────────────────────────────────────────────────────
 * Hornady's CustomShop app exports a JSON file like:
 *   {
 *     "cartridge": "7mm PRC",
 *     "bulletName": "ELD-M",
 *     "bulletWeight": 180,
 *     "bulletDiameter": 0.284,
 *     "g7Bc": 0.402,
 *     "muzzleVelocity": 2950,
 *     "sightHeight": 1.8,
 *     "zeroRange": 100
 *   }
 *
 * Both formats produce an ImportedProfile which can be passed directly to
 * the insert helpers.
 */

export type ImportedProfile = {
  /** Rifle */
  name: string;
  caliber: string;
  /** Load */
  bulletName: string;
  weightGrains: number;
  diameterInches: number;
  bc: number;
  dragModel: 'G1' | 'G7';
  muzzleVelocityFps: number;
  /** Zero */
  zeroRangeYards: number;
  scopeHeightInches: number;
  /** Atmosphere at zero — may be ICAO standard if not present in file */
  temperatureFahrenheit: number;
  pressureInHg: number;
  relativeHumidityPct: number;
};

const ICAO_FALLBACK = {
  temperatureFahrenheit: 59,
  pressureInHg: 29.921,
  relativeHumidityPct: 50,
};

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180 compliant CSV parser.
 * Handles quoted fields and embedded commas. Does not handle newlines in fields.
 */
function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      fields.push(current.trim());
      return fields;
    });
}

/**
 * Normalise a header name: lowercase, strip whitespace and parenthetical units.
 * "Weight (gr)" → "weight"
 */
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/\s+/g, '_').trim();
}

/**
 * Parse a Strelok Pro CSV export.
 * Returns all valid rows as ImportedProfile objects.
 * Skips rows with missing required fields or unparseable numbers.
 */
export function importStrelokCSV(csvText: string): ImportedProfile[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = (rows[0] ?? []).map(normalise);

  function col(row: string[], key: string): string {
    const idx = headers.indexOf(key);
    return idx >= 0 ? (row[idx] ?? '') : '';
  }

  function num(row: string[], key: string, fallback?: number): number {
    const v = parseFloat(col(row, key));
    if (!isNaN(v)) return v;
    if (fallback !== undefined) return fallback;
    return NaN;
  }

  const results: ImportedProfile[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.every((c) => c === '')) continue;

    const name = col(row, 'name') || col(row, 'profile_name') || `Profile ${i}`;
    const caliber = col(row, 'caliber') || col(row, 'cartridge') || 'Unknown';
    const bulletName = col(row, 'bullet') || col(row, 'bullet_name') || 'Unknown bullet';
    const dragModelRaw = (col(row, 'bc_type') || col(row, 'drag_model') || 'G1').toUpperCase().trim();
    const dragModel: 'G1' | 'G7' = dragModelRaw === 'G7' ? 'G7' : 'G1';

    const weightGrains    = num(row, 'weight');
    const diameterInches  = num(row, 'diameter');
    const bc              = num(row, 'bc');
    const muzzleVelocityFps = num(row, 'mv');
    const zeroRangeYards  = num(row, 'zero_range', 100);
    const scopeHeightInches = num(row, 'scope_height', 1.5);

    // Skip rows where required numerics are missing
    if ([weightGrains, diameterInches, bc, muzzleVelocityFps].some(isNaN)) continue;

    results.push({
      name,
      caliber,
      bulletName,
      weightGrains,
      diameterInches,
      bc,
      dragModel,
      muzzleVelocityFps,
      zeroRangeYards,
      scopeHeightInches,
      temperatureFahrenheit: num(row, 'zero_temp', ICAO_FALLBACK.temperatureFahrenheit),
      pressureInHg: num(row, 'zero_pressure', ICAO_FALLBACK.pressureInHg),
      relativeHumidityPct: num(row, 'zero_humidity', ICAO_FALLBACK.relativeHumidityPct),
    });
  }

  return results;
}

// ─── Hornady 4DOF JSON parser ─────────────────────────────────────────────────

type HornadyExport = {
  cartridge?: string;
  bulletName?: string;
  bulletWeight?: number;
  bulletDiameter?: number;
  g7Bc?: number;
  g1Bc?: number;
  muzzleVelocity?: number;
  sightHeight?: number;
  zeroRange?: number;
};

/**
 * Parse a Hornady CustomShop 4DOF JSON export.
 * Returns a single ImportedProfile.
 */
export function importHornadyJSON(jsonText: string): ImportedProfile {
  const h = JSON.parse(jsonText) as HornadyExport;

  const dragModel: 'G1' | 'G7' = h.g7Bc !== undefined && h.g7Bc > 0 ? 'G7' : 'G1';
  const bc = dragModel === 'G7' ? (h.g7Bc ?? 0) : (h.g1Bc ?? 0);

  return {
    name: `${h.cartridge ?? 'Unknown'} ${h.bulletName ?? ''}`.trim(),
    caliber: h.cartridge ?? 'Unknown',
    bulletName: h.bulletName ?? 'Unknown bullet',
    weightGrains: h.bulletWeight ?? 0,
    diameterInches: h.bulletDiameter ?? 0,
    bc,
    dragModel,
    muzzleVelocityFps: h.muzzleVelocity ?? 0,
    zeroRangeYards: h.zeroRange ?? 100,
    scopeHeightInches: h.sightHeight ?? 1.5,
    ...ICAO_FALLBACK,
  };
}

// ─── DB insertion helper ──────────────────────────────────────────────────────

/**
 * Insert a batch of ImportedProfile objects into the DB.
 * Each profile gets fresh UUIDs. Returns the count of successfully inserted profiles.
 */
export async function insertImportedProfiles(
  profiles: ImportedProfile[],
  deps: {
    upsertRifleFn: typeof import('../db/queries').upsertRifle;
    upsertLoadFn: typeof import('../db/queries').upsertLoad;
    upsertScopeFn: typeof import('../db/queries').upsertScope;
    upsertZeroFn: typeof import('../db/queries').upsertZero;
    randomUUID: () => string;
    now: () => string;
  },
): Promise<number> {
  let count = 0;
  for (const p of profiles) {
    try {
      const rifleId = deps.randomUUID();
      const loadId  = deps.randomUUID();
      const scopeId = deps.randomUUID();
      const zeroId  = deps.randomUUID();
      const ts      = deps.now();

      await deps.upsertRifleFn({
        id: rifleId,
        name: p.name,
        caliber: p.caliber,
        twistRateIn: 0 as any,      // not in Strelok export
        barrelLengthIn: 0 as any,   // not in Strelok export
        suppressorEnabled: false,
        notes: null,
      });

      await deps.upsertLoadFn({
        id: loadId,
        rifleId,
        isActive: true,
        bulletName: p.bulletName,
        weightGrains: p.weightGrains as any,
        diameterInches: p.diameterInches as any,
        bc: p.bc as any,
        dragModel: p.dragModel,
        muzzleVelocityFps: p.muzzleVelocityFps as any,
        powderCharge: null,
        notes: null,
      });

      await deps.upsertScopeFn({
        id: scopeId,
        rifleId,
        name: 'Imported scope',
        clicksPerMrad: 10,          // common default; user can edit
        turretCapMrad: null,
      });

      await deps.upsertZeroFn({
        id: zeroId,
        loadId,
        scopeId,
        zeroRangeYards: p.zeroRangeYards,
        scopeHeightInches: p.scopeHeightInches,
        zeroDate: deps.now(),
        atmosphericSnapshot: JSON.stringify({
          temperatureFahrenheit: p.temperatureFahrenheit,
          pressureInHg: p.pressureInHg,
          relativeHumidityPct: p.relativeHumidityPct,
        }),
        notes: null,
      });

      count++;
    } catch {
      // Skip this profile on failure; continue with the rest
    }
  }
  return count;
}
