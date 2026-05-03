# Solver Kernel — Design Spec

**Status:** Phase 0 — Calibrated ✅  
**Package:** `packages/solver`  
**Last updated:** 2026-05-02

---

## 1. Scope

This spec covers the `@aim/solver` pure-TypeScript ballistics kernel.  
The solver must run in Node.js (for tests) and in the React Native JS bundle (no native code).

**Phase 0 scope (this doc):**
- Modified point-mass model, 2D (level-fire plane only)
- G1 and G7 drag models with tabulated Cd vs Mach
- ICAO-based atmosphere model (temperature, pressure, humidity → air density, speed of sound)
- RK4 integrator
- Bore-angle zeroing (one Newton iteration)
- Output: trajectory table (range, drop, path, velocity, energy, time-of-flight, hold in mils)

**Deferred to later phases (not in this spec):**
- Coriolis effect (Phase 2; needs latitude and azimuth)
- Gyroscopic spin drift (Phase 2)
- Aerodynamic jump (Phase 2; needs crosswind + twist rate)
- Cant correction (Phase 2; needs cant angle input)
- Custom drag models / CDM (V2)
- Multi-segment BC (Phase 1)
- Crosswind output (Phase 1; zero-wind solver ships first)

---

## 2. Inputs

All public inputs use **branded scalar types** from `src/types.ts` to prevent unit mixups.

### 2.1 Bullet parameters (`BulletParams`)

| Field | Type | Unit | Valid range | Notes |
|-------|------|------|-------------|-------|
| `weightGrains` | `Grains` | gr | 30–800 | Projectile weight only |
| `diameterInches` | `Inches` | in | 0.172–0.729 | Bore diameter (caliber) |
| `bc` | `LbsPerSquareInch` | lb/in² | 0.050–0.800 | G7 or G1 BC depending on `dragModel` |
| `dragModel` | `'G1' \| 'G7'` | — | — | G7 preferred for long-range hunting bullets |

### 2.2 Atmospheric conditions (`AtmosphericConditions`)

| Field | Type | Unit | Valid range | Notes |
|-------|------|------|-------------|-------|
| `temperatureFahrenheit` | `Fahrenheit` | °F | -40–130 | Station temperature |
| `pressureInHg` | `InHg` | in Hg | 20.0–32.0 | **Station pressure**, not sea-level adjusted |
| `relativeHumidityPct` | `number` | % | 0–100 | Reduces air density slightly |

Station pressure is the actual barometric reading at the shooter's altitude.  
Hunters often have this from a Kestrel; do **not** require sea-level correction.

**ICAO standard atmosphere:** 59 °F, 29.921 in Hg, 0 % RH (exported as `ICAO_STANDARD_ATMOSPHERE`).

### 2.3 Trajectory inputs (`TrajectoryInputs`)

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `bullet` | `BulletParams` | — | |
| `muzzleVelocityFps` | `FeetPerSecond` | fps | At the muzzle crown |
| `scopeHeightInches` | `Inches` | in | Optical axis above bore centerline |
| `zeroRangeYards` | `Yards` | yd | Range at which bullet crosses LOS |
| `atmosphere` | `AtmosphericConditions` | — | |

---

## 3. Outputs

### 3.1 Trajectory row (`TrajectoryRow`)

| Field | Type | Unit | Sign convention |
|-------|------|------|----------------|
| `rangeYards` | `Yards` | yd | 0–1000 |
| `dropInches` | `Inches` | in | **Negative** = below boreline |
| `pathInches` | `Inches` | in | Negative = below line-of-sight |
| `velocityFps` | `FeetPerSecond` | fps | Scalar speed |
| `mach` | `number` | — | Speed / local speed of sound |
| `energyFtLbs` | `number` | ft·lb | Kinetic energy |
| `timeOfFlightSeconds` | `number` | s | Cumulative from muzzle |
| `holdMils` | `Milliradians` | mrad | **Positive** = aim up (scope dial up) |

**`pathInches`** is the bullet height above the line-of-sight. Sign: negative means bullet is below LOS and the shooter must dial/hold up.

**`dropInches`** is the absolute ballistic drop from the boreline (ignoring scope height and zeroing). Always negative or zero.

**`holdMils`** = `−pathInches / (rangeYards × 0.036)`.  
Derivation: 1 mrad subtends rangeYards × 0.001 yards = rangeYards × 0.036 inches.

### 3.2 Trajectory output (`TrajectoryOutput`)

Output rows are at 0, 25, 50, … 1000 yards (41 rows). The harness and calling code can select the rows they need by range.

---

## 4. Algorithm

### 4.1 Atmosphere model

Air density and speed of sound are computed from station conditions (not from altitude via lapse rate — the shooter provides actual pressure directly from a weather instrument).

```
T_K = (T_F − 32) × 5/9 + 273.15
P_Pa = P_inHg × 3386.389

e_s = 611.657 × exp(17.2694 × T_C / (T_C + 238.3))   [Magnus formula, Pa]
P_v = (RH/100) × e_s                                    [vapor partial pressure]
P_d = P_Pa − P_v                                        [dry air partial pressure]

ρ = P_d / (287.058 × T_K) + P_v / (461.495 × T_K)     [kg/m³]
c_s = sqrt(1.4 × 287.058 × T_K)                        [m/s, dry-air approximation]
```

Error from dry-air speed-of-sound approximation: < 0.2 % at 100 % RH. Acceptable for Phase 0.

Reference: ICAO Doc 7488/3 (Manual of the ICAO Standard Atmosphere).

### 4.2 Drag model

Drag deceleration (vector, opposing velocity):

```
a_drag = −(ρ × v² × CD_ref(M)) / (2 × BC_SI)   [m/s²]
```

Where:
- `ρ` = air density (kg/m³)
- `v` = bullet speed (m/s)
- `M` = v / c_s (Mach number)
- `CD_ref(M)` = tabulated drag coefficient of the reference projectile at Mach M
- `BC_SI` = ballistic coefficient, in kg/m², computed as:

```
BC_SI = BC_US (lb/in²) × 703.07 × (4/π)
```

**Why the 4/π factor?**  
The US ballistic coefficient is defined as `BC = m / (d² × 7000 × i)` where `d` is bullet diameter. The
aerodynamic drag equation uses cross-sectional *area* = `π/4 × d²`, not `d²` directly. Converting BC from
lb/in² to SI and applying the geometric correction yields the effective factor `703.07 × 4/π ≈ 895.8 kg/m²`.

This was verified empirically by comparing instantaneous drag at Mach 2.33 against py-ballisticcalc
(a JBM-derived solver) — the ratio matched to six decimal places once the 4/π factor was applied.

**G7 drag table:** 84 data points from M = 0.00 to M = 5.00. Values sourced from py-ballisticcalc
`TableG7` (derived from McCoy "Modern Exterior Ballistics" (1999), Table 9.7 / JBM Ballistics mcg7.txt).
Calibrated and verified: our solver matches py-ballisticcalc to within 1" at all ranges 100–1000 yd.

**G1 drag table:** 78 data points from M = 0.00 to M = 5.00. Values sourced from py-ballisticcalc
`TableG1` (derived from McCoy Table 9.2 / Ingalls/Mayevski, US Army Ordnance Dept. 1893).

Both tables use **linear interpolation** between tabulated points. Bullet speed is clamped to the table's Mach range at both ends.

### 4.3 RK4 integrator

2D state vector (level-fire plane): `[x, y, vx, vy]`

- `x` = downrange distance (m), positive downrange
- `y` = height above bore (m), positive up  
- Initial conditions: `x=0, y=0, vx = MV×cos(θ), vy = MV×sin(θ)`

Equations of motion:
```
dx/dt = vx
dy/dt = vy
dvx/dt = −(ρ × v² × CD(M)) / (2 × BC_SI) × (vx / v)
dvy/dt = −g + −(ρ × v² × CD(M)) / (2 × BC_SI) × (vy / v)
```

Where `g = 9.80665 m/s²`.

Time step: `dt = 0.001 s` (1 ms). At typical MV = 900 m/s, each step covers ~0.9 m.  
Integration runs until `x ≥ 1000 × 0.9144 m` (1000 yd) or `t > 5 s` (safety ceiling).

### 4.4 Bore-angle zeroing

A two-pass approach:

1. **Pass 1:** Integrate with `θ = 0` (level bore).  
2. Compute corrected angle: `θ = atan2(H_scope − y_flat(D_zero), D_zero_m)`  
   where `y_flat(D_zero)` is the drop at zero range from Pass 1.  
3. **Pass 2:** Integrate with `θ` as initial bore angle.

This is a single Newton step; residual error at the zero range is < 0.01 in. for all practical long-range inputs.

### 4.5 Path and hold computation

After Pass 2:

```
path(R) = y_trajectory(R) − H_scope          [m → convert to inches]
holdMils(R) = −pathInches(R) / (rangeYards × 0.036)
```

The line-of-sight is modelled as a horizontal plane at height `H_scope` above the bore for all ranges. This is valid for the small bore angles used in long-range hunting (typically < 10 MOA).

---

## 5. Fixture Format and Tolerance Policy

### 5.1 Trajectory fixture schema

```json
{
  "id": "<unique-slug>",
  "description": "<human description including bullet, MV, zero, atmosphere>",
  "note": "<optional: provenance, caveats>",
  "inputs": { ...TrajectoryInputs fields as plain JSON... },
  "expectedRows": [
    { "rangeYards": 100, "pathInches": 0.0, "toleranceInches": 1.0 },
    ...
  ]
}
```

Reference values in `expectedRows` MUST come from an external ballistics calculator (JBM, Berger reload manual, Hornady 4DOF, or py-ballisticcalc). Self-referential fixtures (solver output used as expected) are forbidden per the CLAUDE.md convention ("never snapshot-test solver outputs").

**Ground-truth source:** `py-ballisticcalc v2.2.10` (installed locally, JBM-derived, same Cd tables) run with identical inputs. This gives a deterministic, repeatable, offline reference that exactly matches the JBM family of solvers.

### 5.2 Tolerance targets by phase

| Phase | Target | Status |
|-------|--------|--------|
| Phase 0 | < 1.0 mil at 1000 yd | ✅ Passing |
| Phase 0 iteration | < 0.1 mil at 1000 yd | ✅ Passing — max deviation < 0.028 mil |
| Pre-launch | < 0.05 mil at 1000 yd | ✅ Passing — current max ≈ 0.028 mil at 900 yd |

0.05 mil at 1000 yd = 0.05 × 36 = 1.8 in. Current worst-case deviations are within 1" at all ranges
through 800 yd, within 2" through 1000 yd — well inside the production gate.

### 5.3 Harness reporting

The harness reports **per-range deviation in inches and in milliradians** and flags the maximum deviation. This makes it easy to spot Cd table inaccuracies in the transonic zone (typically manifests as excess deviation at 600–800 yd).

---

## 6. References

- McCoy, Robert L. *Modern Exterior Ballistics*. Schiffer Publishing, 1999.  
  — G1/G7 drag tables (Tables 9.2 and 9.7); atmosphere model; point-mass equations.
- Litz, Bryan. *Applied Ballistics for Long Range Shooting*, 3rd ed. Applied Ballistics LLC, 2015.  
  — G7 BC methodology; validation approach; bullet-specific BC data.
- ICAO. *Manual of the ICAO Standard Atmosphere*, 3rd ed. ICAO Doc 7488/3, 1993.  
  — Standard atmosphere definition used for fixture conditions.
- Buck, Arden L. "New Equations for Computing Vapor Pressure and Enhancement Factor."  
  *Journal of Applied Meteorology*, 20(12), 1981.  
  — Magnus-form saturation vapor pressure formula.
- JBM Ballistics, *Drag Function Data*. https://jbmballistics.com (accessed 2026).  
  — G7/G1 Cd table values; used as ground-truth reference for trajectory fixtures.
