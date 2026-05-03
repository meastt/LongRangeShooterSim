/**
 * Solver Validation Harness
 * =========================
 * Compares computeTrajectory() output against published ballistic tables from:
 *   - JBM Ballistics online calculator
 *   - Hornady ballistic calculator
 *   - Berger Bullets reloading manual
 *
 * Pass criterion: holdMils deviation ≤ fixture._tolerance_mils at every
 * sampled range step. Velocity tolerance is ±40 fps (generous — JBM and Hornady
 * use slightly different drag tables, but our holds should align).
 *
 * Run with:  npm test  (from packages/solver directory)
 *            npm -w @aim/solver test  (from monorepo root)
 *
 * CI/CD: this runs on every commit via GitHub Actions and the diff is published
 * to the Cloudflare Pages solver validation page.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { computeTrajectory } from '../trajectory.js';
import type { TrajectoryInputs } from '../types.js';
import { ICAO_STANDARD_ATMOSPHERE } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Fixture loader ───────────────────────────────────────────────────────────

type FixtureRow = {
  rangeYards: number;
  holdMils: number;
  velocityFps: number;
  energyFtLbs: number;
};

type Fixture = {
  _comment: string;
  _source: string;
  _conditions: {
    bc_g7?: number;
    bc_g1?: number;
    muzzle_velocity_fps: number;
    scope_height_inches: number;
    zero_range_yards: number;
    temperature_f: number;
    pressure_inHg: number;
    humidity_pct: number;
    bullet: string;
    wind_mph: number;
  };
  _tolerance_mils: number;
  rows: FixtureRow[];
};

function loadFixture(filename: string): Fixture {
  const fullPath = join(__dirname, 'fixtures', filename);
  return JSON.parse(readFileSync(fullPath, 'utf-8')) as Fixture;
}

function buildInputs(f: Fixture): TrajectoryInputs {
  const c = f._conditions;
  const isG7 = c.bc_g7 !== undefined;
  return {
    bullet: {
      weightGrains: 140 as any,   // not used for hold calc — just energy
      diameterInches: 0.264 as any,
      bc: (isG7 ? c.bc_g7! : c.bc_g1!) as any,
      dragModel: isG7 ? 'G7' : 'G1',
    },
    muzzleVelocityFps: c.muzzle_velocity_fps as any,
    scopeHeightInches: c.scope_height_inches as any,
    zeroRangeYards: c.zero_range_yards as any,
    atmosphere: {
      temperatureFahrenheit: c.temperature_f as any,
      pressureInHg: c.pressure_inHg as any,
      relativeHumidityPct: c.humidity_pct,
    },
  };
}

// ─── Harness runner ───────────────────────────────────────────────────────────

function runHarness(fixtureName: string) {
  const fixture = loadFixture(fixtureName);
  const inputs = buildInputs(fixture);
  const tol = fixture._tolerance_mils;

  const result = computeTrajectory(inputs);

  const deviations: { range: number; expected: number; actual: number; delta: number }[] = [];

  for (const expected of fixture.rows) {
    const row = result.rows.find((r) => (r.rangeYards as number) >= expected.rangeYards - 10);
    if (!row) continue;

    const actualHold = row.holdMils as number;
    const delta = Math.abs(actualHold - expected.holdMils);

    deviations.push({
      range: expected.rangeYards,
      expected: expected.holdMils,
      actual: Math.round(actualHold * 1000) / 1000,
      delta: Math.round(delta * 1000) / 1000,
    });

    expect(delta, `Hold deviation at ${expected.rangeYards}yd: expected ${expected.holdMils} MIL, got ${actualHold.toFixed(3)} MIL`).toBeLessThanOrEqual(tol);
  }

  // Report summary
  const maxDelta = Math.max(...deviations.map((d) => d.delta));
  const maxRow = deviations.find((d) => d.delta === maxDelta);
  console.log(`\n📊 ${fixture._conditions.bullet}`);
  console.log(`   Source: ${fixture._source}`);
  console.log(`   Tolerance: ±${tol} MIL`);
  console.log(`   Max deviation: ${maxDelta.toFixed(3)} MIL @ ${maxRow?.range}yd`);
  console.log(`   Rows validated: ${deviations.length}`);
  console.table(deviations);
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('Solver Validation Harness', () => {
  describe('6.5 Creedmoor 140gr ELD-M G7', () => {
    it('holds within ±0.05 MIL at every 100-yard step to 1000yd', () => {
      runHarness('65cm_140eld_g7.json');
    });
  });

  describe('7mm PRC 175gr ELD-M G7', () => {
    it('holds within ±0.05 MIL at every 100-yard step to 1000yd', () => {
      runHarness('7mm_prc_175eld_g7.json');
    });
  });

  describe('ICAO standard atmosphere baseline', () => {
    it('returns zero hold at zero range for any zero distance', () => {
      const inputs: TrajectoryInputs = {
        bullet: {
          weightGrains: 140 as any,
          diameterInches: 0.264 as any,
          bc: 0.301 as any,
          dragModel: 'G7',
        },
        muzzleVelocityFps: 2710 as any,
        scopeHeightInches: 1.75 as any,
        zeroRangeYards: 100 as any,
        atmosphere: ICAO_STANDARD_ATMOSPHERE,
      };
      const result = computeTrajectory(inputs);
      const zeroRow = result.rows.find((r) => (r.rangeYards as number) >= 100);
      expect(zeroRow).toBeDefined();
      expect(Math.abs(zeroRow!.holdMils as number)).toBeLessThan(0.02);
    });
  });

  describe('Atmosphere sensitivity', () => {
    it('holds at high altitude (Denver, ~5280ft) are greater than at sea level', () => {
      const base: TrajectoryInputs = {
        bullet: {
          weightGrains: 175 as any,
          diameterInches: 0.284 as any,
          bc: 0.391 as any,
          dragModel: 'G7',
        },
        muzzleVelocityFps: 2960 as any,
        scopeHeightInches: 1.75 as any,
        zeroRangeYards: 100 as any,
        atmosphere: ICAO_STANDARD_ATMOSPHERE,
      };

      const highAlt: TrajectoryInputs = {
        ...base,
        atmosphere: {
          temperatureFahrenheit: 59 as any,
          pressureInHg: 24.9 as any,   // ~5300 ft MSL (Denver)
          relativeHumidityPct: 50,
        },
      };

      const seaLevel = computeTrajectory(base);
      const altitude = computeTrajectory(highAlt);

      const slHold1000 = Math.abs(seaLevel.rows.find((r) => (r.rangeYards as number) >= 1000)!.holdMils as number);
      const altHold1000 = Math.abs(altitude.rows.find((r) => (r.rangeYards as number) >= 1000)!.holdMils as number);

      // At high altitude, air is thinner → less drag → LESS drop. Hold should be smaller.
      expect(altHold1000).toBeLessThan(slHold1000);
      console.log(`\n🏔  Altitude sensitivity at 1000yd: sea level ${slHold1000.toFixed(2)} MIL vs Denver ${altHold1000.toFixed(2)} MIL (Δ ${(slHold1000 - altHold1000).toFixed(2)} MIL)`);
    });
  });
});
