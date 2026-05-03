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
 *   Hold formula (Litz, Applied Ballistics §8):
 *     windHoldMils = crosswindMph × timeOfFlightSeconds × (1/rangeYards × 27.778)
 *   In practice: windHoldMils = (crosswindMph × tof) / (rangeYards × 0.036)
 */
import { useEffect, useMemo, useState } from 'react';
import { computeTrajectory } from '@aim/solver';
import type { TrajectoryRow, TrajectoryInputs } from '@aim/solver';
import { getFieldProfile, getRiflesWithActiveLoad } from '../db/queries';
import type { FieldProfile } from '../db/queries';
import { useFieldStore } from '../store/fieldStore';

export interface SolverResult {
  row: TrajectoryRow;
  profile: FieldProfile;
  /** Crosswind elevation hold in milliradians. Positive = aim right (wind from left). */
  windHoldMils: number;
  /** Clicks to dial on the elevation turret (hold × clicksPerMrad). */
  dialClicks: number;
}

/**
 * Converts wind clock position (1–12) to the fractional crosswind component.
 * 12 o'clock = headwind = 0, 3 o'clock = full-value right = 1,
 * 6 o'clock = tailwind = 0, 9 o'clock = full-value left = -1.
 *
 * sin(clockAngle): clock positions are 0°=12, 90°=3, 180°=6, 270°=9
 */
function clockToWindFraction(clockPosition: number): number {
  // Map 1–12 to radians: 12 → 0, 3 → π/2, 6 → π, 9 → 3π/2
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

  const [profile, setProfile] = useState<FieldProfile | null>(null);

  // Reload profile whenever the active rifle changes.
  // If activeRifleId is null, auto-select the first available rifle.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      let rifleId = activeRifleId;

      // Auto-select first rifle if none is active (e.g. on first launch before
      // visiting Profiles tab — seed runs on the DB, but store hasn't been set yet).
      if (!rifleId) {
        const allRifles = await getRiflesWithActiveLoad();
        const first = allRifles[0];
        if (first) {
          rifleId = first.id;
          if (!cancelled) setActiveRifleId(rifleId);
        }
      }

      if (!rifleId) {
        if (!cancelled) setProfile(null);
        return;
      }

      const p = await getFieldProfile(rifleId);
      if (!cancelled) setProfile(p);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [activeRifleId, setActiveRifleId]);

  return useMemo(() => {
    if (!profile) return null;

    const atmosphere = atmosphericOverride ?? profile.atmosphericSnapshot;

    const inputs: TrajectoryInputs = {
      bullet: {
        weightGrains: profile.load.weightGrains as any,
        diameterInches: profile.load.diameterInches as any,
        bc: profile.load.bc as any,
        dragModel: profile.load.dragModel as 'G1' | 'G7',
      },
      muzzleVelocityFps: profile.load.muzzleVelocityFps as any,
      scopeHeightInches: profile.zero.scopeHeightInches as any,
      zeroRangeYards: profile.zero.zeroRangeYards as any,
      atmosphere,
    };

    const trajectoryOutput = computeTrajectory(inputs);

    // Find the row at or nearest to the selected range.
    const row =
      trajectoryOutput.rows.find((r) => r.rangeYards >= rangeYards) ??
      trajectoryOutput.rows[trajectoryOutput.rows.length - 1];

    if (!row) return null;

    // ── Wind hold ─────────────────────────────────────────────────────────────
    // crosswind component (mph) based on clock position
    const crosswindMph = windSpeedMph * clockToWindFraction(windClockPosition);

    // Wind hold in milliradians.
    // Derivation: drift_inches = crosswindMph * tof_seconds * 17.6  (mph→fps / 1 sec = 17.6)
    //   holdMil = drift_inches / (rangeYards * 0.036)
    // Simplified: holdMil = (crosswindMph * tof) / (rangeYards * 0.002045)
    // Positive holdMil = aim right (wind pushing left→right = wind from left).
    const rangeYd = row.rangeYards as number;
    const tof = row.timeOfFlightSeconds;
    const windHoldMils =
      rangeYd > 0
        ? (crosswindMph * tof * 17.6) / (rangeYd * 0.036)
        : 0;

    // ── Dial clicks ───────────────────────────────────────────────────────────
    const clicksPerMrad = profile.scope.clicksPerMrad;
    const dialClicks = Math.round(row.holdMils * clicksPerMrad);

    return { row, profile, windHoldMils, dialClicks };
  }, [profile, rangeYards, atmosphericOverride, windSpeedMph, windClockPosition]);
}
