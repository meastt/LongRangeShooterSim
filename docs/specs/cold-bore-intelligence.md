# Spec: Cold-bore intelligence

> Status: **IMPLEMENTED (v1)** — mean offset from log; optional apply to dial when confidence ≥ medium.
> Differentiator #4 in `Initial_Build_Plan.md`. Liability-sensitive.

## Purpose

Predict and optionally apply a first-shot (cold bore) point-of-impact offset relative to the hunter’s trued hot-barrel solution, using the on-device cold-bore event log.

## Inputs (units + ranges)

| Input | Unit | Range / notes |
|-------|------|----------------|
| `rifleId` / `loadId` | UUID | Active profile |
| Cold-bore events | list | `date`, observed vertical POI error (inches or mils at known range), optional horizontal |
| Event range | yards | 50–300 typical; record actual |
| Event conditions | atmo snapshot | Optional; for later regression |
| “Cold” definition | enum | Clean cold / overnight cold / fouled cold — v1: overnight cold only |
| Apply mode | enum | `display_only` \| `apply_to_first_shot` — default `display_only` |

## Outputs

| Output | Unit | Notes |
|--------|------|-------|
| Predicted vertical offset | mils | At current field range (scale from logged range) |
| Predicted horizontal offset | mils | Optional; often near zero |
| Confidence | low/med/high | Based on event count + scatter |
| Applied? | boolean | Whether HUD dial includes the offset today |
| Disclaimer string | text | Always: estimated offset; hunter confirms |

## Edge cases

- Fewer than 3 events → confidence `low`; never auto-apply.
- Events older than 180 days → down-weight or exclude.
- Load change (MV/BC) → invalidate prior regression for that load.
- Suppressor attach/detach → treat as different condition bucket (cross-link suppressor spec).
- Extreme outliers (>3σ) → exclude with log note.

## Math (v1 proposal — verify before code)

1. Convert each event’s observed POI error at `R_event` to mils: `ε_mil = inches / (R_event * 0.036)`.
2. Mean vertical cold offset `μ_v` over last N qualifying events (N≥3).
3. At field range `R`, display offset `μ_v` (angular; do not rescale linearly without justification — v1 treats cold shift as approximately angular for short true-range logs 100–200 yd).
4. If `apply_to_first_shot` and confidence ≥ medium and hunter armed “cold today”: add `μ_v` to elevation hold for first logged shot of the day only.

**Do not invent advanced regression without fixtures.** Prefer mean + sample σ over fancy models in v1.

## Test fixtures

- 5 synthetic events at 100 yd, mean +0.3 mil vertical → predict ≈ +0.3 mil.
- 2 events → low confidence, no auto-apply.
- Load BC change → prior events ignored.

## UI sketch

```
[COLD BORE]  Est. +0.3 mil elev  · med confidence
  Log first shot today?  [LOG]   Apply offset: [OFF]
  “Estimated from your log. You are responsible.”
```

## References

- Litz, *Applied Ballistics for Long Range Shooting* — cold bore / clean bore discussion (cite edition/page on implement).
- Existing table: `cold_bore_events` in `app/src/db/schema.ts`.

## Non-goals (v1)

- ML prediction, cloud sync, automatic “take the shot” language.
- Treating suppressor-on and suppressor-off as the same series.
