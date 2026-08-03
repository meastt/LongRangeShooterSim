import { ALL_BULLETS } from './data';
import type { LibraryBullet, SearchBulletsOptions } from './types';

const DIAMETER_TOLERANCE_INCHES = 0.0005;

/** Every bullet in the on-device library (all manufacturers, centerfire + rimfire). */
export function allBullets(): readonly LibraryBullet[] {
  return ALL_BULLETS;
}

/**
 * Filter the library. All provided filters are ANDed together.
 * `query` matches manufacturer, line, or name — case-insensitive substring.
 */
export function searchBullets(opts: SearchBulletsOptions): readonly LibraryBullet[] {
  const query = opts.query?.trim().toLowerCase();
  return ALL_BULLETS.filter((b) => {
    if (query) {
      const haystack = `${b.manufacturer} ${b.line} ${b.name}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (opts.diameterInches !== undefined) {
      if (Math.abs(b.diameterInches - opts.diameterInches) > DIAMETER_TOLERANCE_INCHES) {
        return false;
      }
    }
    if (opts.minGrains !== undefined && b.weightGrains < opts.minGrains) return false;
    if (opts.maxGrains !== undefined && b.weightGrains > opts.maxGrains) return false;
    return true;
  });
}

/** Look up a single bullet by its stable slug id. Returns null if not found. */
export function bulletById(id: string): LibraryBullet | null {
  return ALL_BULLETS.find((b) => b.id === id) ?? null;
}
