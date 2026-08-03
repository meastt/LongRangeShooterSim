# Spec: On-Device Bullet Library (`packages/bullet-library`)

> Status: draft — assigned to build agent. Owner reviews every data source before merge.

## Goal

Replace hand-typed BC/weight/diameter entry with a searchable, on-device library
of manufacturer-published bullet data. This is the #1 onboarding blocker vs.
Applied Ballistics / Hornady 4DOF. Zero-backend: the data ships inside the app
as JSON.

## Hard rules (non-negotiable)

1. **No fabricated numbers.** Every BC, weight, and diameter must come from a
   manufacturer-published source (product page, catalog PDF, or published spec
   sheet). Every entry carries `sourceUrl` + `retrievedAt`. If a value cannot
   be verified, the bullet is omitted — a missing bullet is fine, a wrong BC is
   not.
2. **Do not copy Applied Ballistics' measured-BC library** (Litz's doppler
   data is AB's licensed product). Manufacturer-published specs are facts and
   fair to compile; AB's measurement dataset is not ours to ship.
3. **Never convert G1↔G7.** If the manufacturer publishes only G1, `g7Bc` is
   `null`. Form-factor conversion without doppler data is guessing.
4. Pure TypeScript package, zero React Native imports, mirrors
   `packages/solver` conventions (strict mode, no `any`, branded-unit
   compatibility with `@aim/shared` types where applicable).
5. No new runtime dependencies. Validation is hand-rolled; tests use vitest.

## Scope

- **Projectiles (component bullets), rifle calibers .172–.375**, currently in
  production. Priority manufacturers, in order:
  Hornady, Berger, Sierra, Nosler, Barnes, Lapua, Federal (component +
  Terminal Ascent line), Swift, Cutting Edge (stretch), Winchester (stretch).
- Target: **≥500 verified entries** covering every currently-produced
  match/hunting bullet from the first seven manufacturers. Quality > count.
- Rimfire: add the common .22 LR match loads (CCI SV, SK, Lapua Center-X,
  Eley) as a small `rimfire.json` — these are loaded-ammo entries with nominal
  MV since rimfire is bought, not handloaded.
- **Out of scope (phase 2):** factory centerfire ammo presets, custom drag
  models, powder data.

## Data model

```ts
type LibraryBullet = {
  /** Stable slug id: "<maker>-<line>-<diameter>-<grains>", e.g. "hornady-eld-m-0.264-140" */
  readonly id: string;
  readonly manufacturer: string;        // "Hornady"
  readonly line: string;                // "ELD Match"
  readonly name: string;                // display: "ELD Match 140gr"
  readonly weightGrains: number;
  /** Actual projectile diameter in inches (0.264 for 6.5mm — never the cartridge name). */
  readonly diameterInches: number;
  readonly g1Bc: number | null;
  readonly g7Bc: number | null;
  /** Which model to default to in the app: 'G7' when g7Bc exists, else 'G1'. */
  readonly preferredModel: 'G1' | 'G7';
  readonly sourceUrl: string;
  /** ISO date the source was checked. */
  readonly retrievedAt: string;
  /** Optional: catalog/SKU number for disambiguation. */
  readonly sku?: string;
};
```

Data lives in `packages/bullet-library/data/<manufacturer>.json`, one file per
manufacturer, imported statically (Metro bundles JSON). Public API in `src/`:

```ts
export function allBullets(): readonly LibraryBullet[];
export function searchBullets(opts: {
  query?: string;              // matches manufacturer/line/name, case-insensitive
  diameterInches?: number;     // exact match with ±0.0005 tolerance
  minGrains?: number;
  maxGrains?: number;
}): readonly LibraryBullet[];
export function bulletById(id: string): LibraryBullet | null;
```

## Validation (vitest, runs in CI over the full dataset)

- Schema: every field present and typed; ids unique and match the slug format.
- Diameter is one of the known groove diameters (maintain the list in the
  test: .172, .204, .224, .243, .257, .264, .277, .284, .308, .311, .325,
  .338, .358, .366, .375 …) — catches caliber-name/diameter mixups.
- Plausibility: `0.10 ≤ g1Bc ≤ 1.10`; `0.05 ≤ g7Bc ≤ 0.50`; where both exist,
  `g7Bc < g1Bc` and `0.45 ≤ g7Bc/g1Bc ≤ 0.60` (typical form-factor band —
  flag outliers for manual review rather than hard-fail, but fail below 0.40
  or above 0.70).
- Sectional density sanity: `SD = grains / (7000 × d²)` within 0.08–0.45.
- `sourceUrl` is a well-formed https URL on the manufacturer's own domain.
- No duplicate (manufacturer, line, diameter, weight) tuples.

## Verification protocol (the agent must actually do this)

1. Compile each manufacturer from their official product/catalog pages.
2. Cross-check a random ≥10% sample per manufacturer against a second source
   (catalog PDF vs. web page, or retailer spec sheet). Log discrepancies in
   `data/DISCREPANCIES.md` with both values and which was chosen and why.
3. Ship a `data/PROVENANCE.md`: per manufacturer, the source pages used and
   retrieval dates.

## App integration (second step, after the package passes CI)

- `app/app/profile/new-rifle.tsx` and `profile/edit.tsx`: add a "Choose from
  library" search sheet (filter by diameter/query) that fills bulletName,
  weightGrains, diameterInches, bc, dragModel from the selected entry.
  Manual entry stays available — the library is a shortcut, not a gate.
- Touch targets ≥56 dp; list renders with `FlatList`; no new deps.
- Keep the selected `LibraryBullet.id` in `loads.notes` or a new nullable
  `libraryBulletId` column (migration) so future library updates can flag
  stale BCs.

## Acceptance

- `npm run test -w @aim/bullet-library` green, full-dataset validators pass.
- ≥500 entries, all seven priority manufacturers represented.
- Spot-check by owner: 20 random entries hand-verified against manufacturer
  pages before merge (owner task — flag the build as unreviewed until done).
