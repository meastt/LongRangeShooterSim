/**
 * useSolverResult — memoised hook that drives the Field Mode HUD.
 *
 * Reads the active rifle profile from the DB, merges the field store's
 * atmospheric override (if any), calls the @aim/solver, and returns the
 * TrajectoryRow for the current range. Returns null when no profile is set
 * or the profile is incomplete (no zero recorded yet).
 *
 * Wind hold calculation:
 *   Clock-position model: position 3 or 9 = full value (90°), 12/6 = zero.
 *   Crosswind component = windSpeedMph × sin(clockAngleDeg)
 *   Hold uses the solver's lag-time (Didion) formula: drift = Vw × (TOF − range/MV).
 *   See packages/solver/src/wind.ts for derivation and validation fixtures.
 *
 * Suppressor + cold-bore corrections are applied post-solve per
 * docs/specs/suppressor-profiles.md and docs/specs/cold-bore-intelligence.md.
 * Advanced holds (spin/Coriolis/AJ/cant/incline) per
 * docs/specs/solver-advanced-corrections.md.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  computeHoldCorrections,
  computeTrajectory,
  solutionAtRange,
  windHoldMils,
} from '@aim/solver';
import type { TrajectoryRow } from '@aim/solver';
import { getColdBoreEvents, getFieldProfile, getRiflesWithActiveLoad } from '../db/queries';
import type { ColdBoreEventRow, FieldProfile } from '../db/queries';
import { useFieldStore } from '../store/fieldStore';
import { buildEffectiveSolutionInputs } from '../lib/profileToSolverInput';
import { predictColdBoreOffset } from '../lib/coldBore';
import type { ColdBorePrediction } from '../lib/coldBore';

export interface SolverResult {
  row: TrajectoryRow;
  profile: FieldProfile;
  /** Crosswind hold in milliradians (includes suppressor + advanced deltas). Positive = aim right. */
  windHoldMils: number;
  /** Elevation hold in milliradians after suppressor + cold-bore + advanced deltas. */
  elevHoldMils: number;
  /** Clicks to dial on the elevation turret (elevHold × clicksPerMrad). */
  dialClicks: number;
  /** Effective MV used in the solve (may include suppressor delta). */
  effectiveMvFps: number;
  suppressorDeltaMissing: boolean;
  coldBore: ColdBorePrediction | null;
  /** Whether cold-bore offset was added into elevHoldMils / dialClicks. */
  coldBoreApplied: boolean;
  /** Miller SG when twist is known; otherwise null. */
  stabilityFactor: number | null;
}

/**
 * Converts wind clock position (1–12) to the fractional crosswind component.
 * 12 o'clock = headwind = 0, 3 o'clock = full-value right = 1,
 * 6 o'clock = tailwind = 0, 9 o'clock = full-value left = -1.
 */
function clockToWindFraction(clockPosition: number): number {
  const deg = ((clockPosition - 12) / 12) * 360;
  return Math.sin((deg * Math.PI) / 180);
}

export function useSolverResult(): SolverResult | null {
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const setActiveRifleId = useFieldStore((s) => s.setActiveRifleId);
  const rangeYards = useFieldStore((s) => s.rangeYards);
  const atmosphericOverride = useFieldStore((s) => s.atmosphericOverride);
  const windSpeedMph = useFieldStore((s) => s.windSpeedMph);
  const windClockPosition = useFieldStore((s) => s.windClockPosition);
  const coldBoreApplyOffset = useFieldStore((s) => s.coldBoreApplyOffset);
  const latitudeDeg = useFieldStore((s) => s.latitudeDeg);
  const shotAzimuthDeg = useFieldStore((s) => s.shotAzimuthDeg);
  const inclineDeg = useFieldStore((s) => s.inclineDeg);
  const cantDeg = useFieldStore((s) => s.cantDeg);
  const profileEpoch = useFieldStore((s) => s.profileEpoch);

  const [profile, setProfile] = useState<FieldProfile | null>(null);
  const [coldEvents, setColdEvents] = useState<ColdBoreEventRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      let rifleId = activeRifleId;

      if (!rifleId) {
        const allRifles = await getRiflesWithActiveLoad();
        const first = allRifles[0];
        if (first) {
          rifleId = first.id;
          if (!cancelled) setActiveRifleId(rifleId);
        }
      }

      if (!rifleId) {
        if (!cancelled) {
          setProfile(null);
          setColdEvents([]);
        }
        return;
      }

      const [p, events] = await Promise.all([
        getFieldProfile(rifleId),
        getColdBoreEvents(rifleId),
      ]);
      if (!cancelled) {
        setProfile(p);
        setColdEvents(events);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [activeRifleId, setActiveRifleId, profileEpoch]);

  return useMemo(() => {
    if (!profile) return null;

    const atmosphere = atmosphericOverride ?? profile.atmosphericSnapshot;
    const effective = buildEffectiveSolutionInputs(profile, atmosphere, {
      latitudeDeg,
      azimuthDeg: shotAzimuthDeg,
      inclineDeg,
      cantDeg,
    });
    const trajectoryOutput = computeTrajectory(effective.trajectory);

    const row =
      solutionAtRange(trajectoryOutput.rows, rangeYards) ??
      trajectoryOutput.rows[trajectoryOutput.rows.length - 1];

    if (!row) return null;

    const crosswindMph = windSpeedMph * clockToWindFraction(windClockPosition);
    const windHoldBase = windHoldMils(
      crosswindMph,
      row.timeOfFlightSeconds,
      row.rangeYards,
      effective.effectiveMvFps as Parameters<typeof windHoldMils>[3],
    ) as number;

    const coldBore = predictColdBoreOffset(coldEvents, {
      loadId: profile.load.id,
      suppressorEnabled: profile.rifle.suppressorEnabled,
    });

    const coldBoreApplied =
      coldBoreApplyOffset && coldBore.canAutoApply && coldBore.sampleCount >= 3;

    const elevBeforeAdvanced =
      (row.holdMils as number) +
      effective.suppressorElevShiftMils +
      (coldBoreApplied ? coldBore.elevOffsetMils : 0);

    const windBeforeAdvanced = windHoldBase + effective.suppressorWindShiftMils;

    const t = effective.trajectory;
    const corrections = computeHoldCorrections({
      rangeYards: row.rangeYards as number,
      timeOfFlightSeconds: row.timeOfFlightSeconds,
      elevHoldMils: elevBeforeAdvanced,
      windHoldMils: windBeforeAdvanced,
      crosswindMph,
      muzzleVelocityFps: effective.effectiveMvFps,
      weightGrains: profile.load.weightGrains as number,
      diameterInches: profile.load.diameterInches as number,
      twistInches: t.twistInches,
      twistDirection: t.twistDirection,
      latitudeDeg: t.latitudeDeg,
      azimuthDeg: t.azimuthDeg,
      cantDeg: t.cantDeg,
      inclineDeg: t.inclineDeg,
    });

    const elevHoldMils =
      elevBeforeAdvanced + (corrections.elevHoldDeltaMils as number);
    const windHold =
      windBeforeAdvanced + (corrections.windHoldDeltaMils as number);
    const clicksPerMrad = profile.scope.clicksPerMrad;
    const dialClicks = Math.round(elevHoldMils * clicksPerMrad);

    return {
      row,
      profile,
      windHoldMils: windHold,
      elevHoldMils,
      dialClicks,
      effectiveMvFps: effective.effectiveMvFps,
      suppressorDeltaMissing: effective.suppressorDeltaMissing,
      coldBore,
      coldBoreApplied,
      stabilityFactor: corrections.stabilityFactor,
    };
  }, [
    profile,
    coldEvents,
    rangeYards,
    atmosphericOverride,
    windSpeedMph,
    windClockPosition,
    coldBoreApplyOffset,
    latitudeDeg,
    shotAzimuthDeg,
    inclineDeg,
    cantDeg,
  ]);
}
