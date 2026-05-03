import { computeAirProperties } from './atmosphere.js';
import { bcToSI, dragCoefficientAtMach } from './drag.js';
import type {
  TrajectoryInputs,
  TrajectoryOutput,
  TrajectoryRow,
  Yards,
  Inches,
  FeetPerSecond,
  Milliradians,
} from './types.js';

// ─── Physical constants ───────────────────────────────────────────────────────

const GRAVITY_MPS2 = 9.80665;
const YARDS_TO_METERS = 0.9144;
const INCHES_TO_METERS = 0.0254;
const FPS_TO_MPS = 0.3048;
const MPS_TO_FPS = 1 / FPS_TO_MPS;
// 1 gr = 6.47989×10⁻⁵ kg (exact: 1 lb = 7000 gr, 1 lb = 0.45359237 kg)
const GRAINS_TO_KG = 6.47989e-5;
// 1 J = 0.737562 ft·lb
const JOULES_TO_FT_LBS = 0.737562;

// Output ranges: every 25 yards from 0 to 1000 yards inclusive
const OUTPUT_RANGES_YARDS: readonly number[] = Array.from(
  { length: 41 },
  (_, i) => i * 25,
);

// ─── Integrator state ────────────────────────────────────────────────────────

/**
 * 2D point-mass state in SI units.
 * x = downrange distance (m, positive forward)
 * y = height above bore centerline (m, positive up)
 */
type State = {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
};

/**
 * Time derivative of the state vector.
 * Drag equation: a_drag = −ρ v² CD(M) / (2 BC_SI)   [m/s²]
 * Reference: McCoy "Modern Exterior Ballistics" (1999), §5.2 (point-mass equations).
 */
function stateDerivative(
  s: State,
  rho: number,
  speedOfSound: number,
  bcSI: number,
  dragModel: 'G1' | 'G7',
): State {
  const vMag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  if (vMag < 1e-6) {
    return { x: 0, y: 0, vx: 0, vy: -GRAVITY_MPS2 };
  }
  const mach = vMag / speedOfSound;
  const cd = dragCoefficientAtMach(dragModel, mach);
  const aDragMag = (rho * vMag * vMag * cd) / (2 * bcSI);

  return {
    x: s.vx,
    y: s.vy,
    vx: -aDragMag * (s.vx / vMag),
    vy: -GRAVITY_MPS2 - aDragMag * (s.vy / vMag),
  };
}

function addStates(a: State, b: State): State {
  return { x: a.x + b.x, y: a.y + b.y, vx: a.vx + b.vx, vy: a.vy + b.vy };
}

function scaleState(s: State, k: number): State {
  return { x: s.x * k, y: s.y * k, vx: s.vx * k, vy: s.vy * k };
}

/**
 * Single RK4 step.
 * Reference: Runge-Kutta 4th-order method; see McCoy (1999), Appendix A.
 */
function rk4Step(
  s: State,
  dt: number,
  rho: number,
  speedOfSound: number,
  bcSI: number,
  dragModel: 'G1' | 'G7',
): State {
  const k1 = scaleState(stateDerivative(s, rho, speedOfSound, bcSI, dragModel), dt);
  const k2 = scaleState(
    stateDerivative(addStates(s, scaleState(k1, 0.5)), rho, speedOfSound, bcSI, dragModel),
    dt,
  );
  const k3 = scaleState(
    stateDerivative(addStates(s, scaleState(k2, 0.5)), rho, speedOfSound, bcSI, dragModel),
    dt,
  );
  const k4 = scaleState(
    stateDerivative(addStates(s, k3), rho, speedOfSound, bcSI, dragModel),
    dt,
  );

  const sixth = 1 / 6;
  return {
    x: s.x + sixth * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: s.y + sixth * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    vx: s.vx + sixth * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
    vy: s.vy + sixth * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
  };
}

type IntegrationPoint = { readonly state: State; readonly t: number };

/**
 * Integrate from muzzle to maxRangeM using 1ms time steps.
 * Returns a dense array of (state, time) pairs that can be interpolated at any range.
 */
function integrate(
  mvMps: number,
  boreAngleRad: number,
  maxRangeM: number,
  rho: number,
  speedOfSound: number,
  bcSI: number,
  dragModel: 'G1' | 'G7',
): IntegrationPoint[] {
  const dt = 0.001; // 1 ms — gives sub-0.01" accuracy for typical rifle trajectories
  const points: IntegrationPoint[] = [];

  let s: State = {
    x: 0,
    y: 0,
    vx: mvMps * Math.cos(boreAngleRad),
    vy: mvMps * Math.sin(boreAngleRad),
  };
  let t = 0;
  points.push({ state: s, t });

  while (s.x < maxRangeM + 5 && t < 5.0) {
    s = rk4Step(s, dt, rho, speedOfSound, bcSI, dragModel);
    t += dt;
    points.push({ state: s, t });
    // Safety: stop if bullet has fallen far below bore (e.g. extreme misuse)
    if (s.y < -200) break;
  }

  return points;
}

/**
 * Linear interpolation to find the state at a specific downrange position.
 * Returns null if the bullet never reached targetX.
 */
function interpolateAtX(
  points: IntegrationPoint[],
  targetX: number,
): IntegrationPoint | null {
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev === undefined || curr === undefined) continue;
    if (curr.state.x >= targetX) {
      const span = curr.state.x - prev.state.x;
      if (span < 1e-12) return curr;
      const frac = (targetX - prev.state.x) / span;
      return {
        state: {
          x: targetX,
          y: prev.state.y + frac * (curr.state.y - prev.state.y),
          vx: prev.state.vx + frac * (curr.state.vx - prev.state.vx),
          vy: prev.state.vy + frac * (curr.state.vy - prev.state.vy),
        },
        t: prev.t + frac * (curr.t - prev.t),
      };
    }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a full 0–1000 yard trajectory in 25-yard steps.
 *
 * Algorithm:
 *   Pass 1 — level-fire (bore angle = 0) to find drop at zero range.
 *   Pass 2 — corrected bore angle so bullet crosses LOS at zeroRangeYards.
 *
 * Path sign: negative means bullet is below the line-of-sight.
 * holdMils: positive means aim higher (scope elevation up).
 *
 * Reference: docs/specs/solver-kernel.md §4 (Algorithm).
 */
export function computeTrajectory(inputs: TrajectoryInputs): TrajectoryOutput {
  const { bullet, muzzleVelocityFps, scopeHeightInches, zeroRangeYards, atmosphere } =
    inputs;

  const air = computeAirProperties(atmosphere);
  const bcSI = bcToSI(bullet.bc as number);
  const mvMps = (muzzleVelocityFps as number) * FPS_TO_MPS;
  const scopeHeightM = (scopeHeightInches as number) * INCHES_TO_METERS;
  const zeroRangeM = (zeroRangeYards as number) * YARDS_TO_METERS;
  const maxRangeM = 1000 * YARDS_TO_METERS;

  // Pass 1: level fire to estimate drop at zero range
  const pass1 = integrate(
    mvMps, 0, zeroRangeM + 5,
    air.densityKgM3, air.speedOfSoundMps, bcSI, bullet.dragModel,
  );
  const zeroPoint1 = interpolateAtX(pass1, zeroRangeM);
  const dropAtZeroM = zeroPoint1 !== null ? zeroPoint1.state.y : 0;

  // Bore angle so bullet arrives at scopeHeight above bore at zero range
  // small-angle approximation is fine (<10 MOA for all practical inputs)
  const boreAngleRad = Math.atan2(scopeHeightM - dropAtZeroM, zeroRangeM);

  // Pass 2: full trajectory with corrected bore angle
  const pass2 = integrate(
    mvMps, boreAngleRad, maxRangeM,
    air.densityKgM3, air.speedOfSoundMps, bcSI, bullet.dragModel,
  );

  const bulletMassKg = (bullet.weightGrains as number) * GRAINS_TO_KG;

  const rows: TrajectoryRow[] = [];
  for (const rangeYd of OUTPUT_RANGES_YARDS) {
    const rangeM = rangeYd * YARDS_TO_METERS;
    const pt = interpolateAtX(pass2, rangeM);
    if (pt === null) break;

    const { state, t } = pt;
    const vMps = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
    const vFps = vMps * MPS_TO_FPS;
    const mach = vMps / air.speedOfSoundMps;

    // Drop is vertical displacement from bore (negative = below bore)
    const dropIn = (state.y / INCHES_TO_METERS) as Inches;

    // Path = bullet height above/below LOS (LOS is horizontal at scopeHeight above bore)
    const pathM = state.y - scopeHeightM;
    const pathIn = (pathM / INCHES_TO_METERS) as Inches;

    // Hold: positive = aim up. Undefined at range 0.
    const holdMils: Milliradians =
      rangeYd > 0
        ? (-(pathIn as number) / (rangeYd * 0.036)) as Milliradians
        : (0 as Milliradians);

    const energyJ = 0.5 * bulletMassKg * vMps * vMps;
    const energyFtLbs = energyJ * JOULES_TO_FT_LBS;

    rows.push({
      rangeYards: rangeYd as Yards,
      dropInches: dropIn,
      pathInches: pathIn,
      velocityFps: vFps as FeetPerSecond,
      mach,
      energyFtLbs,
      timeOfFlightSeconds: t,
      holdMils,
    });
  }

  return { inputs, rows };
}
