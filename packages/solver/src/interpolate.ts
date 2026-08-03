import type {
  FeetPerSecond,
  Inches,
  Milliradians,
  TrajectoryRow,
  Yards,
} from './types';

/**
 * Linearly interpolate a full solution at an arbitrary range from the
 * 25-yard trajectory table.
 *
 * Rationale: snapping to the nearest table row introduces up to 24 yd of
 * range error (~0.15 mil of elevation at distance). Over a 25-yd span every
 * output quantity is smooth enough that linear interpolation error is
 * < 0.01 mil — far below the 0.05 mil harness gate.
 *
 * Returns null when rangeYards is outside the computed table (e.g. the
 * bullet went subsonic/slow and integration stopped short). Callers should
 * fall back to the last available row and surface that to the user.
 */
export function solutionAtRange(
  rows: readonly TrajectoryRow[],
  rangeYards: number,
): TrajectoryRow | null {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (first === undefined || last === undefined) return null;
  if (rangeYards < (first.rangeYards as number)) return null;
  if (rangeYards > (last.rangeYards as number)) return null;

  for (let i = 0; i < rows.length; i++) {
    const curr = rows[i];
    if (curr === undefined) continue;

    const currRange = curr.rangeYards as number;
    if (currRange === rangeYards) return curr;
    if (currRange < rangeYards) continue;

    const prev = rows[i - 1];
    if (prev === undefined) return curr;

    const prevRange = prev.rangeYards as number;
    const span = currRange - prevRange;
    if (span <= 0) return curr;
    const f = (rangeYards - prevRange) / span;

    const lerp = (a: number, b: number): number => a + f * (b - a);

    return {
      rangeYards: rangeYards as Yards,
      dropInches: lerp(prev.dropInches as number, curr.dropInches as number) as Inches,
      pathInches: lerp(prev.pathInches as number, curr.pathInches as number) as Inches,
      velocityFps: lerp(
        prev.velocityFps as number,
        curr.velocityFps as number,
      ) as FeetPerSecond,
      mach: lerp(prev.mach, curr.mach),
      energyFtLbs: lerp(prev.energyFtLbs, curr.energyFtLbs),
      timeOfFlightSeconds: lerp(prev.timeOfFlightSeconds, curr.timeOfFlightSeconds),
      holdMils: lerp(prev.holdMils as number, curr.holdMils as number) as Milliradians,
    };
  }

  return last;
}
