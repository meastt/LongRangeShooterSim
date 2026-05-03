import type { AtmosphericConditions } from './types.js';

export type AirProperties = {
  /** kg/m³ */
  readonly densityKgM3: number;
  /** m/s */
  readonly speedOfSoundMps: number;
};

/**
 * Saturation vapor pressure of water using the Magnus (Buck 1981) formula.
 * Valid for −40 °C to 60 °C; error < 0.1 % across that range.
 * Reference: Buck, A.L. "New Equations for Computing Vapor Pressure and
 * Enhancement Factor." J. Applied Meteorology, 20(12), 1981.
 */
function saturationVaporPressurePa(tempC: number): number {
  return 611.657 * Math.exp((17.2694 * tempC) / (tempC + 238.3));
}

/**
 * Compute air density and speed of sound from station atmospheric conditions.
 *
 * Uses the mixture of dry-air and water-vapor ideal gases:
 *   ρ = P_d / (R_d × T) + P_v / (R_v × T)
 * where R_d = 287.058 J/(kg·K), R_v = 461.495 J/(kg·K).
 *
 * Speed of sound uses the dry-air approximation (error < 0.2 % at 100 % RH):
 *   c_s = √(γ × R_d × T),  γ = 1.4
 *
 * Reference: ICAO Doc 7488/3; McCoy "Modern Exterior Ballistics" (1999), §3.2.
 */
export function computeAirProperties(atmos: AtmosphericConditions): AirProperties {
  const tempC = ((atmos.temperatureFahrenheit as number) - 32) * (5 / 9);
  const tempK = tempC + 273.15;
  const pressurePa = (atmos.pressureInHg as number) * 3386.389;

  const pvSat = saturationVaporPressurePa(tempC);
  const pv = (atmos.relativeHumidityPct / 100) * pvSat;
  const pd = pressurePa - pv;

  const densityKgM3 = pd / (287.058 * tempK) + pv / (461.495 * tempK);
  const speedOfSoundMps = Math.sqrt(1.4 * 287.058 * tempK);

  return { densityKgM3, speedOfSoundMps };
}
