// ─── Trajectory API (Phase 0) ────────────────────────────────────────────────
export { computeTrajectory } from './trajectory';

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
} from './types';

export { ICAO_STANDARD_ATMOSPHERE } from './types';

// ─── Atmosphere and drag internals (exported for testing / truing tools) ──────
export { computeAirProperties } from './atmosphere';
export type { AirProperties } from './atmosphere';
export { dragCoefficientAtMach, bcToSI } from './drag';

// ─── Vacuum helpers (Phase 0 harness wiring; kept for backward compatibility) ─
export {
  dropInchesVacuumLevelFire,
  fpsToMps,
  metersToInches,
  yardsToMeters,
} from './vacuum';
