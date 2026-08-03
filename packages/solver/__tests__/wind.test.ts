import { describe, expect, it } from 'vitest';

import { computeTrajectory } from '../src/trajectory.js';
import { solutionAtRange } from '../src/interpolate.js';
import { windHoldMils, windDriftInches } from '../src/wind.js';
import type { TrajectoryInputs, Yards, FeetPerSecond } from '../src/types.js';
import { ICAO_STANDARD_ATMOSPHERE } from '../src/types.js';

// .308 Win 175gr SMK — same load as the ground-truth trajectory fixture.
const SMK_308: TrajectoryInputs = {
  bullet: {
    weightGrains: 175 as TrajectoryInputs['bullet']['weightGrains'],
    diameterInches: 0.308 as TrajectoryInputs['bullet']['diameterInches'],
    bc: 0.243 as TrajectoryInputs['bullet']['bc'],
    dragModel: 'G7',
  },
  muzzleVelocityFps: 2600 as FeetPerSecond,
  scopeHeightInches: 1.5 as TrajectoryInputs['scopeHeightInches'],
  zeroRangeYards: 100 as Yards,
  atmosphere: ICAO_STANDARD_ATMOSPHERE,
};

const MV = SMK_308.muzzleVelocityFps;

describe('wind hold (lag-time formula)', () => {
  const output = computeTrajectory(SMK_308);

  function holdAt(rangeYd: number, windMph: number): number {
    const row = solutionAtRange(output.rows, rangeYd);
    expect(row, `no row at ${rangeYd} yd`).not.toBeNull();
    if (row === null) return NaN;
    return windHoldMils(windMph, row.timeOfFlightSeconds, row.rangeYards, MV) as number;
  }

  // Published references (JBM / Applied Ballistics, 10 mph full value):
  //   500 yd ≈ 20" ≈ 1.1 mil, 1000 yd ≈ 3.0 mil for this load.
  // First-order lag-time agrees within ~0.2 mil — the tolerance below.
  it('500 yd, 10 mph ≈ 1.1 mil (NOT the old ~6.4 mil)', () => {
    const hold = holdAt(500, 10);
    expect(hold).toBeGreaterThan(0.9);
    expect(hold).toBeLessThan(1.4);
  });

  it('1000 yd, 10 mph ≈ 3 mil', () => {
    const hold = holdAt(1000, 10);
    expect(hold).toBeGreaterThan(2.5);
    expect(hold).toBeLessThan(3.5);
  });

  it('scales linearly with wind speed', () => {
    expect(holdAt(600, 20)).toBeCloseTo(holdAt(600, 10) * 2, 6);
  });

  it('negative crosswind (wind from right) gives negative hold (aim left)', () => {
    expect(holdAt(600, -10)).toBeCloseTo(-holdAt(600, 10), 6);
  });

  it('zero at zero range and zero wind', () => {
    expect(windHoldMils(10, 0, 0 as Yards, MV) as number).toBe(0);
    expect(holdAt(500, 0)).toBe(0);
  });

  it('dragless flight produces zero drift (lag = 0)', () => {
    // TOF exactly range/MV means no lag — no drift regardless of wind.
    const tofNoDrag = (500 * 3) / (MV as number);
    expect(windDriftInches(10, tofNoDrag, 500 as Yards, MV)).toBe(0);
  });
});

describe('solutionAtRange interpolation', () => {
  const output = computeTrajectory(SMK_308);

  it('exact table ranges return the table row', () => {
    const row = solutionAtRange(output.rows, 500);
    const table = output.rows.find((r) => (r.rangeYards as number) === 500);
    expect(row).toEqual(table);
  });

  it('interpolated hold at 460 yd sits between the 450 and 475 rows', () => {
    const r450 = solutionAtRange(output.rows, 450);
    const r460 = solutionAtRange(output.rows, 460);
    const r475 = solutionAtRange(output.rows, 475);
    expect(r450).not.toBeNull();
    expect(r460).not.toBeNull();
    expect(r475).not.toBeNull();
    if (!r450 || !r460 || !r475) return;

    expect(r460.rangeYards as number).toBe(460);
    expect(r460.holdMils as number).toBeGreaterThan(r450.holdMils as number);
    expect(r460.holdMils as number).toBeLessThan(r475.holdMils as number);
    // Interpolation error vs a fresh 25-yd-grid solve must be tiny:
    // hold is smooth over 25 yd, so linear interp lands within 0.01 mil
    // of the 40%-point between the bracketing rows.
    const lerp =
      (r450.holdMils as number) +
      0.4 * ((r475.holdMils as number) - (r450.holdMils as number));
    expect(Math.abs((r460.holdMils as number) - lerp)).toBeLessThan(0.01);
  });

  it('returns null beyond the computed table', () => {
    const last = output.rows[output.rows.length - 1];
    expect(last).toBeDefined();
    if (!last) return;
    expect(solutionAtRange(output.rows, (last.rangeYards as number) + 50)).toBeNull();
  });

  it('trajectory table now extends past 1000 yd for centerfire loads', () => {
    const r1400 = solutionAtRange(output.rows, 1400);
    expect(r1400).not.toBeNull();
  });
});
