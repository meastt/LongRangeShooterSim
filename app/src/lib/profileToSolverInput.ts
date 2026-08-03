/**
 * Maps a FieldProfile (+ field overrides) to solver inputs and post-hold corrections.
 * Spec: docs/specs/suppressor-profiles.md
 * Advanced: docs/specs/solver-advanced-corrections.md
 */
import type { AtmosphericConditions, TrajectoryInputs } from '@aim/solver';
import type { FieldProfile } from '../db/queries';

export type AdvancedFieldOpts = {
  latitudeDeg?: number | null;
  azimuthDeg?: number | null;
  inclineDeg?: number | null;
  cantDeg?: number | null;
};

export type EffectiveSolutionInputs = {
  trajectory: TrajectoryInputs;
  /** Effective MV after suppressor delta (if any). */
  effectiveMvFps: number;
  /** Elev hold add-on from suppressor zero shift (mils). */
  suppressorElevShiftMils: number;
  /** Wind hold add-on from suppressor zero shift (mils). */
  suppressorWindShiftMils: number;
  /** True when can is on but MV delta was never measured. */
  suppressorDeltaMissing: boolean;
};

/**
 * Build trajectory inputs with suppressor MV applied when measured.
 * Null delta + suppressor on → bare MV (no invented default) + warning flag.
 * Passes twist / incline / lat-az when available for advanced corrections.
 */
export function buildEffectiveSolutionInputs(
  profile: FieldProfile,
  atmosphere: AtmosphericConditions,
  opts?: AdvancedFieldOpts,
): EffectiveSolutionInputs {
  const bareMv = profile.load.muzzleVelocityFps as number;
  const delta = profile.load.suppressorMvDeltaFps;
  const canOn = profile.rifle.suppressorEnabled;
  const hasDelta = delta != null && Number.isFinite(delta);

  const effectiveMvFps =
    canOn && hasDelta ? bareMv + (delta as number) : bareMv;

  const suppressorElevShiftMils =
    canOn && profile.load.suppressorZeroShiftMilsElev != null
      ? (profile.load.suppressorZeroShiftMilsElev as number)
      : 0;

  const suppressorWindShiftMils =
    canOn && profile.load.suppressorZeroShiftMilsWind != null
      ? (profile.load.suppressorZeroShiftMilsWind as number)
      : 0;

  const twist = profile.rifle.twistRateIn;

  const trajectory: TrajectoryInputs = {
    bullet: {
      weightGrains: profile.load.weightGrains as TrajectoryInputs['bullet']['weightGrains'],
      diameterInches: profile.load.diameterInches as TrajectoryInputs['bullet']['diameterInches'],
      bc: profile.load.bc as TrajectoryInputs['bullet']['bc'],
      dragModel: profile.load.dragModel as 'G1' | 'G7',
    },
    muzzleVelocityFps: effectiveMvFps as TrajectoryInputs['muzzleVelocityFps'],
    scopeHeightInches: profile.zero.scopeHeightInches as TrajectoryInputs['scopeHeightInches'],
    zeroRangeYards: profile.zero.zeroRangeYards as TrajectoryInputs['zeroRangeYards'],
    atmosphere,
    ...(twist != null && twist > 0
      ? { twistInches: twist, twistDirection: 'right' as const }
      : {}),
    ...(opts?.latitudeDeg != null ? { latitudeDeg: opts.latitudeDeg } : {}),
    ...(opts?.azimuthDeg != null ? { azimuthDeg: opts.azimuthDeg } : {}),
    ...(opts?.inclineDeg != null && opts.inclineDeg !== 0
      ? { inclineDeg: opts.inclineDeg }
      : {}),
    ...(opts?.cantDeg != null && opts.cantDeg !== 0 ? { cantDeg: opts.cantDeg } : {}),
  };

  return {
    trajectory,
    effectiveMvFps,
    suppressorElevShiftMils,
    suppressorWindShiftMils,
    suppressorDeltaMissing: canOn && !hasDelta,
  };
}
