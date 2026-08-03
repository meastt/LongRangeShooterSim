/**
 * Advanced hold corrections — post-process on MPM trajectory rows.
 * Spec: docs/specs/solver-advanced-corrections.md
 *
 * These do NOT alter the Phase 0 RK4 path table. When optional inputs are
 * omitted, callers get zero deltas and the harness remains unchanged.
 *
 * References:
 *   Litz, Applied Ballistics for Long Range Shooting — Eq 6.1 (spin drift)
 *   Don Miller — gyroscopic stability formula
 *   McCoy, Modern Exterior Ballistics — Coriolis overview
 */
import type { Milliradians } from './types';

/** Earth sidereal rotation rate (rad/s). */
const OMEGA_EARTH = 7.292115e-5;

export type TwistDirection = 'right' | 'left';

export type CorrectionInputs = {
  readonly rangeYards: number;
  readonly timeOfFlightSeconds: number;
  readonly elevHoldMils: number;
  readonly windHoldMils: number;
  /** Crosswind mph; + = from shooter's left (matches Field HUD clock model). */
  readonly crosswindMph: number;
  readonly muzzleVelocityFps: number;
  readonly weightGrains: number;
  readonly diameterInches: number;
  readonly twistInches?: number;
  readonly twistDirection?: TwistDirection;
  readonly bulletLengthInches?: number;
  readonly latitudeDeg?: number;
  /** 0 = North, clockwise degrees. */
  readonly azimuthDeg?: number;
  readonly cantDeg?: number;
  readonly inclineDeg?: number;
};

export type HoldCorrections = {
  readonly elevHoldDeltaMils: Milliradians;
  readonly windHoldDeltaMils: Milliradians;
  readonly spinDriftMils: Milliradians;
  readonly coriolisWindageMils: Milliradians;
  readonly coriolisElevMils: Milliradians;
  readonly aeroJumpElevMils: Milliradians;
  readonly stabilityFactor: number | null;
};

function inchesToMils(inches: number, rangeYards: number): number {
  if (rangeYards <= 0) return 0;
  return inches / (rangeYards * 0.036);
}

/**
 * Don Miller gyroscopic stability factor (dimensionless).
 * SG ≥ ~1.4 preferred at the muzzle for hunting boat-tails.
 */
export function millerStabilityFactor(opts: {
  weightGrains: number;
  diameterInches: number;
  twistInches: number;
  muzzleVelocityFps: number;
  bulletLengthInches: number;
}): number {
  const d = opts.diameterInches;
  if (d <= 0 || opts.twistInches <= 0 || opts.bulletLengthInches <= 0) return 0;
  const t = opts.twistInches / d; // calibers per turn
  const l = opts.bulletLengthInches / d; // length in calibers
  const mvFactor = Math.pow(opts.muzzleVelocityFps / 2800, 1 / 3);
  const denom = t * t * d * d * d * l * (1 + l * l);
  if (denom <= 0) return 0;
  return (30 * opts.weightGrains * mvFactor) / denom;
}

/**
 * Litz Eq 6.1 — spin drift in inches (magnitude). Direction from twist.
 * Example (Litz): SG=1.8, TOF=1.6 s → ≈ 8.9".
 */
export function spinDriftInches(stabilityFactor: number, timeOfFlightSeconds: number): number {
  if (stabilityFactor <= 0 || timeOfFlightSeconds <= 0) return 0;
  return 1.25 * (stabilityFactor + 1.2) * Math.pow(timeOfFlightSeconds, 1.83);
}

/**
 * Flat-fire Coriolis deflections in inches.
 * Horizontal +: POI right (Northern Hemisphere).
 * Vertical +: POI high (firing east, az=90).
 */
export function coriolisDeflectionInches(opts: {
  latitudeDeg: number;
  azimuthDeg: number;
  rangeYards: number;
  timeOfFlightSeconds: number;
}): { horizontalInches: number; verticalInches: number } {
  const t = opts.timeOfFlightSeconds;
  if (t <= 0 || opts.rangeYards <= 0) {
    return { horizontalInches: 0, verticalInches: 0 };
  }
  const lat = (opts.latitudeDeg * Math.PI) / 180;
  const az = (opts.azimuthDeg * Math.PI) / 180;
  const rangeM = opts.rangeYards * 0.9144;
  const vBar = rangeM / t;
  const hM = OMEGA_EARTH * Math.sin(lat) * vBar * t * t;
  const vM = OMEGA_EARTH * Math.cos(lat) * Math.sin(az) * vBar * t * t;
  return {
    horizontalInches: hM / 0.0254,
    verticalInches: vM / 0.0254,
  };
}

/**
 * First-order aerodynamic jump POI (inches high). Spec §4.4.
 * RH twist + wind from left (our +crosswind) → jump down (negative).
 */
export function aerodynamicJumpInchesHigh(
  crosswindMph: number,
  stabilityFactor: number,
  twistDirection: TwistDirection,
): number {
  if (crosswindMph === 0 || stabilityFactor <= 0) return 0;
  const sg = Math.max(stabilityFactor, 1.0);
  // Magnitude scales with wind / SG; sign depends on twist × wind side.
  const signed =
    twistDirection === 'right'
      ? -0.0432 * crosswindMph * (1.5 / sg) // inches high per mph (order-of-magnitude)
      : +0.0432 * crosswindMph * (1.5 / sg);
  return signed;
}

export function computeHoldCorrections(input: CorrectionInputs): HoldCorrections {
  const range = input.rangeYards;
  const twistDir = input.twistDirection ?? 'right';

  let sg: number | null = null;
  let spinPoiRightMils = 0;
  let ajHighMils = 0;

  if (input.twistInches != null && input.twistInches > 0 && input.diameterInches > 0) {
    const length =
      input.bulletLengthInches ?? input.diameterInches * 3.8;
    sg = millerStabilityFactor({
      weightGrains: input.weightGrains,
      diameterInches: input.diameterInches,
      twistInches: input.twistInches,
      muzzleVelocityFps: input.muzzleVelocityFps,
      bulletLengthInches: length,
    });
    const sdIn = spinDriftInches(sg, input.timeOfFlightSeconds);
    const sdMils = inchesToMils(sdIn, range);
    spinPoiRightMils = twistDir === 'right' ? sdMils : -sdMils;

    const ajIn = aerodynamicJumpInchesHigh(input.crosswindMph, sg, twistDir);
    ajHighMils = inchesToMils(ajIn, range);
  }

  let coriolisRightMils = 0;
  let coriolisHighMils = 0;
  if (input.latitudeDeg != null && input.azimuthDeg != null) {
    const c = coriolisDeflectionInches({
      latitudeDeg: input.latitudeDeg,
      azimuthDeg: input.azimuthDeg,
      rangeYards: range,
      timeOfFlightSeconds: input.timeOfFlightSeconds,
    });
    coriolisRightMils = inchesToMils(c.horizontalInches, range);
    coriolisHighMils = inchesToMils(c.verticalInches, range);
  }

  // Convert POI offsets → hold deltas (compensate opposite to POI).
  let elevDelta = -coriolisHighMils - ajHighMils;
  let windDelta = -spinPoiRightMils - coriolisRightMils;

  // Incline: scale flat elev hold
  if (input.inclineDeg != null && input.inclineDeg !== 0) {
    const cosI = Math.cos((input.inclineDeg * Math.PI) / 180);
    elevDelta += input.elevHoldMils * (cosI - 1);
  }

  // Cant: rotate elev/wind holds in the sight plane
  if (input.cantDeg != null && input.cantDeg !== 0) {
    const th = (input.cantDeg * Math.PI) / 180;
    const elev0 = input.elevHoldMils + elevDelta;
    const wind0 = input.windHoldMils + windDelta;
    const elevC = elev0 * Math.cos(th);
    const windC = wind0 * Math.cos(th) + elev0 * Math.sin(th);
    elevDelta += elevC - elev0;
    windDelta += windC - wind0;
  }

  // Normalize -0 → 0 so Object.is equality in tests / UI stays clean.
  const nz = (n: number) => (Object.is(n, -0) ? 0 : n);

  return {
    elevHoldDeltaMils: nz(elevDelta) as Milliradians,
    windHoldDeltaMils: nz(windDelta) as Milliradians,
    spinDriftMils: nz(spinPoiRightMils) as Milliradians,
    coriolisWindageMils: nz(coriolisRightMils) as Milliradians,
    coriolisElevMils: nz(coriolisHighMils) as Milliradians,
    aeroJumpElevMils: nz(ajHighMils) as Milliradians,
    stabilityFactor: sg,
  };
}
