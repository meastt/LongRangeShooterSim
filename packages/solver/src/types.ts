/**
 * Branded scalar types prevent accidentally mixing incompatible units at compile time.
 * Brand the value at the call site: `2600 as FeetPerSecond`
 * Reference: CLAUDE.md §Solver Package — branded types convention.
 */

export type Yards = number & { readonly __brand: 'Yards' };
export type Inches = number & { readonly __brand: 'Inches' };
export type FeetPerSecond = number & { readonly __brand: 'FeetPerSecond' };
export type Grains = number & { readonly __brand: 'Grains' };

/**
 * Ballistic coefficient in US conventional units (lb/in²).
 * G7 BCs for modern hunting bullets typically range 0.15–0.40 lb/in².
 * G1 BCs for the same bullets are typically 2–3× higher.
 */
export type LbsPerSquareInch = number & { readonly __brand: 'LbsPerSquareInch' };

export type Fahrenheit = number & { readonly __brand: 'Fahrenheit' };

/** Inches of mercury — station barometric pressure (not sea-level adjusted). */
export type InHg = number & { readonly __brand: 'InHg' };

/** Milliradians — angular unit used for scope adjustments and holds. */
export type Milliradians = number & { readonly __brand: 'Milliradians' };

// ─── Drag model ────────────────────────────────────────────────────────────────

/**
 * G1: Mayevski/Siacci standard. Used for most commercial ammo spec sheets.
 * G7: Litz/Sierra modern boat-tail reference. Better for long-range boat-tail hunting bullets.
 * Reference: Litz, Applied Ballistics for Long Range Shooting, 3rd ed., ch. 2.
 */
export type DragModel = 'G1' | 'G7';

// ─── Inputs ─────────────────────────────────────────────────────────────────

export type BulletParams = {
  readonly weightGrains: Grains;
  /** Bore diameter / projectile diameter. */
  readonly diameterInches: Inches;
  /** Ballistic coefficient in lb/in² for the selected drag model. */
  readonly bc: LbsPerSquareInch;
  readonly dragModel: DragModel;
};

/**
 * Atmospheric conditions at the shooter's position.
 * Use STATION pressure (the actual barometric reading) — not altitude-adjusted sea-level pressure.
 * Hunters typically read this directly from a Kestrel or similar weather instrument.
 */
export type AtmosphericConditions = {
  readonly temperatureFahrenheit: Fahrenheit;
  readonly pressureInHg: InHg;
  /** 0–100 percent. Higher humidity slightly reduces air density (water vapor < air). */
  readonly relativeHumidityPct: number;
};

export type TrajectoryInputs = {
  readonly bullet: BulletParams;
  /** Muzzle velocity at the crown, fps. */
  readonly muzzleVelocityFps: FeetPerSecond;
  /** Distance from bore centerline to scope optical axis, inches. */
  readonly scopeHeightInches: Inches;
  /** Range at which bullet crosses the line-of-sight, yards. */
  readonly zeroRangeYards: Yards;
  readonly atmosphere: AtmosphericConditions;
};

// ─── Outputs ─────────────────────────────────────────────────────────────────

export type TrajectoryRow = {
  readonly rangeYards: Yards;
  /**
   * Absolute ballistic drop below the boreline, inches.
   * Negative = bullet is below bore axis. At range 0 this is 0.
   */
  readonly dropInches: Inches;
  /**
   * Bullet height above the line-of-sight, inches.
   * Negative = bullet is below LOS; shooter must apply positive elevation.
   * At the zero range this is 0 by definition.
   */
  readonly pathInches: Inches;
  /** Scalar bullet speed, fps. */
  readonly velocityFps: FeetPerSecond;
  /** Speed / local speed of sound. */
  readonly mach: number;
  /** Kinetic energy, ft·lb. */
  readonly energyFtLbs: number;
  /** Cumulative time of flight from muzzle, seconds. */
  readonly timeOfFlightSeconds: number;
  /**
   * Elevation hold required to reach point of aim, milliradians.
   * Positive = aim higher than target (standard for below-LOS bullet path).
   * Derived: −pathInches / (rangeYards × 0.036)
   */
  readonly holdMils: Milliradians;
};

/**
 * Full trajectory from 0 to 1000 yards in 25-yard steps (41 rows).
 * Use Array.find to select the row at a specific range.
 */
export type TrajectoryOutput = {
  readonly inputs: TrajectoryInputs;
  readonly rows: readonly TrajectoryRow[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * ICAO standard sea-level atmosphere.
 * Reference: ICAO Doc 7488/3 (Manual of the ICAO Standard Atmosphere, 3rd ed., 1993).
 */
export const ICAO_STANDARD_ATMOSPHERE: AtmosphericConditions = {
  temperatureFahrenheit: 59 as Fahrenheit,
  pressureInHg: 29.921 as InHg,
  relativeHumidityPct: 0,
};
