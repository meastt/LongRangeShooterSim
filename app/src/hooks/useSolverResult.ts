/**
 * useSolverResult — memoised hook that drives the Field Mode HUD.
 *
 * Reads the active rifle profile from the DB, merges the field store's
 * atmospheric override (if any), calls the @aim/solver, and returns the
 * TrajectoryRow for the current range. Returns null when no profile is set
 * or the profile is incomplete (no zero recorded yet).
 */
import { useEffect, useMemo, useState } from 'react';
import { computeTrajectory, ICAO_STANDARD_ATMOSPHERE } from '@aim/solver';
import type { TrajectoryRow, TrajectoryInputs } from '@aim/solver';
import { getFieldProfile } from '../db/queries';
import type { FieldProfile } from '../db/queries';
import { useFieldStore } from '../store/fieldStore';

export interface SolverResult {
  row: TrajectoryRow;
  profile: FieldProfile;
}

export function useSolverResult(): SolverResult | null {
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const rangeYards = useFieldStore((s) => s.rangeYards);
  const atmosphericOverride = useFieldStore((s) => s.atmosphericOverride);

  const [profile, setProfile] = useState<FieldProfile | null>(null);

  // Reload profile whenever the active rifle changes.
  useEffect(() => {
    if (!activeRifleId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    getFieldProfile(activeRifleId).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [activeRifleId]);

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

    return { row, profile };
  }, [profile, rangeYards, atmosphericOverride]);
}
