import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { computeTrajectory } from '../src/trajectory.js';
import { dropInchesVacuumLevelFire } from '../src/vacuum.js';
import type { TrajectoryInputs } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixturesDir(): string {
  return join(__dirname, '..', '__fixtures__');
}

// ─── Fixture types ────────────────────────────────────────────────────────────

type VacuumFixture = {
  readonly id: string;
  readonly description: string;
  readonly inputs: {
    readonly rangeYards: number;
    readonly muzzleVelocityFps: number;
  };
  readonly expected: {
    readonly dropInches: number;
    readonly toleranceInches: number;
  };
};

type TrajectoryFixtureRow = {
  readonly rangeYards: number;
  readonly pathInches: number;
  readonly toleranceInches: number;
};

type TrajectoryFixture = {
  readonly id: string;
  readonly description: string;
  readonly note?: string;
  readonly inputs: {
    readonly bullet: {
      readonly weightGrains: number;
      readonly diameterInches: number;
      readonly bc: number;
      readonly dragModel: 'G1' | 'G7';
    };
    readonly muzzleVelocityFps: number;
    readonly scopeHeightInches: number;
    readonly zeroRangeYards: number;
    readonly atmosphere: {
      readonly temperatureFahrenheit: number;
      readonly pressureInHg: number;
      readonly relativeHumidityPct: number;
    };
  };
  readonly expectedRows: readonly TrajectoryFixtureRow[];
};

// ─── Loaders ─────────────────────────────────────────────────────────────────

function loadVacuumFixture(name: string): VacuumFixture {
  return JSON.parse(readFileSync(join(fixturesDir(), name), 'utf8')) as VacuumFixture;
}

function loadTrajectoryFixture(name: string): TrajectoryFixture {
  return JSON.parse(
    readFileSync(join(fixturesDir(), name), 'utf8'),
  ) as TrajectoryFixture;
}

function fixtureToInputs(f: TrajectoryFixture): TrajectoryInputs {
  return {
    bullet: {
      weightGrains: f.inputs.bullet.weightGrains as TrajectoryInputs['bullet']['weightGrains'],
      diameterInches: f.inputs.bullet.diameterInches as TrajectoryInputs['bullet']['diameterInches'],
      bc: f.inputs.bullet.bc as TrajectoryInputs['bullet']['bc'],
      dragModel: f.inputs.bullet.dragModel,
    },
    muzzleVelocityFps: f.inputs.muzzleVelocityFps as TrajectoryInputs['muzzleVelocityFps'],
    scopeHeightInches: f.inputs.scopeHeightInches as TrajectoryInputs['scopeHeightInches'],
    zeroRangeYards: f.inputs.zeroRangeYards as TrajectoryInputs['zeroRangeYards'],
    atmosphere: {
      temperatureFahrenheit: f.inputs.atmosphere.temperatureFahrenheit as TrajectoryInputs['atmosphere']['temperatureFahrenheit'],
      pressureInHg: f.inputs.atmosphere.pressureInHg as TrajectoryInputs['atmosphere']['pressureInHg'],
      relativeHumidityPct: f.inputs.atmosphere.relativeHumidityPct,
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('solver validation harness', () => {
  // ── Vacuum sanity (harness wiring check) ──────────────────────────────────
  it('vacuum-sanity fixture matches computed drop', () => {
    const fixture = loadVacuumFixture('vacuum-sanity.json');
    const computed = dropInchesVacuumLevelFire(fixture.inputs);
    expect(Math.abs(computed - fixture.expected.dropInches)).toBeLessThanOrEqual(
      fixture.expected.toleranceInches,
    );
  });

  // ── G7 trajectory table ───────────────────────────────────────────────────
  describe('g7-308-175smk-2600fps trajectory', () => {
    const fixture = loadTrajectoryFixture('g7-308-175smk-2600fps.json');
    const inputs = fixtureToInputs(fixture);
    const output = computeTrajectory(inputs);

    /**
     * Report per-range deviations so failures are easy to diagnose.
     * Excess error in the 600–800 yd range usually indicates a Cd table
     * discrepancy in the transonic region.
     */
    let maxDeviationIn = 0;
    let maxDeviationRange = 0;

    for (const expected of fixture.expectedRows) {
      it(`path at ${expected.rangeYards} yd is within ${expected.toleranceInches}" of ${expected.pathInches}"`, () => {
        const row = output.rows.find((r) => (r.rangeYards as number) === expected.rangeYards);
        expect(row, `no output row at ${expected.rangeYards} yd`).toBeDefined();
        if (row === undefined) return;

        const deviation = Math.abs((row.pathInches as number) - expected.pathInches);
        const rangeYd = expected.rangeYards;
        const deviationMils =
          rangeYd > 0 ? deviation / (rangeYd * 0.036) : deviation;

        if (deviation > maxDeviationIn) {
          maxDeviationIn = deviation;
          maxDeviationRange = rangeYd;
        }

        expect(
          deviation,
          `At ${rangeYd} yd: computed ${(row.pathInches as number).toFixed(1)}", ` +
            `expected ${expected.pathInches}", ` +
            `deviation ${deviation.toFixed(2)}" (${deviationMils.toFixed(3)} mil)`,
        ).toBeLessThanOrEqual(expected.toleranceInches);
      });
    }

    it('reports max deviation summary (informational)', () => {
      // This test always passes; its purpose is to emit the max deviation
      // so the harness output shows progress toward the 0.05 mil production gate.
      const lastRow = output.rows.find((r) => (r.rangeYards as number) === 1000);
      if (lastRow !== undefined) {
        const path1000 = lastRow.pathInches as number;
        const hold1000 = lastRow.holdMils as number;
        console.info(
          `[harness] 1000 yd — path: ${path1000.toFixed(1)}", ` +
            `hold: ${hold1000.toFixed(3)} mil, ` +
            `velocity: ${(lastRow.velocityFps as number).toFixed(0)} fps, ` +
            `energy: ${lastRow.energyFtLbs.toFixed(0)} ft·lb, ` +
            `TOF: ${lastRow.timeOfFlightSeconds.toFixed(3)} s`,
        );
      }
      expect(true).toBe(true);
    });
  });
});
