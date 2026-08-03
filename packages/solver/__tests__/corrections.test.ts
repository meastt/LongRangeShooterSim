import { describe, expect, it } from 'vitest';
import {
  computeHoldCorrections,
  millerStabilityFactor,
  spinDriftInches,
  computeTrajectory,
  ICAO_STANDARD_ATMOSPHERE,
} from '../src/index.js';
import type { TrajectoryInputs } from '../src/types.js';

describe('spin drift (Litz Eq 6.1)', () => {
  it('matches Litz worked example SG=1.8 TOF=1.6 → ≈8.9"', () => {
    const sd = spinDriftInches(1.8, 1.6);
    expect(sd).toBeCloseTo(8.9, 1);
  });
});

describe('Miller stability', () => {
  it('returns a plausible SG for a 175gr .308 1:10"', () => {
    const sg = millerStabilityFactor({
      weightGrains: 175,
      diameterInches: 0.308,
      twistInches: 10,
      muzzleVelocityFps: 2600,
      bulletLengthInches: 0.308 * 3.8,
    });
    expect(sg).toBeGreaterThan(1.2);
    expect(sg).toBeLessThan(3.5);
  });
});

describe('computeHoldCorrections', () => {
  it('returns zero deltas when optional fields omitted', () => {
    const c = computeHoldCorrections({
      rangeYards: 1000,
      timeOfFlightSeconds: 1.8,
      elevHoldMils: 12,
      windHoldMils: 1,
      crosswindMph: 0,
      muzzleVelocityFps: 2600,
      weightGrains: 175,
      diameterInches: 0.308,
    });
    expect(c.elevHoldDeltaMils).toBe(0);
    expect(c.windHoldDeltaMils).toBe(0);
    expect(c.stabilityFactor).toBeNull();
  });

  it('applies RH spin drift as negative wind hold (aim left)', () => {
    const c = computeHoldCorrections({
      rangeYards: 1000,
      timeOfFlightSeconds: 1.6,
      elevHoldMils: 10,
      windHoldMils: 0,
      crosswindMph: 0,
      muzzleVelocityFps: 2600,
      weightGrains: 175,
      diameterInches: 0.308,
      twistInches: 10,
      twistDirection: 'right',
      bulletLengthInches: 1.2,
    });
    expect(c.spinDriftMils as number).toBeGreaterThan(0);
    expect(c.windHoldDeltaMils as number).toBeLessThan(0);
  });

  it('scales elev hold by cos(incline)', () => {
    const flat = 10;
    const c = computeHoldCorrections({
      rangeYards: 500,
      timeOfFlightSeconds: 0.7,
      elevHoldMils: flat,
      windHoldMils: 0,
      crosswindMph: 0,
      muzzleVelocityFps: 2700,
      weightGrains: 140,
      diameterInches: 0.264,
      inclineDeg: 30,
    });
    expect(c.elevHoldDeltaMils as number).toBeCloseTo(flat * (Math.cos(Math.PI / 6) - 1), 5);
  });
});

describe('multi-segment BC', () => {
  const base: TrajectoryInputs = {
    bullet: {
      weightGrains: 140 as TrajectoryInputs['bullet']['weightGrains'],
      diameterInches: 0.264 as TrajectoryInputs['bullet']['diameterInches'],
      bc: 0.28 as TrajectoryInputs['bullet']['bc'],
      dragModel: 'G7',
    },
    muzzleVelocityFps: 2710 as TrajectoryInputs['muzzleVelocityFps'],
    scopeHeightInches: 1.5 as TrajectoryInputs['scopeHeightInches'],
    zeroRangeYards: 100 as TrajectoryInputs['zeroRangeYards'],
    atmosphere: ICAO_STANDARD_ATMOSPHERE,
  };

  it('higher BC segment above threshold reduces drop vs low single BC', () => {
    const low = computeTrajectory(base);
    const multi = computeTrajectory({
      ...base,
      bullet: {
        ...base.bullet,
        bc: 0.28 as TrajectoryInputs['bullet']['bc'],
        bcSegments: [
          {
            minVelocityFps: 2000 as TrajectoryInputs['muzzleVelocityFps'],
            bc: 0.34 as TrajectoryInputs['bullet']['bc'],
          },
        ],
      },
    });
    const low1000 = low.rows.find((r) => (r.rangeYards as number) === 1000);
    const multi1000 = multi.rows.find((r) => (r.rangeYards as number) === 1000);
    expect(low1000 && multi1000).toBeTruthy();
    // Less drop (path less negative) with higher BC early in flight
    expect(multi1000!.pathInches as number).toBeGreaterThan(low1000!.pathInches as number);
  });
});
