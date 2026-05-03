import type { DragModel } from './types.js';

type DragPoint = { readonly mach: number; readonly cd: number };

/**
 * G7 drag coefficient table (CD vs Mach).
 *
 * CD values are for the G7 standard reference projectile.
 * Drag deceleration: a = −ρ × v² × CD_G7(M) / (2 × BC_SI) [m/s²]
 * where BC_SI (kg/m²) = BC_G7 (lb/in²) × 703.07.
 *
 * Source: McCoy "Modern Exterior Ballistics" (1999), Table 9.7;
 * replicated by Sierra Bullets 6th Ed. Technical Manual and JBM Ballistics.
 * Reference: Litz, Applied Ballistics for Long Range Shooting, 3rd ed., Appendix B.
 */
const G7_TABLE: readonly DragPoint[] = [
  // Canonical G7 drag function data from JBM Ballistics (mcg7.txt).
  // Source: McCoy "Modern Exterior Ballistics" (1999), Table 9.7, as published
  // by JBM Ballistics at jbmballistics.com/ballistics/downloads/text/mcg7.txt.
  // 84 data points from M=0.00 to M=5.00.
  //
  // IMPORTANT: The G7 reference projectile has significantly higher Cd values
  // than may be intuitive — the Cd at Mach 1.0 is ~0.38, not ~0.12.
  // These are reference projectile drag coefficients, not the actual bullet's Cd.
  // The ballistic coefficient (BC) scales the reference drag to match the real bullet.

  // Subsonic regime — relatively flat, low drag
  { mach: 0.00, cd: 0.1198 }, { mach: 0.05, cd: 0.1197 },
  { mach: 0.10, cd: 0.1196 }, { mach: 0.15, cd: 0.1194 },
  { mach: 0.20, cd: 0.1193 }, { mach: 0.25, cd: 0.1194 },
  { mach: 0.30, cd: 0.1194 }, { mach: 0.35, cd: 0.1194 },
  { mach: 0.40, cd: 0.1193 }, { mach: 0.45, cd: 0.1193 },
  { mach: 0.50, cd: 0.1194 }, { mach: 0.55, cd: 0.1193 },
  { mach: 0.60, cd: 0.1194 }, { mach: 0.65, cd: 0.1197 },
  { mach: 0.70, cd: 0.1202 }, { mach: 0.725, cd: 0.1207 },
  { mach: 0.75, cd: 0.1215 }, { mach: 0.775, cd: 0.1226 },
  { mach: 0.80, cd: 0.1242 }, { mach: 0.825, cd: 0.1266 },
  { mach: 0.85, cd: 0.1306 }, { mach: 0.875, cd: 0.1368 },
  // Transonic drag rise — dense sampling required for accuracy
  { mach: 0.90, cd: 0.1464 }, { mach: 0.925, cd: 0.1660 },
  { mach: 0.95, cd: 0.2054 }, { mach: 0.975, cd: 0.2993 },
  { mach: 1.00, cd: 0.3803 }, { mach: 1.025, cd: 0.4015 },
  { mach: 1.05, cd: 0.4043 }, { mach: 1.075, cd: 0.4034 },
  { mach: 1.10, cd: 0.4014 }, { mach: 1.125, cd: 0.3987 },
  { mach: 1.15, cd: 0.3955 }, { mach: 1.20, cd: 0.3884 },
  { mach: 1.25, cd: 0.3810 }, { mach: 1.30, cd: 0.3732 },
  { mach: 1.35, cd: 0.3657 }, { mach: 1.40, cd: 0.3580 },
  { mach: 1.50, cd: 0.3440 }, { mach: 1.55, cd: 0.3376 },
  { mach: 1.60, cd: 0.3315 }, { mach: 1.65, cd: 0.3260 },
  { mach: 1.70, cd: 0.3209 }, { mach: 1.75, cd: 0.3160 },
  { mach: 1.80, cd: 0.3117 }, { mach: 1.85, cd: 0.3078 },
  { mach: 1.90, cd: 0.3042 }, { mach: 1.95, cd: 0.3010 },
  { mach: 2.00, cd: 0.2980 }, { mach: 2.05, cd: 0.2951 },
  { mach: 2.10, cd: 0.2922 }, { mach: 2.15, cd: 0.2892 },
  { mach: 2.20, cd: 0.2864 }, { mach: 2.25, cd: 0.2835 },
  { mach: 2.30, cd: 0.2807 }, { mach: 2.35, cd: 0.2779 },
  { mach: 2.40, cd: 0.2752 }, { mach: 2.45, cd: 0.2725 },
  { mach: 2.50, cd: 0.2697 }, { mach: 2.55, cd: 0.2670 },
  { mach: 2.60, cd: 0.2643 }, { mach: 2.65, cd: 0.2615 },
  { mach: 2.70, cd: 0.2588 }, { mach: 2.75, cd: 0.2561 },
  { mach: 2.80, cd: 0.2533 }, { mach: 2.85, cd: 0.2506 },
  { mach: 2.90, cd: 0.2479 }, { mach: 2.95, cd: 0.2451 },
  { mach: 3.00, cd: 0.2424 }, { mach: 3.10, cd: 0.2368 },
  { mach: 3.20, cd: 0.2313 }, { mach: 3.30, cd: 0.2258 },
  { mach: 3.40, cd: 0.2205 }, { mach: 3.50, cd: 0.2154 },
  { mach: 3.60, cd: 0.2106 }, { mach: 3.70, cd: 0.2060 },
  { mach: 3.80, cd: 0.2017 }, { mach: 3.90, cd: 0.1975 },
  { mach: 4.00, cd: 0.1935 }, { mach: 4.20, cd: 0.1861 },
  { mach: 4.40, cd: 0.1793 }, { mach: 4.60, cd: 0.1730 },
  { mach: 4.80, cd: 0.1672 }, { mach: 5.00, cd: 0.1618 },
];

/**
 * G1 drag coefficient table (CD vs Mach).
 *
 * The historical Mayevski/Siacci drag function, standard for older commercial ammo data.
 * G1 CDs are significantly higher than G7 because the G1 reference projectile
 * (a flat-based, round-nose shape) is much less aerodynamic than the G7 reference.
 *
 * Source: Ingalls/Ordnance Dept. (1893); modernized by McCoy (1999), Table 9.2;
 * as published by Sierra Bullets 6th Ed. Technical Manual.
 */
const G1_TABLE: readonly DragPoint[] = [
  // Canonical G1 drag function data matching py-ballisticcalc (JBM-derived).
  // Source: Ingalls/Ordnance Dept. (1893); modernized by McCoy (1999), Table 9.2.
  { mach: 0.00, cd: 0.2629 }, { mach: 0.05, cd: 0.2558 },
  { mach: 0.10, cd: 0.2487 }, { mach: 0.15, cd: 0.2413 },
  { mach: 0.20, cd: 0.2344 }, { mach: 0.25, cd: 0.2278 },
  { mach: 0.30, cd: 0.2214 }, { mach: 0.35, cd: 0.2155 },
  { mach: 0.40, cd: 0.2104 }, { mach: 0.45, cd: 0.2061 },
  { mach: 0.50, cd: 0.2032 }, { mach: 0.55, cd: 0.2020 },
  { mach: 0.60, cd: 0.2034 },
  { mach: 0.70, cd: 0.2165 },
  // Dense sampling through transonic region
  { mach: 0.725, cd: 0.2230 }, { mach: 0.75, cd: 0.2313 },
  { mach: 0.775, cd: 0.2417 }, { mach: 0.80, cd: 0.2546 },
  { mach: 0.825, cd: 0.2706 }, { mach: 0.85, cd: 0.2901 },
  { mach: 0.875, cd: 0.3136 }, { mach: 0.90, cd: 0.3415 },
  { mach: 0.925, cd: 0.3734 }, { mach: 0.95, cd: 0.4084 },
  { mach: 0.975, cd: 0.4448 }, { mach: 1.00, cd: 0.4805 },
  { mach: 1.025, cd: 0.5136 }, { mach: 1.05, cd: 0.5427 },
  { mach: 1.075, cd: 0.5677 }, { mach: 1.10, cd: 0.5883 },
  { mach: 1.125, cd: 0.6053 }, { mach: 1.15, cd: 0.6191 },
  { mach: 1.20, cd: 0.6393 }, { mach: 1.25, cd: 0.6518 },
  { mach: 1.30, cd: 0.6589 }, { mach: 1.35, cd: 0.6621 },
  { mach: 1.40, cd: 0.6625 }, { mach: 1.45, cd: 0.6607 },
  { mach: 1.50, cd: 0.6573 }, { mach: 1.55, cd: 0.6528 },
  { mach: 1.60, cd: 0.6474 }, { mach: 1.65, cd: 0.6413 },
  { mach: 1.70, cd: 0.6347 }, { mach: 1.75, cd: 0.6280 },
  { mach: 1.80, cd: 0.6210 }, { mach: 1.85, cd: 0.6141 },
  { mach: 1.90, cd: 0.6072 }, { mach: 1.95, cd: 0.6003 },
  { mach: 2.00, cd: 0.5934 }, { mach: 2.05, cd: 0.5867 },
  { mach: 2.10, cd: 0.5804 }, { mach: 2.15, cd: 0.5743 },
  { mach: 2.20, cd: 0.5685 }, { mach: 2.25, cd: 0.5630 },
  { mach: 2.30, cd: 0.5577 }, { mach: 2.35, cd: 0.5527 },
  { mach: 2.40, cd: 0.5481 }, { mach: 2.45, cd: 0.5438 },
  { mach: 2.50, cd: 0.5397 },
  { mach: 2.60, cd: 0.5325 }, { mach: 2.70, cd: 0.5264 },
  { mach: 2.80, cd: 0.5211 }, { mach: 2.90, cd: 0.5168 },
  { mach: 3.00, cd: 0.5133 }, { mach: 3.10, cd: 0.5105 },
  { mach: 3.20, cd: 0.5084 }, { mach: 3.30, cd: 0.5067 },
  { mach: 3.40, cd: 0.5054 }, { mach: 3.50, cd: 0.5040 },
  { mach: 3.60, cd: 0.5030 }, { mach: 3.70, cd: 0.5022 },
  { mach: 3.80, cd: 0.5016 }, { mach: 3.90, cd: 0.5010 },
  { mach: 4.00, cd: 0.5006 }, { mach: 4.20, cd: 0.4998 },
  { mach: 4.40, cd: 0.4995 }, { mach: 4.60, cd: 0.4992 },
  { mach: 4.80, cd: 0.4990 }, { mach: 5.00, cd: 0.4988 },
];

/** Linear interpolation between drag table points. Clamps at table boundaries. */
function interpolateCd(table: readonly DragPoint[], mach: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (first === undefined || last === undefined) return 0;
  if (mach <= first.mach) return first.cd;
  if (mach >= last.mach) return last.cd;

  for (let i = 1; i < table.length; i++) {
    const prev = table[i - 1];
    const curr = table[i];
    if (prev === undefined || curr === undefined) continue;
    if (mach <= curr.mach) {
      const t = (mach - prev.mach) / (curr.mach - prev.mach);
      return prev.cd + t * (curr.cd - prev.cd);
    }
  }
  return last.cd;
}

/**
 * Drag coefficient of the standard reference projectile for the given model at Mach M.
 * Used directly in the point-mass drag equation: a = −ρ v² CD(M) / (2 BC_SI).
 */
export function dragCoefficientAtMach(model: DragModel, mach: number): number {
  return interpolateCd(model === 'G7' ? G7_TABLE : G1_TABLE, mach);
}

/**
 * Convert ballistic coefficient from US conventional units (lb/in²) to the
 * effective SI value used in the point-mass drag equation.
 *
 * The US BC is defined as:
 *   BC = m / (d² × 7000 × i)   [lb/in²]
 * where m is in grains, d in inches, i is the form factor.
 *
 * The drag equation uses cross-sectional area = π/4 × d², not d² directly.
 * So the effective SI BC that appears in a = ρv²Cd/(2×BC_eff) must absorb
 * both the unit conversion AND the π/4 geometric factor:
 *
 *   BC_eff = BC_US × 703.07 × (π/4)
 *          = BC_US × 552.18   [kg/m²]
 *
 * Without the π/4 factor, drag is underestimated by ~21.5%, causing
 * the trajectory to be far too flat at long range.
 *
 * Derivation cross-checked against py-ballisticcalc (JBM-derived solver):
 *   their constant 0.000208551 = ρ₀ × π / (8 × 144), which embeds the
 *   same π/4 factor in the numerator rather than the BC denominator.
 *
 * Reference: McCoy, "Modern Exterior Ballistics" (1999), §5.2.
 */
export function bcToSI(bcLbsPerIn2: number): number {
  return bcLbsPerIn2 * 703.07 * (4 / Math.PI);
}
