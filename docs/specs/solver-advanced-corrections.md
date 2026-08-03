# Spec: Solver advanced corrections (Phase 2)

**Status:** Implemented (Phase 2)  
**Package:** `packages/solver`  
**Depends on:** `docs/specs/solver-kernel.md` (Phase 0 MPM)

---

## 1. Scope

Add optional corrections that hunters expect past ~600–800 yd, without breaking Phase 0 harness fixtures.

| Correction | Approach | Default |
|------------|----------|---------|
| Coriolis (+ Eötvös vertical) | Post-process from lat/az/TOF | Off unless lat+az provided |
| Spin drift | Litz Eq 6.1 + Miller SG | Off unless twist provided |
| Aerodynamic jump | First-order wind×SG estimate | Off unless twist + crosswind |
| Cant | Couple elev drop into windage | Off unless cant ≠ 0 |
| Incline | Elev hold × cos(angle) | Off unless incline ≠ 0 |
| Multi-segment BC | Velocity-stepped BC in integrator | Off unless segments provided |

CDM / full 4DOF–6DOF deferred (V2).

**Invariant:** When optional fields are omitted, `computeTrajectory` output matches Phase 0 within float noise. Harness must stay green.

---

## 2. Inputs (additions to `TrajectoryInputs`)

| Field | Unit | Notes |
|-------|------|-------|
| `latitudeDeg` | deg | −90…90; + = North |
| `azimuthDeg` | deg | 0 = North, clockwise to 360 |
| `twistInches` | in/turn | e.g. 8 = 1:8" |
| `twistDirection` | `'right' \| 'left'` | default `'right'` |
| `bulletLengthInches` | in | optional; else estimate 3.8×diameter (G7 boat-tail heuristic) |
| `cantDeg` | deg | rifle cant; + = clockwise from behind |
| `inclineDeg` | deg | LOS incline; + = uphill |
| `bcSegments` | `{ minVelocityFps, bc }[]` | BC used when speed ≥ minVelocity; base `bullet.bc` below lowest |

Crosswind for AJ is **not** on `TrajectoryInputs` — applied in `computeHoldCorrections()` alongside wind hold.

---

## 3. Outputs

`HoldCorrections` (pure helper; does not mutate MPM path table):

| Field | Unit | Sign |
|-------|------|------|
| `elevHoldDeltaMils` | mil | + = dial/hold up more |
| `windHoldDeltaMils` | mil | + = aim right more |
| `spinDriftMils` | mil | POI drift right (+) for RH |
| `coriolisWindageMils` | mil | POI right (+) |
| `coriolisElevMils` | mil | POI high (+) |
| `aeroJumpElevMils` | mil | POI high (+) |
| `stabilityFactor` | — | Miller SG (null if unknown) |

App: `elevHold += elevHoldDeltaMils`, `windHold += windHoldDeltaMils`.

---

## 4. Formulas (cite before changing)

### 4.1 Miller gyroscopic stability (Don Miller)

```
t = twistInches / diameterInches          // calibers/turn
l = bulletLengthInches / diameterInches   // calibers
SG = 30 * m / (t² * d³ * l * (1 + l²)) * (MV/2800)^(1/3)
```
m = weight grains, d = diameter inches, MV = fps.  
Optional ICAO density correction deferred v1.1.

### 4.2 Spin drift — Litz Eq 6.1

```
SD_inches = 1.25 * (SG + 1.2) * TOF^1.83
```
RH twist → POI right. Hold compensation: `windHoldDelta -= SD_mils`.  
Reference: Litz, *Applied Ballistics for Long Range Shooting*, Eq 6.1 / AccurateShooter confirmation.

### 4.3 Coriolis (flat-fire post-process)

Ω = 7.292115×10⁻⁵ rad/s  
V̄ = range_m / TOF  

```
h_m = Ω * sin(lat) * V̄ * TOF²          // + = right (NH)
v_m = Ω * cos(lat) * sin(az) * V̄ * TOF² // + = high when firing east
```
Hold: `windHoldDelta -= h_mils`, `elevHoldDelta -= v_mils`.

### 4.4 Aerodynamic jump (first-order estimate)

Documented approximation (not full 4DOF):

```
AJ_poi_high_mils ≈ −0.012 * crosswindMph / max(SG, 1.0)   // RH twist
```
App crosswind +: wind from left. RH + left wind → jump down → need more elev → positive elev delta = −AJ_poi_high.

### 4.5 Cant

```
θ = cantDeg * π/180
elev' = elev * cos(θ)
wind' = wind * cos(θ) + elev * sin(θ)
```
Deltas relative to uncanted elev/wind holds.

### 4.6 Incline

```
elevHoldDelta = elevHoldFlat * (cos(inclineDeg) − 1)
```
Equivalent to Rifleman's-rule scaling of drop-dominated hold.

### 4.7 Multi-segment BC

During integration, `bcEffective = segment.bc` for the highest `minVelocityFps` ≤ current speed; else `bullet.bc`.

---

## 5. Test fixtures

| Test | Expectation |
|------|-------------|
| No optional fields | Identical to Phase 0 harness |
| Litz spin example SG=1.8, TOF=1.6 | SD ≈ 8.9" |
| Multi-BC step | Higher-BC segment above threshold → less drop vs single low BC |
| Incline 30° | elev hold ≈ flat × cos(30°) |
| Cant 0 | identity |

---

## 6. Non-goals

- Doppler CDM  
- Full Magnus 4DOF integration inside RK4  
- Auto GPS azimuth without hunter confirmation  
