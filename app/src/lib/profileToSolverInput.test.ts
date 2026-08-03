import { describe, expect, it } from 'vitest';
import { buildEffectiveSolutionInputs } from './profileToSolverInput';
import type { FieldProfile } from '../db/queries';
import { ICAO_STANDARD_ATMOSPHERE } from '@aim/solver';

function fakeProfile(overrides: {
  suppressorEnabled?: boolean;
  bareMv?: number;
  delta?: number | null;
  elevShift?: number | null;
}): FieldProfile {
  return {
    rifle: {
      id: 'r1',
      name: 'Test',
      caliber: '6.5 Creedmoor',
      twistRateIn: 8,
      barrelLengthIn: 24,
      suppressorEnabled: overrides.suppressorEnabled ?? false,
      notes: null,
      createdAt: '',
      updatedAt: '',
    },
    load: {
      id: 'l1',
      rifleId: 'r1',
      isActive: true,
      bulletName: 'ELD-M',
      weightGrains: 140,
      diameterInches: 0.264,
      bc: 0.31,
      dragModel: 'G7',
      muzzleVelocityFps: overrides.bareMv ?? 2950,
      powderCharge: null,
      libraryBulletId: null,
      suppressorMvDeltaFps: overrides.delta === undefined ? null : overrides.delta,
      suppressorZeroShiftMilsElev: overrides.elevShift === undefined ? null : overrides.elevShift,
      suppressorZeroShiftMilsWind: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
    },
    scope: {
      id: 's1',
      rifleId: 'r1',
      name: 'Scope',
      clicksPerMrad: 10,
      turretCapMrad: null,
      createdAt: '',
      updatedAt: '',
    },
    zero: {
      id: 'z1',
      loadId: 'l1',
      scopeId: 's1',
      zeroRangeYards: 100,
      scopeHeightInches: 1.5,
      zeroDate: '2026-01-01',
      atmosphericSnapshot: '{}',
      notes: null,
      createdAt: '',
    },
    atmosphericSnapshot: ICAO_STANDARD_ATMOSPHERE,
  };
}

describe('buildEffectiveSolutionInputs', () => {
  it('applies suppressor MV delta when can is on and delta measured', () => {
    const e = buildEffectiveSolutionInputs(
      fakeProfile({ suppressorEnabled: true, bareMv: 2950, delta: -40 }),
      ICAO_STANDARD_ATMOSPHERE,
    );
    expect(e.effectiveMvFps).toBe(2910);
    expect(e.trajectory.muzzleVelocityFps).toBe(2910);
    expect(e.suppressorDeltaMissing).toBe(false);
  });

  it('uses bare MV when can is on but delta is null', () => {
    const e = buildEffectiveSolutionInputs(
      fakeProfile({ suppressorEnabled: true, bareMv: 2950, delta: null }),
      ICAO_STANDARD_ATMOSPHERE,
    );
    expect(e.effectiveMvFps).toBe(2950);
    expect(e.suppressorDeltaMissing).toBe(true);
  });

  it('restores bare MV when suppressor toggled off', () => {
    const e = buildEffectiveSolutionInputs(
      fakeProfile({ suppressorEnabled: false, bareMv: 2950, delta: -40, elevShift: 0.1 }),
      ICAO_STANDARD_ATMOSPHERE,
    );
    expect(e.effectiveMvFps).toBe(2950);
    expect(e.suppressorElevShiftMils).toBe(0);
  });

  it('applies elev zero shift only when can is on', () => {
    const e = buildEffectiveSolutionInputs(
      fakeProfile({ suppressorEnabled: true, delta: -40, elevShift: 0.1 }),
      ICAO_STANDARD_ATMOSPHERE,
    );
    expect(e.suppressorElevShiftMils).toBeCloseTo(0.1);
  });
});
