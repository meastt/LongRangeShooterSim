# CLAUDE.md

> Project conventions and context for Claude Code, Cursor, and other AI coding agents working on the **Aim** codebase.
> Read this in full before making changes. Reference `Initial_Build_Plan.md` for product context.

---

## Project Overview

**Aim** is a cross-platform (iOS + Android) ballistics calculator and hunt-planning app for precision long-range hunters (not PRS competitive shooters). V1 is **zero-backend, on-device-only**. Five differentiators ship in V1: Hunter WEZ, ShotPlan, wind-risk envelope, cold-bore intelligence, suppressor profile variants.

See `Initial_Build_Plan.md` for full product spec, phased roadmap, and operational cost model.

---

## Tech Stack (Authoritative)

- **Framework:** Expo SDK 52+ with React Native, managed workflow
- **Language:** TypeScript everywhere. Strict mode. No `any`. No JS files.
- **State:** Zustand for client state. React Query for any async/cached data.
- **Local DB:** `expo-sqlite` accessed exclusively through Drizzle ORM
- **Maps:** `@maplibre/maplibre-react-native` with free OSM/USGS/USFS/ESRI tiles
- **Weather:** Direct fetch to Open-Meteo API (primary), `api.weather.gov` (fallback)
- **BLE:** `react-native-ble-plx` with a single supervisor module
- **Storage:** `expo-file-system` for tile cache, exports, backups
- **Billing:** `expo-in-app-purchases` (StoreKit 2 + Google Play Billing 6+), on-device entitlement
- **Crash:** `@sentry/react-native` (free tier)
- **Analytics:** `posthog-react-native` (free tier; lazy load)
- **Speech:** `expo-speech-recognition` (Phase 3)
- **Build/Deploy:** EAS Build + EAS Update + EAS Submit
- **CI:** GitHub Actions (validation harness on every PR)
- **Landing:** Astro on Cloudflare Pages (separate `landing/` workspace)

**Do not introduce:** Rust, native modules outside Expo's plugin system, Firebase, Supabase (V1), any paid third-party API, any cloud sync. These belong in V2+.

---

## Repository Layout

```
/aim
  /app                      # Expo React Native app
    /src
      /screens              # Top-level screens (one file per route)
      /components           # Reusable UI components (each <200 lines)
      /features             # Feature folders (field-mode, shotplan, wez, etc.)
      /hooks                # Custom hooks
      /lib                  # App-side utilities
      /db                   # Drizzle schema + migrations + queries
      /ble                  # BLE supervisor + device adapters
      /weather              # Open-Meteo + NOAA clients
      /maps                 # MapLibre wrappers, tile cache management
      /billing              # IAP entitlement logic
      /storage              # File system, backup, export/import
    app.json
    eas.json
  /packages
    /solver                 # Pure TS ballistics solver (no RN imports)
      /src
      /__fixtures__         # JBM/Berger/Hornady reference trajectories
      /__tests__
    /shared-types           # Shared TypeScript types (rifle, load, profile, etc.)
    /importers              # Strelok, Hornady, AB Mobile, Shooter parsers
  /landing                  # Astro static site
  /docs
    /specs                  # Markdown design docs (spec-first development)
    /protocols              # BLE protocol notes (Kestrel, Garmin, Sig, Leica)
  Claude.md                 # This file
  Initial_Build_Plan.md     # Product + roadmap
  README.md
```

---

## Coding Conventions

### TypeScript
- Strict mode on. `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.
- Never use `any`. Use `unknown` and narrow.
- Prefer `type` over `interface` unless declaration merging is required.
- Use named exports. Default exports only for screens (Expo Router requirement).
- Discriminated unions over enums.

### React / React Native
- Function components only. No class components.
- Components stay under 200 lines. If a component grows past that, decompose.
- Hooks live in `hooks/` directory. Custom hook names start with `use`.
- No prop-drilling more than 2 levels — lift to Zustand or React Context.
- Avoid `useEffect` when a derived value or React Query suffices.

### Styling
- Use `StyleSheet.create` or NativeWind (Tailwind for RN). Pick one and stick to it. Default to NativeWind unless the team votes otherwise.
- Three theme modes (Day, Bright, Night-Red) — every color goes through the theme provider.
- Field Mode HUD touch targets: minimum 56×56 dp (gloves on).

### Database (Drizzle + SQLite)
- All schema in `app/src/db/schema.ts`.
- All queries in `app/src/db/queries/<entity>.ts` — no inline queries in components.
- Migrations are versioned and forward-only; never mutate an existing migration.
- Every entity has `id`, `createdAt`, `updatedAt`, `deletedAt` (soft delete).

### Solver Package
- Pure TypeScript. Zero React Native dependencies. Must run in Node for tests.
- All public functions are pure (no IO, no side effects, no time-dependent behavior).
- Numeric inputs are explicit units — never accept ambiguous numbers. Use branded types: `type Yards = number & { __brand: 'yards' }`.
- Every solver release runs the validation harness. PR is blocked if any fixture exceeds 0.05 mil deviation at 1000 yards.

### Testing
- Vitest for solver, importers, and pure utilities (fast, no RN runtime).
- React Native Testing Library for component tests.
- Validation harness in `packages/solver/__tests__/harness.test.ts` — runs JBM/Berger/Hornady fixtures.
- Snapshot tests OK for stable UI, never for solver outputs.

### Files & Naming
- Screens: `kebab-case.tsx` (matches Expo Router routes).
- Components: `PascalCase.tsx`.
- Utilities: `camelCase.ts`.
- Tests: `<name>.test.ts(x)` colocated with source.
- One thing per file. No barrel exports unless they're at a package boundary.

### Comments
- Comment **why**, never **what**. The code shows what; comments explain non-obvious decisions, ballistics references, or upstream protocol quirks.
- Cite ballistics references inline: `// Litz, Applied Ballistics for Long Range Shooting, 3rd ed., p. 142`
- Cite BLE protocol notes inline: `// Garmin Xero C1 BLE service UUID per docs/protocols/garmin-xero.md`

---

## Development Workflow

### Spec-first for non-trivial features

Before writing code for any feature touching ballistics math, BLE, or differentiator logic:

1. Write a markdown spec in `docs/specs/<feature>.md` covering:
   - Inputs (with units and ranges)
   - Outputs (with units and ranges)
   - Edge cases
   - Test fixtures
   - UI sketch (ASCII or Figma link)
   - References (textbook, protocol doc, paper)
2. Review the spec yourself or with a domain expert.
3. **Then** ask the AI to implement against the spec. Paste the spec into the prompt.

This rule applies to: anything in `/packages/solver`, anything in `/app/src/ble`, all WEZ math, all wind-risk math, all importers.

### Validation-harness-driven solver development

When fixing a solver bug or adding a feature:

1. Add a fixture to `packages/solver/__fixtures__/` that reproduces the bug or covers the new case.
2. Run `npm run test:solver` and confirm it fails.
3. Implement the fix or feature.
4. Run again. Iterate until green.
5. Never merge solver changes without the harness passing.

### Branching
- Trunk-based. Short-lived feature branches off `main`.
- PR title format: `[area] short description` (e.g., `[solver] add aerodynamic jump`).
- Squash-merge. Commit messages are PR titles.

### Releases
- Patch releases (`x.y.Z`): EAS Update OTA only. No store submission.
- Minor releases (`x.Y.0`): EAS Build + EAS Submit to TestFlight and Play open testing for 48 hours minimum, then production.
- Major releases (`X.0.0`): Phase boundaries only.
- Every release publishes the solver validation diff to the public web page.

---

## What to Delegate to the AI vs. Own Yourself

### Delegate freely
- UI scaffolding, form plumbing, screen layouts.
- Drizzle schema and migration generation.
- Importer parsers (give the AI a sample input file).
- Test fixture generation.
- Astro landing page content and components.
- Refactors guided by an existing spec.
- Boilerplate tests (then add edge-case tests yourself).
- Documentation pass-through and formatting.

### Own personally — never delegate without verification
- The Hunter WEZ math model. This is the differentiator and the liability surface. Read every line.
- BLE protocol implementations. Subtle handshake bugs require hardware in hand.
- All cold-bore truing math. Small errors destroy user trust.
- App Store / Play Store listings, screenshots, marketing copy.
- Pricing, IAP product configuration.
- Privacy policy and App Store privacy nutrition labels.
- Any change to the solver validation fixtures.

### AI agent behavior expectations
- Always run the relevant tests after a change. Never claim "this should work" without running it.
- When unsure about ballistics math, ask before implementing — do not invent formulas.
- Surface BLE protocol assumptions explicitly so the human can verify against device docs.
- Prefer existing patterns in the codebase over introducing new ones.
- If you find yourself wanting to install a new dependency, stop and ask. Dependencies are a liability.

---

## Field Mode UX Rules (Non-Negotiable)

These rules govern any code touching the Field Mode HUD or related screens. They exist because hunters operate the app in cold, gloved, low-light, time-pressured conditions.

1. **Cold start to usable solution: ≤1.5 seconds.** Last-used profile and last atmospheric snapshot load before the first frame.
2. **Profile switch: ≤2 taps from any field screen.**
3. **Touch targets: ≥56×56 dp.** No exceptions on field-mode screens.
4. **Three lighting modes (Day/Bright/Night-Red), persistent and one-tap toggle.**
5. **Solver output never blocks on network.** Weather is cached; solutions compute on-device.
6. **No login walls. No paywalls. No ads. Ever in field mode.**
7. **Status strip shows BLE health for all connected devices** at the top of every field screen.
8. **No motion/animation in field mode** beyond essential feedback (haptic on dial confirm, brief flash on shot log). Save battery and don't distract.
9. **Voice command is opt-in and works fully offline.** No cloud STT.
10. **Every field-mode screen passes a "glove test" with a real hunter wearing winter gloves before merge.**

---

## Liability and Ethical Constraints

These are product rules with code implications. Treat them as build-time invariants.

- **The app never says "take the shot."** Hunter WEZ outputs probabilities and a traffic light. UI strings must use language like "estimated probability" and "you are responsible." Never imperative.
- **WEZ is off by default in jurisdictions where automated targeting decision aids may be restricted.** Flag string: `WEZ_ENABLED_BY_DEFAULT` set per region in `app/src/lib/jurisdiction.ts`.
- **No military/tactical framing in any user-facing copy.** Always "hunting," "ethical shot," "wildlife conservation."
- **No data leaves the device without explicit user action** (export, share, backup). Crash reports and analytics are scrubbed of all profile content, location data, and shot logs.
- **Crash reports may include solver inputs only with PII removed**; never include rifle profile names, GPS coordinates, or shot logs.

---

## Common Tasks Reference

### Add a new rifle field
1. Update `packages/shared-types/src/rifle.ts`.
2. Add Drizzle schema column + migration in `app/src/db/schema.ts`.
3. Update form in `app/src/features/rifle-editor/`.
4. Update solver input mapping in `app/src/lib/profile-to-solver-input.ts`.
5. Add fixture and test if the field affects solver output.

### Add a new BLE device
1. Document protocol in `docs/protocols/<vendor>-<device>.md`.
2. Implement adapter in `app/src/ble/adapters/<vendor>-<device>.ts`.
3. Register in `app/src/ble/supervisor.ts`.
4. Add status entry in field-mode status strip.
5. Test with real hardware before merge.

### Add a new weather data point
1. Update `app/src/weather/types.ts`.
2. Update Open-Meteo client query in `app/src/weather/open-meteo.ts`.
3. Update fallback NOAA client if applicable.
4. Update SQLite cache schema if persisted.

### Add a new importer
1. Document the source format in `docs/specs/importers/<source>.md` with sample data.
2. Implement parser in `packages/importers/src/<source>.ts` returning the canonical profile type.
3. Add fixture and round-trip test.
4. Add UI entry in `app/src/features/import/`.

---

## Frequently Asked Decisions

**Q: Should I add a backend service for X?**
A: No. V1 is zero-backend. If X requires server-side processing, it goes on the V2 roadmap. See `Initial_Build_Plan.md` §7 for upgrade triggers.

**Q: Can I use a paid API for Y?**
A: No paid third-party APIs in V1. Only Apple, Google, and the domain registrar receive money in V1.

**Q: Should we add user accounts for sync?**
A: No. V1 uses iCloud/Google Drive document backup and signed-QR profile share. Cloud sync requires backend = V2.

**Q: Should I add this analytics event?**
A: Only if you'll act on it within 30 days. Default to fewer events. Never track shot locations or rifle profiles.

**Q: Can I use this fancy new library?**
A: Default no. Each dependency is long-term liability for a solo maintainer. Justify in PR description if proposing.

**Q: The model wants to refactor the solver to be cleaner. Should I let it?**
A: Only if the validation harness still passes and the diff is reviewable. The solver is the single highest-stakes module. Stability > elegance.

---

## Glossary

- **DOPE** — Data On Previous Engagements. The collection of dial/hold values for a rifle/load at various distances and conditions.
- **WEZ** — Weapon Employment Zone. Probability-of-hit model accounting for dispersion, wind, and target size.
- **CDM** — Custom Drag Model. Bullet-specific drag curve from Doppler radar measurement.
- **BC** — Ballistic Coefficient (G1 or G7 reference).
- **MV** — Muzzle Velocity.
- **DA** — Density Altitude.
- **POI** — Point of Impact.
- **MIL/MOA** — Milliradian / Minute of Angle. Angular measurement units.
- **Cold bore** — First shot from a clean, cold barrel. Often deviates from subsequent shots.
- **Truing** — Adjusting solver inputs to match observed real-world impact.
- **BLE** — Bluetooth Low Energy.
- **HRRR/RAP/GFS** — NOAA weather model identifiers (regional, rapid, global).
- **PRS** — Precision Rifle Series. Competition discipline. **Not our target user.**
- **Rokslide / Hunt Talk / Sniper's Hide** — Hunting/shooting forums. Primary qualitative research sources.

---

*Last updated: at project kickoff. Revise when stack or conventions change. The build plan in `Initial_Build_Plan.md` is the authoritative product reference.*