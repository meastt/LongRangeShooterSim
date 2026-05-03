/**
 * Vacuum (no-drag) ballistic check used only to wire the validation harness.
 * Full G1/G7 modified point-mass kernel replaces this in Phase 0 continuation.
 */

const GRAVITY_MPS2 = 9.80665;

/** Convert yards to meters. */
export function yardsToMeters(yards: number): number {
  return yards * 0.9144;
}

/** Convert fps to m/s. */
export function fpsToMps(fps: number): number {
  return fps * 0.3048;
}

/** Convert meters to inches. */
export function metersToInches(meters: number): number {
  return meters / 0.0254;
}

/** Level fire, flat earth, constant horizontal velocity — drop magnitude in inches. */
export function dropInchesVacuumLevelFire(params: {
  rangeYards: number;
  muzzleVelocityFps: number;
}): number {
  const { rangeYards, muzzleVelocityFps } = params;
  const rangeM = yardsToMeters(rangeYards);
  const vx = fpsToMps(muzzleVelocityFps);
  if (vx <= 0) {
    throw new RangeError('muzzleVelocityFps must be positive');
  }
  const t = rangeM / vx;
  const dropM = 0.5 * GRAVITY_MPS2 * t * t;
  return metersToInches(dropM);
}
