/**
 * On-device bullet library data model.
 * Mirrors packages/solver conventions: strict types, no `any`.
 * Reference: docs/specs/bullet-library.md — authoritative spec for this package.
 */

export type DragModel = 'G1' | 'G7';

/**
 * A single manufacturer-published bullet (or, for rimfire, loaded-ammo) entry.
 *
 * Data integrity rule (non-negotiable): every numeric field here must trace to a
 * manufacturer-published source captured in `sourceUrl` + `retrievedAt`. If a
 * manufacturer does not publish a G7 BC, `g7Bc` is `null` — never derived via
 * form-factor conversion from G1.
 */
export type LibraryBullet = {
  /** Stable slug id: "<maker>-<line>-<diameter>-<grains>", e.g. "hornady-eld-match-0.264-140". */
  readonly id: string;
  readonly manufacturer: string;
  readonly line: string;
  /** Display name, e.g. "ELD Match 140gr". */
  readonly name: string;
  readonly weightGrains: number;
  /** Actual projectile diameter in inches (0.264 for 6.5mm — never the cartridge name). */
  readonly diameterInches: number;
  readonly g1Bc: number | null;
  readonly g7Bc: number | null;
  /** Which model to default to in the app: 'G7' when g7Bc exists, else 'G1'. */
  readonly preferredModel: DragModel;
  readonly sourceUrl: string;
  /** ISO date (YYYY-MM-DD) the source was checked. */
  readonly retrievedAt: string;
  /** Optional: catalog/SKU number for disambiguation. */
  readonly sku?: string;
  /**
   * Rimfire-only: nominal factory muzzle velocity in fps. Rimfire is loaded
   * ammunition (bought, not handloaded), so there is no separate "load" the
   * user assembles — the app may use this to prefill MV. Absent for
   * centerfire component-bullet entries.
   */
  readonly nominalMuzzleVelocityFps?: number;
};

export type SearchBulletsOptions = {
  /** Matches manufacturer/line/name, case-insensitive substring. */
  readonly query?: string;
  /** Exact match with ±0.0005" tolerance. */
  readonly diameterInches?: number;
  readonly minGrains?: number;
  readonly maxGrains?: number;
};
