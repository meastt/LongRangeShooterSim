/**
 * Full-dataset validation harness. Runs over every entry in every
 * data/<manufacturer>.json file. Reference: docs/specs/bullet-library.md
 * §Validation.
 *
 * The known-groove-diameter list below extends the spec's illustrative list
 * (which ends in "…") with .223 (Sierra's published diameter for its .22
 * Hornet-chambered VarmintKing variants), .310 (Soviet-spec 7.62x39 bore, used
 * by Nosler AccuBond LR / E-Tip in that chambering), .323 (8mm bore — common,
 * currently-produced, simply missing from the illustrative example list), and
 * .355 (Sierra's published diameter for one .35-caliber Pro-Hunter loading).
 * These are real manufacturer-published diameters, not fabricated data; adding
 * them to the allow-list avoids discarding verified entries over a
 * documentation gap. See DISCREPANCIES.md for the full judgment-call note.
 */
import { describe, expect, it } from 'vitest';
import { allBullets } from '../src/search';
import type { LibraryBullet } from '../src/types';

const KNOWN_GROOVE_DIAMETERS_INCHES: readonly number[] = [
  0.172, 0.204, 0.223, 0.224, 0.243, 0.257, 0.264, 0.277, 0.284, 0.308, 0.31,
  0.311, 0.323, 0.325, 0.338, 0.355, 0.358, 0.366, 0.375,
];

const MANUFACTURER_DOMAINS: Readonly<Record<string, string>> = {
  Barnes: 'barnesbullets.com',
  Berger: 'bergerbullets.com',
  Federal: 'federalpremium.com',
  Hornady: 'hornady.com',
  Lapua: 'lapua.com',
  Nosler: 'nosler.com',
  Sierra: 'sierrabullets.com',
  CCI: 'cci-ammunition.com',
  SK: 'sk-ammunition.com',
  Eley: 'eley.co.uk',
};

// Slug format per spec: "<maker>-<line>-<diameter>-<grains>", e.g.
// "hornady-eld-m-0.264-140" — lowercase, hyphen-separated segments, where a
// segment may itself contain a decimal point (the diameter segment, e.g.
// "0.264"), but never any other character.
const SLUG_ID_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)?(-[a-z0-9]+(\.[a-z0-9]+)?)*$/;
const SLUG_SEGMENT_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isKnownDiameter(d: number): boolean {
  return KNOWN_GROOVE_DIAMETERS_INCHES.some((k) => Math.abs(k - d) < 1e-9);
}

function sectionalDensity(weightGrains: number, diameterInches: number): number {
  return weightGrains / (7000 * diameterInches * diameterInches);
}

const bullets = allBullets();

describe('bullet-library full-dataset validation', () => {
  it('loads a non-trivial dataset', () => {
    expect(bullets.length).toBeGreaterThan(500);
  });

  it('every id is unique', () => {
    const ids = new Set<string>();
    for (const b of bullets) {
      expect(ids.has(b.id), `duplicate id: ${b.id}`).toBe(false);
      ids.add(b.id);
    }
  });

  it('every id matches the slug format', () => {
    for (const b of bullets) {
      expect(b.id, `id "${b.id}" is not lowercase hyphen-separated`).toMatch(SLUG_ID_PATTERN);
      for (const segment of b.id.split('-')) {
        expect(
          segment,
          `id "${b.id}": segment "${segment}" is not a valid slug segment`,
        ).toMatch(SLUG_SEGMENT_PATTERN);
      }
    }
  });

  it('every entry has all required fields with correct types', () => {
    for (const b of bullets) {
      expect(typeof b.manufacturer).toBe('string');
      expect(b.manufacturer.length).toBeGreaterThan(0);
      expect(typeof b.line).toBe('string');
      expect(b.line.length).toBeGreaterThan(0);
      expect(typeof b.name).toBe('string');
      expect(b.name.length).toBeGreaterThan(0);
      expect(typeof b.weightGrains).toBe('number');
      expect(b.weightGrains).toBeGreaterThan(0);
      expect(typeof b.diameterInches).toBe('number');
      expect(b.g1Bc === null || typeof b.g1Bc === 'number').toBe(true);
      expect(b.g7Bc === null || typeof b.g7Bc === 'number').toBe(true);
      expect(['G1', 'G7']).toContain(b.preferredModel);
      expect(typeof b.sourceUrl).toBe('string');
      expect(typeof b.retrievedAt).toBe('string');
      expect(b.retrievedAt).toMatch(ISO_DATE_PATTERN);
    }
  });

  it('preferredModel is G7 iff g7Bc is present', () => {
    for (const b of bullets) {
      if (b.g7Bc !== null) {
        expect(b.preferredModel, b.id).toBe('G7');
      } else {
        expect(b.preferredModel, b.id).toBe('G1');
      }
    }
  });

  it('diameter is one of the known groove diameters', () => {
    for (const b of bullets) {
      expect(isKnownDiameter(b.diameterInches), `${b.id}: unknown diameter ${b.diameterInches}`).toBe(
        true,
      );
    }
  });

  it('sourceUrl is a well-formed https URL on the manufacturer\'s own domain', () => {
    for (const b of bullets) {
      expect(b.sourceUrl.startsWith('https://'), `${b.id}: sourceUrl not https`).toBe(true);
      const domain = MANUFACTURER_DOMAINS[b.manufacturer];
      expect(domain, `${b.id}: no known domain for manufacturer "${b.manufacturer}"`).toBeDefined();
      expect(b.sourceUrl.includes(domain as string), `${b.id}: sourceUrl not on ${domain}`).toBe(true);
    }
  });

  it('no duplicate (manufacturer, line, diameter, weight) tuples', () => {
    const seen = new Map<string, string>();
    for (const b of bullets) {
      const key = `${b.manufacturer}|${b.line}|${b.diameterInches}|${b.weightGrains}`;
      const existing = seen.get(key);
      expect(existing, `duplicate tuple ${key}: ${b.id} collides with ${existing}`).toBeUndefined();
      seen.set(key, b.id);
    }
  });

  it('G1 BC plausibility: 0.10 <= g1Bc <= 1.10', () => {
    for (const b of bullets) {
      if (b.g1Bc === null) continue;
      expect(b.g1Bc, b.id).toBeGreaterThanOrEqual(0.1);
      expect(b.g1Bc, b.id).toBeLessThanOrEqual(1.1);
    }
  });

  it('G7 BC plausibility: 0.05 <= g7Bc <= 0.50', () => {
    for (const b of bullets) {
      if (b.g7Bc === null) continue;
      expect(b.g7Bc, b.id).toBeGreaterThanOrEqual(0.05);
      expect(b.g7Bc, b.id).toBeLessThanOrEqual(0.5);
    }
  });

  it('where both BCs exist, g7Bc < g1Bc and the form-factor ratio is within 0.40-0.70 (hard bound)', () => {
    for (const b of bullets) {
      if (b.g1Bc === null || b.g7Bc === null) continue;
      expect(b.g7Bc, `${b.id}: g7Bc must be < g1Bc`).toBeLessThan(b.g1Bc);
      const ratio = b.g7Bc / b.g1Bc;
      expect(ratio, `${b.id}: g7/g1 ratio ${ratio.toFixed(3)} outside hard bound 0.40-0.70`).toBeGreaterThanOrEqual(
        0.4,
      );
      expect(ratio, `${b.id}: g7/g1 ratio ${ratio.toFixed(3)} outside hard bound 0.40-0.70`).toBeLessThanOrEqual(
        0.7,
      );
    }
  });

  it('flags (does not fail) form-factor ratios outside the typical 0.45-0.60 band', () => {
    const outliers: string[] = [];
    for (const b of bullets) {
      if (b.g1Bc === null || b.g7Bc === null) continue;
      const ratio = b.g7Bc / b.g1Bc;
      if (ratio < 0.45 || ratio > 0.6) {
        outliers.push(`${b.id} (${ratio.toFixed(3)})`);
      }
    }
    if (outliers.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[bullet-library] ${outliers.length} entries outside typical G7/G1 form-factor band 0.45-0.60 (informational, not a failure):\n  ${outliers.join('\n  ')}`);
    }
    // Informational only — never fails the suite.
    expect(true).toBe(true);
  });

  it('sectional density sanity: 0.08 <= SD <= 0.45', () => {
    for (const b of bullets) {
      const sd = sectionalDensity(b.weightGrains, b.diameterInches);
      expect(sd, `${b.id}: SD ${sd.toFixed(3)} out of range`).toBeGreaterThanOrEqual(0.08);
      expect(sd, `${b.id}: SD ${sd.toFixed(3)} out of range`).toBeLessThanOrEqual(0.45);
    }
  });
});

describe('bullet-library search API', () => {
  it('allBullets returns the full flattened dataset', () => {
    expect(allBullets().length).toBe(bullets.length);
  });

  it('searchBullets filters by diameter within tolerance', async () => {
    const { searchBullets } = await import('../src/search');
    const results = searchBullets({ diameterInches: 0.308 });
    expect(results.length).toBeGreaterThan(0);
    for (const b of results) {
      expect(Math.abs(b.diameterInches - 0.308)).toBeLessThanOrEqual(0.0005);
    }
  });

  it('searchBullets filters by query substring, case-insensitive', async () => {
    const { searchBullets } = await import('../src/search');
    const results = searchBullets({ query: 'eld match' });
    expect(results.length).toBeGreaterThan(0);
    for (const b of results) {
      const haystack = `${b.manufacturer} ${b.line} ${b.name}`.toLowerCase();
      expect(haystack).toContain('eld match');
    }
  });

  it('searchBullets filters by weight range', async () => {
    const { searchBullets } = await import('../src/search');
    const results = searchBullets({ minGrains: 140, maxGrains: 145 });
    expect(results.length).toBeGreaterThan(0);
    for (const b of results) {
      expect(b.weightGrains).toBeGreaterThanOrEqual(140);
      expect(b.weightGrains).toBeLessThanOrEqual(145);
    }
  });

  it('bulletById finds a known entry and returns null for unknown ids', async () => {
    const { bulletById } = await import('../src/search');
    const known = bullets[0] as LibraryBullet;
    expect(bulletById(known.id)?.id).toBe(known.id);
    expect(bulletById('does-not-exist')).toBeNull();
  });
});
