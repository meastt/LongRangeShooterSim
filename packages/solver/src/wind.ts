import type { FeetPerSecond, Milliradians, Yards } from './types';

// 1 mph = 5280 ft / 3600 s
const MPH_TO_FPS = 5280 / 3600;

/**
 * First-order crosswind deflection via the lag-time (Didion) formula.
 *
 * A bullet is NOT blown sideways at the full wind speed for its whole flight.
 * In the point-mass model, constant crosswind deflection is exactly:
 *
 *   drift = Vw × lag,   lag = t − x / V0
 *
 * where t is time of flight, x is downrange distance, and V0 is muzzle
 * velocity. The lag time is the extra flight time caused by drag — a
 * dragless bullet (lag = 0) has zero wind drift regardless of TOF.
 *
 * Reference: Litz, Applied Ballistics for Long Range Shooting, 3rd ed., ch. 5
 * (wind deflection); McCoy, "Modern Exterior Ballistics" (1999), §7.2.
 *
 * Cross-check (.308 175gr SMK G7 0.243, 2600 fps, ICAO):
 *   500 yd, 10 mph full value → ~1.2 mil;  1000 yd → ~3.1 mil.
 * JBM/AB publish ~1.1 and ~3.0 mil for this load — first-order agreement.
 * (The formula this replaced — drift = Vw × TOF — gave 6.4 mil at 500 yd.)
 */
export function windDriftInches(
  crosswindMph: number,
  timeOfFlightSeconds: number,
  rangeYards: Yards,
  muzzleVelocityFps: FeetPerSecond,
): number {
  const rangeYd = rangeYards as number;
  const mv = muzzleVelocityFps as number;
  if (rangeYd <= 0 || mv <= 0) return 0;

  // Lag can only be positive — clamp guards against inconsistent inputs.
  const lagSeconds = Math.max(0, timeOfFlightSeconds - (rangeYd * 3) / mv);
  return crosswindMph * MPH_TO_FPS * lagSeconds * 12;
}

/**
 * Crosswind hold in milliradians.
 * Sign follows the crosswind sign convention of the caller:
 * positive crosswind (wind from the shooter's left, per the app's clock model)
 * yields a positive hold = aim right, into the wind.
 *
 * 1 MIL subtends 3.6 in per 100 yd → rangeYards × 0.036 in per MIL.
 */
export function windHoldMils(
  crosswindMph: number,
  timeOfFlightSeconds: number,
  rangeYards: Yards,
  muzzleVelocityFps: FeetPerSecond,
): Milliradians {
  const rangeYd = rangeYards as number;
  if (rangeYd <= 0) return 0 as Milliradians;

  const driftIn = windDriftInches(
    crosswindMph,
    timeOfFlightSeconds,
    rangeYards,
    muzzleVelocityFps,
  );
  return (driftIn / (rangeYd * 0.036)) as Milliradians;
}
