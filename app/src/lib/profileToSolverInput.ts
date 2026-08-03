/**
 * Maps a FieldProfile (+ field overrides) to solver inputs and post-hold corrections.
 * Spec: docs/specs/suppressor-profiles.md
 */
import type { AtmosphericConditions, TrajectoryInputs } from '@aim/solver';
import type { FieldProfile } from '../db/queries';

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
 */
export function buildEffectiveSolutionInputs(
  profile: FieldProfile,
  atmosphere: AtmosphericConditions,
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
  };

  return {
    trajectory,
    effectiveMvFps,
    suppressorElevShiftMils,
    suppressorWindShiftMils,
    suppressorDeltaMissing: canOn && !hasDelta,
  };
}
