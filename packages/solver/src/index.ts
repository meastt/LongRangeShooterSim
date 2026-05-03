// ─── Trajectory API (Phase 0) ────────────────────────────────────────────────
export { computeTrajectory } from './trajectory.js';

export type {
  BulletParams,
  AtmosphericConditions,
  TrajectoryInputs,
  TrajectoryRow,
  TrajectoryOutput,
  DragModel,
  Yards,
  Inches,
  FeetPerSecond,
  Grains,
  LbsPerSquareInch,
  Fahrenheit,
  InHg,
  Milliradians,
} from './types.js';

export { ICAO_STANDARD_ATMOSPHERE } from './types.js';

// ─── Atmosphere and drag internals (exported for testing / truing tools) ──────
export { computeAirProperties } from './atmosphere.js';
export type { AirProperties } from './atmosphere.js';
export { dragCoefficientAtMach, bcToSI } from './drag.js';

// ─── Vacuum helpers (Phase 0 harness wiring; kept for backward compatibility) ─
export {
  dropInchesVacuumLevelFire,
  fpsToMps,
  metersToInches,
  yardsToMeters,
} from './vacuum.js';
