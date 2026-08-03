# Spec: Suppressor profile variants

> Status: **IMPLEMENTED (v1)** — per-load MV delta + zero shifts; rifle-level toggle; solve path wired.
> Differentiator #5 in `Initial_Build_Plan.md`.

## Purpose

Model suppressor-attached vs bare-muzzle as distinct ballistic conditions: muzzle velocity shift and optional zero/POI shift, selectable without duplicating the entire rifle profile by hand.

## Inputs (units + ranges)

| Input | Unit | Range / notes |
|-------|------|----------------|
| `suppressorEnabled` | boolean | Existing rifle flag |
| Bare MV | fps | From active load |
| Suppressed MV delta | fps | Typical −20…−80 fps; hunter-measured preferred |
| Suppressed MV absolute | fps | Alternative to delta |
| Zero shift elev | mils or clicks | Optional; many hunters re-zero |
| Zero shift wind | mils | Optional |
| Chrono / truing source | text | Provenance |

## Outputs

| Output | Unit | Notes |
|--------|------|-------|
| Effective MV for solver | fps | Bare MV or suppressed MV |
| Effective zero offsets | mils | Applied to holds if configured |
| HUD badge | text | `SUP` when enabled |
| Warning | text | If delta never measured |

## Edge cases

- Toggle on with no measured delta → use last known delta for that load, else prompt; never invent a brand-default silently in solution math (UI may suggest a typical range as placeholder only).
- Changing load → suppressed delta does not carry blindly; per-load storage.
- Cold-bore series keyed by suppressor state (see cold-bore spec).

## Data model (proposed)

Extend `loads` (or a child table `load_variants`):

```
suppressorMvDeltaFps: real | null   -- suppressed − bare (usually negative)
suppressorZeroShiftMilsElev: real | null
suppressorZeroShiftMilsWind: real | null
```

Rifle-level `suppressorEnabled` remains the field toggle.

## Solver mapping

```
effectiveMv = suppressorEnabled && delta != null
  ? bareMv + delta
  : bareMv

elevHold += suppressorEnabled ? (zeroShiftElev ?? 0) : 0
```

## Test fixtures

- Bare 2950 fps, delta −40 → suppressed solve uses 2910 fps; path deeper at 800 yd vs bare.
- Toggle off restores bare trajectory exactly.
- Null delta + enabled → solver uses bare MV; UI shows “measure MV with can” warning.

## UI sketch

```
Rifle detail:
  [ ] Suppressor attached
  Suppressed MV delta: [ -45 ] fps   (from chrono)
  Zero shift: elev [ 0.1 ] mil  wind [ 0 ] mil
Field HUD: badge SUP when on; profile switch ≤2 taps.
```

## References

- Manufacturer / chrono practice: cans often change MV and POI; treat as measured, not assumed.
- Existing: `suppressorEnabled` on `rifles` — currently UI-only.

## Non-goals (v1)

- Separate full duplicate loads per can (allowed later).
- Automatic delta from brand library without measurement.
