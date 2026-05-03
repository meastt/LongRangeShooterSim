/**
 * Hunter WEZ (Wounding / Ethical Zone) calculator — pure TypeScript, on-device.
 *
 * Given a trajectory row and species parameters, computes:
 *   1. Hit probability — the fraction of shots landing in the vital zone
 *      given the wind hold uncertainty (σ_wind).
 *   2. Terminal energy adequacy — whether impact velocity exceeds the
 *      species-specific minimum for ethical kills.
 *
 * The output traffic light drives the HunterWEZCard UI:
 *   🟢 CLEAR   — hitPct > 85 AND energy adequate
 *   🟡 MARGINAL — hitPct 65–85 OR energy borderline
 *   🔴 HOLD    — hitPct < 65 OR energy below minimum
 *
 * References:
 *   - Litz, Applied Ballistics Vol II §11 (WEZ analysis)
 *   - APHA/TWA minimum velocity recommendations (1800 fps elk, 1600 fps deer)
 */
import type { TrajectoryRow } from '@aim/solver';

// ─── Species defaults ─────────────────────────────────────────────────────────

export type Species =
  | 'elk'
  | 'mule_deer'
  | 'whitetail'
  | 'antelope'
  | 'black_bear'
  | 'custom';

export type SpeciesParams = {
  readonly name: string;
  /** Vital-zone diameter in inches (double-lung + heart region). */
  readonly vitalZoneInches: number;
  /** Minimum acceptable impact velocity for ethical kills, fps. */
  readonly minImpactVelocityFps: number;
  /** Minimum acceptable impact energy, ft·lb. */
  readonly minImpactEnergyFtLbs: number;
};

export const SPECIES_DEFAULTS: Record<Exclude<Species, 'custom'>, SpeciesParams> = {
  elk: {
    name: 'Elk',
    vitalZoneInches: 10,
    minImpactVelocityFps: 1800,
    minImpactEnergyFtLbs: 1500,
  },
  mule_deer: {
    name: 'Mule Deer',
    vitalZoneInches: 8,
    minImpactVelocityFps: 1600,
    minImpactEnergyFtLbs: 900,
  },
  whitetail: {
    name: 'Whitetail Deer',
    vitalZoneInches: 8,
    minImpactVelocityFps: 1600,
    minImpactEnergyFtLbs: 900,
  },
  antelope: {
    name: 'Pronghorn',
    vitalZoneInches: 6,
    minImpactVelocityFps: 1400,
    minImpactEnergyFtLbs: 600,
  },
  black_bear: {
    name: 'Black Bear',
    vitalZoneInches: 9,
    minImpactVelocityFps: 1800,
    minImpactEnergyFtLbs: 1200,
  },
};

// ─── Output types ─────────────────────────────────────────────────────────────

export type WEZTrafficLight = 'clear' | 'marginal' | 'hold';

export type WEZResult = {
  /** Hit probability 0–100 % */
  hitPct: number;
  /** True if impact velocity ≥ species minimum. */
  velocityAdequate: boolean;
  /** True if impact energy ≥ species minimum. */
  energyAdequate: boolean;
  trafficLight: WEZTrafficLight;
  /** Human-readable reason for the traffic light state. */
  reason: string;
};

// ─── Core computation ─────────────────────────────────────────────────────────

/**
 * Normal distribution CDF (Abramowitz & Stegun approximation, error < 7.5e-8).
 * Used to compute hit probability from a Gaussian lateral dispersion model.
 */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 +
      t * (-0.356563782 +
        t * (1.781477937 +
          t * (-1.821255978 + t * 1.330274429))));
  const result = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x) * poly;
  return x >= 0 ? result : 1 - result;
}

/**
 * Hit probability for a bullet with Gaussian lateral dispersion hitting a circular vital zone.
 *
 * Dispersion model: σ_lateral = windSigmaMil × rangeYards × 0.036 inches
 * (converts angular sigma in MIL to linear sigma at range)
 *
 * P(hit) = P(|lateral| < vitalRadius) = 2 × Φ(vitalRadius / σ_lateral) − 1
 *
 * @param row          Trajectory row at the target range.
 * @param species      Species parameters.
 * @param windSigmaMil Standard deviation of wind hold error in MIL.
 *                     Use `windVarianceMph * holdMilsPerMph` for live weather.
 *                     Default 0.2 MIL represents typical field uncertainty.
 */
export function computeWEZ(
  row: TrajectoryRow,
  species: SpeciesParams,
  windSigmaMil = 0.2,
): WEZResult {
  const rangeYd = row.rangeYards as number;

  // Convert vital zone to radius in inches
  const vitalRadiusIn = species.vitalZoneInches / 2;

  // Convert wind sigma from MIL to inches at this range
  // 1 MIL at range R yards = R × 0.036 inches
  const sigmaIn = windSigmaMil * rangeYd * 0.036;

  // Hit probability assuming perfect vertical zero (wind is the dominant uncertainty)
  const hitPct =
    sigmaIn < 0.001
      ? 100
      : Math.min(100, (2 * normCdf(vitalRadiusIn / sigmaIn) - 1) * 100);

  const velocityAdequate =
    (row.velocityFps as number) >= species.minImpactVelocityFps;

  const energyAdequate = row.energyFtLbs >= species.minImpactEnergyFtLbs;

  // Traffic light logic
  let trafficLight: WEZTrafficLight;
  let reason: string;

  if (!velocityAdequate) {
    trafficLight = 'hold';
    reason = `Impact velocity ${Math.round(row.velocityFps as number)} fps below ${species.minImpactVelocityFps} fps minimum for ${species.name}`;
  } else if (!energyAdequate) {
    trafficLight = 'hold';
    reason = `Impact energy ${Math.round(row.energyFtLbs)} ft·lb below ${species.minImpactEnergyFtLbs} ft·lb minimum for ${species.name}`;
  } else if (hitPct < 65) {
    trafficLight = 'hold';
    reason = `Hit probability ${hitPct.toFixed(0)}% — wind uncertainty too high at this range`;
  } else if (hitPct < 85) {
    trafficLight = 'marginal';
    reason = `Hit probability ${hitPct.toFixed(0)}% — marginal. Reduce wind uncertainty or range.`;
  } else {
    trafficLight = 'clear';
    reason = `${hitPct.toFixed(0)}% hit probability — shot is within ethical parameters`;
  }

  return { hitPct, velocityAdequate, energyAdequate, trafficLight, reason };
}
