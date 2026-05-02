# Aim — Solo + AI-Agent Build Plan and Zero-Ops V1 Cut Line

*Companion to the original product concept. Replaces §9–§11 of that document with a build plan tuned for a solo founder using AI coding agents (Claude Code, Cursor), targeting near-zero operating cost at launch and a clear upgrade path that scales only when revenue justifies it.*

---

## Table of Contents

1. [Build Philosophy](#1-build-philosophy-what-were-optimizing-for)
2. [Revised Stack](#2-revised-stack-solo--ai-agent-optimized)
3. [Zero-Ops V1 Cut Line](#3-the-zero-ops-v1-cut-line)
4. [Phased Build Plan](#4-phased-build-plan-week-by-week-ai-agent-friendly)
5. [Operational Cost Schedule](#5-operational-cost-schedule-v1-through-v3)
6. [Revenue Strategy with No Backend](#6-revenue-strategy-with-no-backend)
7. [Upgrade Triggers](#7-upgrade-triggers-when-to-spend)
8. [Working with AI Coding Agents](#8-working-effectively-with-ai-coding-agents)
9. [Risks and Mitigations](#9-risks-specific-to-this-approach-and-mitigations)
10. [Decision Summary](#10-decision-summary)

---

## 1. Build Philosophy: What We're Optimizing For

Three constraints reshape every decision below:

1. **AI-agent-friendly codebase.** One language, large training corpus, conventional patterns, minimal native bridging. Cursor and Claude Code thrive on TypeScript + React, struggle disproportionately on Rust FFI, custom build systems, and obscure native modules.
2. **Sweat equity over capital.** V1 ships with one developer paying ~$140 in unavoidable platform fees and *nothing else recurring*. Apple and Google handle billing; everything else runs on free tiers or on-device.
3. **Real market value at v1, not a demo.** The five differentiators from the original concept (Hunter WEZ, ShotPlan, wind-risk envelope, cold-bore intelligence, suppressor profiles) all ship in v1 — they are math + UX, not infrastructure.

What we sacrifice in v1 to hit those constraints: cloud sync, community DOPE, watch companions, and high-res licensed imagery. All preserved on the v2 roadmap, gated by revenue thresholds spelled out in §7.

---

## 2. Revised Stack: Solo + AI-Agent Optimized

### 2.1 Framework decision: **Expo (React Native) + TypeScript**

The original concept recommended Flutter + Rust core via FFI. That is the right answer for a funded team. For a solo build with AI agents, switch to Expo + React Native + TypeScript:

- **Single language across the entire codebase.** TypeScript for app, solver, tests, scripts, landing page. Cursor and Claude Code generate, refactor, and debug TypeScript with the highest quality of any language. Dart (Flutter) is workable but the model has materially less training data, and Rust FFI debugging is a known AI-agent pain point.
- **Expo eliminates 90% of native pain.** Code signing, certificates, OTA updates, builds, simulators — all handled by EAS (Expo Application Services). One CLI command per build. Free tier covers 30 builds/month, more than sufficient for v1.
- **The ecosystem solves every BLE and map problem we have.** `react-native-ble-plx`, `@maplibre/maplibre-react-native`, `expo-sqlite`, `expo-file-system`, `expo-speech` — all production-grade, all with months/years of issues resolved that an AI agent can pattern-match against.
- **Performance is sufficient.** A modified point-mass ballistic solver in pure TypeScript computes a 1000-yard trajectory in under 5 ms on a mid-range phone. We do not need native performance. (We don't need bit-exact cross-platform numerics either — we need accuracy within 0.05 mil of published tables, which is trivial in TS.)

**Cost: $0/month.** Apple Developer ($99/yr) and Google Play ($25 one-time) are the only platform fees, and those are required regardless of stack.

### 2.2 Ballistics solver: **Pure TypeScript module, validated against public tables**

- Modified point-mass + RK4 integration in a `solver/` workspace package.
- G1/G7 drag functions (Mayevski/Siacci coefficients, public domain).
- Coriolis (latitude + azimuth + range), spin drift, aerodynamic jump, cant correction.
- MV truing and drop-scale-factor truing as separate calibration functions.
- A validation harness using JBM Ballistics published tables, Berger reload manual values, and Hornady ballistic calculator outputs as ground truth. Every PR runs the harness; every release publishes the diff.
- CDM (custom Doppler-derived drag) deferred to v2 — v1 ships G1/G7 multi-segment BC like Strelok Pro, which is what hunters use 95% of the time anyway.

**Why this works for an AI agent:** the solver is ~1,500 lines of pure functions. Claude Code can write the whole thing in a few sessions, and the validation harness gives you objective pass/fail signal so you know when it's right. No gut-feel debugging.

### 2.3 Local data: **`expo-sqlite` + Drizzle ORM**

- All profiles, shot logs, cold-bore events, atmospheric snapshots stored in local SQLite.
- Drizzle gives you type-safe schema and migrations that AI agents handle cleanly.
- iCloud Documents and Google Drive backup via `expo-file-system` — free, user-owned, no backend.
- No accounts. No login. The app works fully on first launch.

**Cost: $0.** Zero infrastructure. Zero data liability.

### 2.4 Maps: **MapLibre Native + free OSM tiles, cached on-device**

- `@maplibre/maplibre-react-native` renders vector tiles natively.
- **Tile sources for v1 (all free):**
  - OpenStreetMap raster/vector tiles (respect their tile usage policy by caching aggressively and showing attribution).
  - USGS topo via the National Map (free, US-only, generous use).
  - USFS Forest Visitor Map and BLM ground-track data (free, public domain).
  - ESRI World Imagery via their free tile service (attribution required, fair-use limits — fine for v1 scale).
- Offline regions: user pinches a rectangle, app downloads and stores tiles in `expo-file-system`. No CDN cost to us — tiles come from the source's free tier and live on the user's device thereafter.
- **When we outgrow free tiles** (after a few thousand active users, when usage policies start to bite), we promote to either MapTiler ($25–100/mo) or self-host PMTiles on Cloudflare R2 (~$5/mo). That promotion happens after revenue, not before.

**Cost: $0** at v1. ~$5–25/mo at first scale milestone.

### 2.5 Weather: **Open-Meteo, called directly from the app**

- Open-Meteo is free for non-commercial use and has a generous commercial free tier. Critically, it exposes pressure-level data (winds aloft) — exactly what we need for the wind-risk envelope and ShotPlan features.
- Direct API calls from the app. No backend proxy. Cache results in SQLite with timestamps.
- For US users, Open-Meteo aggregates NOAA HRRR/RAP/GFS automatically, so we get the high-quality regional model without writing any ingest code.
- **Backup:** `api.weather.gov` (NOAA's own free public API) for redundancy in North America.

**Cost: $0.** When we hit Open-Meteo's commercial threshold (~10k API calls/day), we either upgrade their plan ($29–99/mo) or proxy through our own caching layer.

### 2.6 BLE / hardware: **`react-native-ble-plx`, manual entry as the always-available fallback**

- Phase 3 work — not v1-launch critical. The free-tier app is fully usable with manual range and atmospheric entry.
- Day-1 BLE targets (in priority order): Garmin Xero C1 Pro chronograph (documented BLE service, community examples exist), generic GATT chronographs, Kestrel 5x00/5700 LiNK (using public protocol docs; deeper integration via partnership later), then Sig BDX / Leica .COM read-only.
- A single supervisor module manages all BLE state. AI agents handle BLE state machines well when given a clear spec.

**Cost: $0.**

### 2.7 No backend in v1

This is the headline call. V1 ships with **zero servers**.

What we lose by skipping a backend:
- Multi-device sync → replaced by **iCloud/Google Drive document backup** (free, user-controlled) and **signed-QR profile share** for buddy/guide handoff.
- Community DOPE → deferred to v2.
- Account/login UX → eliminated (nothing to log into).

What that buys us:
- $0/month operating cost.
- Zero attack surface, zero data-breach liability, zero GDPR/CCPA processing-agreement headaches.
- Zero "the cloud is down right before my hunt" risk — the #1 forum complaint about every existing app.
- A privacy story we can put on the box: "Your hunt data never leaves your phone."

That last point is itself a marketing wedge against onX, Hornady (which had the public reset-bug incident), and AB Quantum.

### 2.8 Auth: **None in v1**

No sign-up, no email capture inside the app. Settings includes "join the newsletter" with an external link to a Resend-powered form. App Store and Play Store handle subscription entitlement via StoreKit 2 / Google Billing Library 6+. We never see a credit card.

### 2.9 Subscription billing: **App Store / Google Play native, no backend validation**

- StoreKit 2 (iOS) and Google Play Billing (Android) handle purchase, restore, and entitlement checks entirely on-device.
- Receipt verification can be done locally for v1 — it's not perfectly forgery-proof, but for $24.99/year the fraud loss is rounding error, and we add server-side validation when we have a server.
- This means **revenue from day one with zero billing infrastructure**.

### 2.10 Crash reporting: **Sentry free tier**

5,000 events/month, 1 user. Plenty for early users. Costs $0.

### 2.11 Analytics: **PostHog free tier OR none**

PostHog free tier covers 1M events/month. Or skip analytics entirely in v1 and rely on App Store Connect / Play Console metrics + direct user feedback. Many indie apps survive on that alone.

### 2.12 Landing page: **Astro on Cloudflare Pages, Resend for email**

- Astro static site, hosted free on Cloudflare Pages.
- Domain: ~$12/year (Cloudflare or Namecheap).
- Email capture via Resend free tier (3,000 emails/month).
- Total: ~$12/year.

### 2.13 CI/CD: **EAS Build free tier + GitHub Actions free tier**

EAS Build free tier (30 builds/month) handles app store submissions. GitHub Actions free tier (2,000 minutes/month) runs the solver validation harness and unit tests on every PR. Both free for solo use.

### 2.14 Total operational cost summary

| Item | Annual cost |
|---|---|
| Apple Developer Program | $99 |
| Google Play (one-time, amortize) | $25 first year, $0 thereafter |
| Domain (Cloudflare/Namecheap) | $12 |
| Everything else (hosting, weather, maps, sync, auth, analytics, crash reporting, CI/CD) | $0 |
| **V1 Year 1 total** | **~$136** |
| **V1 Year 2+ total** | **~$111/year** |

That's the entire infrastructure cost to operate a real ballistics + hunt-planning app for an unbounded number of users until you choose to upgrade.

---

## 3. The Zero-Ops V1 Cut Line

V1 ships with these five differentiators intact, all on-device, all $0 to operate:

| Differentiator | V1 implementation |
|---|---|
| Hunter WEZ (ethics layer) | On-device math: dispersion + wind sigma + terminal energy threshold per bullet. No server. |
| ShotPlan (map + ballistics fusion) | MapLibre + free tiles + on-device solver + on-device sun/shadow (SunCalc.js). No server. |
| Wind-risk envelope | Direct Open-Meteo API call (free), upper-air winds, on-device variance computation. |
| Cold-bore intelligence | SQLite log + on-device regression. No server. |
| Suppressor variants & profile architecture | SQLite schema + Drizzle ORM. No server. |

Plus the table stakes:
- Modified point-mass solver (G1/G7), Coriolis, spin drift, aerodynamic jump, cant
- Multi-rifle / multi-load / multi-zero
- MV truing, drop-scale-factor truing, tall-target test wizard
- MIL/MOA holds, dial output, reticle holdover overlay
- Field Mode HUD (Day / Bright / Night-Red modes)
- Manual atmospheric input (BLE comes in Phase 3)
- Importers for Strelok Pro, Hornady 4DOF, AB Mobile data exports
- Signed-QR profile share (no server — JSON in QR, signed with a generated key on first run)
- Local SQLite + iCloud/Google Drive backup

V1 explicitly defers:
- Apple Watch / Wear OS / Garmin Connect IQ apps (each is its own native build; Phase 5 stretch or v1.5 release)
- Multi-device cloud sync (would need a backend)
- Community DOPE (would need a backend + aggregation pipeline)
- Draw odds and game-tracking features (v2 roadmap)
- AI wind reading from video (v3 roadmap)
- High-res licensed satellite imagery (paid)
- Voice command (Phase 3 if time; otherwise v1.5)

Even with these deferrals, V1 ships with five things no current app combines, the entire core ballistic surface area, and a hunter-first UX. That's enough to validate the market.

---

## 4. Phased Build Plan (Week-by-Week, AI-Agent Friendly)

Assumes one developer working ~20–30 focused hours/week with Claude Code and Cursor. Total: ~18 weeks (4.5 months) from kickoff to App Store submission.

### Phase 0 — Foundations (Weeks 1–2)

**Goal:** Project scaffolding, solver kernel, validation harness running green.

1. Spin up Expo SDK 52+ TypeScript project with EAS configured, GitHub repo, GitHub Actions for tests.
2. Create `packages/solver/` workspace. Implement modified point-mass solver with G1 and G7 BC, RK4 integration, environmental corrections (DA, station pressure, temp, RH), Coriolis, spin drift, aerodynamic jump.
3. Build the validation harness: a `__fixtures__/` directory of JSON trajectory tables sourced from JBM, Berger reload manuals, and Hornady's online calculator. Every solver release runs the harness and reports max deviation per fixture.
4. Set up Sentry, Cloudflare Pages landing page placeholder, Resend account.

**AI-agent strategy:** Use Claude Code to scaffold the project end-to-end. For the solver, paste public ballistic equations (JBM, Pejsa, Litz's Applied Ballistics formulas — all freely documented) into the prompt and have Claude implement, then iterate against the validation harness until every fixture passes within 0.05 mil at 1000 yards.

**Deliverable:** `npm test` passes the solver harness. App opens to a "Hello Aim" screen.

### Phase 1 — Core App + Field Mode (Weeks 3–6)

**Goal:** A usable shooting tool. Manual everything. No maps, no weather APIs yet.

1. SQLite schema with Drizzle: rifles, loads, scopes, zeros, atmospheric snapshots, cold-bore events.
2. Profile creation flows (rifle, scope, ammo, zero) with native form components.
3. Field Mode HUD:
   - Three lighting modes (Day / Bright / Night-Red) with persistent user preference.
   - Range entry (large numeric chiclets), wind entry (clock + speed), atmospheric override.
   - One-screen solve output: dial in clicks, hold in mil/MOA, reticle overlay scaled to current magnification, time of flight, retained energy.
   - Profile switcher (swipe left/right between rifles).
4. Cold-bore log (manual entry on first shot of day).
5. Suppressor variant toggle on each rifle profile.
6. Truing wizards: MV truing from chrono input or drop, drop-scale-factor truing from 2–3 known points, tall-target test.
7. Custom turret CDS export to PDF.

**AI-agent strategy:** Generate one screen at a time with Cursor. Keep components small (under 200 lines) so the model can hold them in context entirely. Use Storybook (or its React Native equivalent, Storybook for React Native) so each component is testable in isolation — AI agents are dramatically more productive when they can see immediate visual feedback.

**Deliverable:** A complete shooting tool. Hand it to a hunter friend; they should be able to enter a 6.5 PRC profile, true MV, and get a clean dial number for 600 yards in under 10 minutes.

### Phase 2 — Hunt Planning Layer (Weeks 7–10)

**Goal:** Maps, weather, and the differentiator features.

1. MapLibre integration with vector OSM tiles, USGS topo overlay, ESRI imagery overlay.
2. Offline region picker: pinch a rectangle, download and persist tiles.
3. Open-Meteo client: surface and pressure-level wind, temperature, humidity, pressure. Cache to SQLite with timestamps and explicit "data is N hours old" UI.
4. **ShotPlan v1:** drop a glassing pin and a target polygon, app pre-computes a solution envelope (min/max/avg DOPE), sun/shadow at planned glass time using SunCalc.js, elevation profile from OpenTopography or USGS 3DEP.
5. **Hunter WEZ v1:** vital-zone hit probability calculation, bullet minimum impact velocity flag, traffic-light output. Editable per-species defaults.
6. **Wind-risk envelope:** convert single wind hold to a confidence band using upper-air wind variance from Open-Meteo. Toggleable to single-number for users who prefer that.
7. Pre-hunt readiness checklist screen ("offline maps for AOI: ✓; rifle profile up to date: ✓; battery >50%: ✓").

**AI-agent strategy:** ShotPlan and Hunter WEZ are the highest-judgment work in the build. Spec them rigorously in markdown design docs first, then have Claude Code implement against the spec. Treat the spec as the source of truth that you and the AI both reference.

**Deliverable:** Full v1 differentiator surface. App is now genuinely competitive on features no incumbent matches.

### Phase 3 — Hardware & Polish (Weeks 11–14)

**Goal:** BLE integrations, voice input, importers, polish.

1. `react-native-ble-plx` integration with a single supervisor module.
2. Garmin Xero C1 / C1 Pro chronograph BLE read (highest priority — most common modern hunter chrono).
3. Kestrel 5x00/5700 LiNK basic profile and live atmospheric stream.
4. Generic GATT chronograph support (LabRadar LX, etc.).
5. Sig BDX / Leica .COM / Vortex Fury read-only range receive.
6. Voice range entry via `expo-speech` (English): "Aim, range eight twenty four, ten right."
7. Importers: Strelok Pro CSV, Hornady 4DOF JSON, AB Mobile JSON, Shooter export, Kestrel profile export.
8. Signed-QR profile share: generate Ed25519 keypair on first run, sign profile JSON, encode as QR. Receiving phone verifies signature and offers import.
9. Accessibility pass: VoiceOver/TalkBack labels on every interactive element.
10. Bug bash and performance pass.

**AI-agent strategy:** BLE work benefits from having Claude Code read the protocol docs *with you* — paste the relevant sections of the Garmin/Kestrel docs in the same chat where you're writing the integration. The model will catch handshake mistakes you'd miss.

**Deliverable:** Feature-complete v1. Ready for beta.

### Phase 4 — Beta + Launch (Weeks 15–18)

1. **Closed alpha (Week 15):** push to TestFlight and Play Console internal testing. Recruit 30–50 hunters from Rokslide, r/longrange, Hunt Talk by posting honest "I built this, looking for testers" threads.
2. **Open beta (Weeks 16–17):** widen TestFlight (10k cap) and Play open testing track. Promote on the original concept's go-to-market channels (Backfire, Ron Spomer Outdoors, Long Range Pursuit, Rokcast). Daily bug triage, weekly OTA update via EAS Update (free tier).
3. **Solver validation publication:** publish the validation harness output as a public web page (Cloudflare Pages). This is a trust signal. Show your work like Bryan Litz does.
4. **App Store submission (Week 18):** polish App Store listing, privacy nutrition labels (easy — we collect nothing), screenshots, preview video.

**Cost during beta:** still $0 incremental. EAS Update free tier covers OTA. Sentry free tier covers crash reports. Resend free tier covers the waitlist.

### Phase 5 — Post-Launch (Months 5–6, optional)

Triggered only after we have **paying users and validated demand**:

- Apple Watch app via SwiftUI native module bridged into the Expo project.
- Wear OS app via Compose native module.
- v1.1 / v1.2 polish releases responding to user feedback.

Defer further v2 work (community DOPE, draw odds, game tracking) until §7 revenue triggers are met.

---

## 5. Operational Cost Schedule, V1 Through V3

### V1 — Launch through ~5,000 users
Already itemized above. **~$111–$136/year.** No backend, no servers, no paid APIs.

### Trigger to upgrade to V2 infrastructure
- 1,000+ paying subscribers (~$25k+ ARR), **OR**
- Open-Meteo or map tile usage policies bite, **OR**
- Multi-device sync becomes the #1 user request

### V2 — Scale-up infrastructure (estimated 5k–50k users)

| Item | Why we add it | Estimated monthly cost |
|---|---|---|
| Supabase Pro (Postgres + Auth + Storage) | Multi-device sync, accounts, community DOPE backend | $25 |
| Cloudflare R2 + Workers (PMTiles host) | Replace fair-use OSM/ESRI with our own tile economics | $5–15 |
| Open-Meteo commercial tier | Past free quota | $29–99 |
| Sentry Team plan | Past free crash budget | $26 |
| PostHog Cloud growth | Past free analytics quota | $0–50 (still mostly free) |
| Resend or Postmark | Transactional + newsletter | $20 |
| Apple Search Ads / Google App Campaigns | Growth channel | Variable, $200–2,000 |
| **V2 baseline operational cost** | | **~$100–250/month** before paid acquisition |

This tier is comfortably sustained by 1,000+ subscribers at $24.99/year ($25k+ ARR).

### Trigger to upgrade to V3 infrastructure
- 50k+ active users, OR
- Real-time collaboration (live hunt-party features) demands it, OR
- AI wind-reading or ML game-prediction features demand inference infrastructure

### V3 — Scale (50k–500k users)

| Item | Estimated monthly cost |
|---|---|
| Postgres infrastructure (Supabase Team or migration to managed Postgres + thin Go service) | $200–800 |
| CDN egress for high-res imagery | $200–1,000 |
| Weather data (commercial) | $200–500 |
| Licensed imagery (Maxar/Vexcel) for premium tier | $500–5,000 (passed through to users) |
| ML inference (CoreML/TFLite on-device, plus occasional cloud training jobs) | $50–200 |
| Crash reporting, analytics (paid tiers) | $100–300 |
| Customer support tooling | $50–200 |
| **V3 baseline operational cost** | **~$1,300–8,000/month** |

At 50k users with even a 10% paid conversion at $39/yr, that's ~$195k ARR — comfortable margins on $1,300–8,000/mo opex.

---

## 6. Revenue Strategy with No Backend

The trick to charging without a backend is letting Apple and Google do all the billing work for you.

### Pricing recommendation for V1 launch

- **Free tier:** core ballistic solver, 1 rifle profile, manual atmospherics, no maps. Real and useful, not a demo.
- **Aim Hunter — $24.99/year** (or $3.99/mo): unlimited profiles, ShotPlan, Hunter WEZ, wind-risk envelope, all weather layers, all hardware integrations, signed-QR sharing, custom turret CDS export, importers.
- **Aim Founders — $79 lifetime** (capped at 2,000 founders during launch quarter): same as Hunter, forever. Trust-building anchor; revenue concentration in launch period when you most need cash flow.

### Why this works with no backend
- Apple StoreKit 2 and Google Play Billing 6+ verify entitlements on-device. We trust the receipt; Apple/Google handle fraud at scale and would refund chargebacks themselves.
- Subscription state lives in the user's Apple ID / Google account. If they reinstall or get a new phone, restore-purchases works without our servers.
- We add server-side receipt validation in V2 when we have servers anyway. Until then, the small fraud delta on a $25/year app is rounding error.

### Realistic V1 revenue projection
Conservative assumption: 1,000 downloads in launch month from forum posts + influencer placements. Industry-typical 5% paid conversion = 50 paying users in month one. At $24.99/yr, that's $1,250 in MRR-equivalent within 30 days. Apple/Google take 30% (15% under $1M annual revenue per Small Business Program), so net ~$1,000.

That alone covers operating costs for nine years.

By month 6 with continued forum and influencer presence, 5,000 downloads and 250 paying subscribers is realistic — net ~$5,200 ARR. Still well under V2 trigger threshold.

By month 12 with first hunting season tailwind, 20,000 downloads and 1,000+ paying subscribers (~$25k ARR) puts us at the V2 upgrade trigger. Revenue funds the upgrade.

---

## 7. Upgrade Triggers: When to Spend

Don't add infrastructure until users force you to. Specific triggers:

| Trigger | Spend it unlocks |
|---|---|
| 500 paying subscribers | First hire (or contractor): a part-time iOS/Android specialist for watch apps. Optional. |
| 1,000 paying subscribers OR 90+ days of "where's my sync?" being the #1 feature request | Stand up Supabase + sync. Begin V2. |
| Open-Meteo or tile provider sends a usage warning | Promote to paid tier or self-host PMTiles on Cloudflare R2. |
| 10,000 active users | Switch to paid Sentry/PostHog plans. |
| 25,000 paying subscribers | First full-time hire (likely an iOS+watch specialist or a hardware-integration engineer). |

The principle: **never spend ahead of demand**. You will be tempted to "build for scale" — don't. The Lindy effect is real and so is the death-by-AWS-bill hall of indie graveyards.

---

## 8. Working Effectively with AI Coding Agents

A few practices that compound returns:

**Spec-first development.** Before opening the editor for a non-trivial feature, write a one-page markdown spec: inputs, outputs, edge cases, test fixtures, UI sketch in ASCII or Figma link. Paste it into Claude Code and have it implement against the spec. This is the difference between getting the right thing in 30 minutes vs. fighting the model for 4 hours.

**Validation harnesses are gold.** The solver harness from Phase 0 is the model interaction unlock for the entire project. When you ask Claude to fix a solver bug, it can run `npm test` and iterate until green. Build similar harnesses for the WEZ math, the wind-risk math, and the importer parsers. Anywhere there's correct/incorrect, write a fixture.

**Component isolation.** Keep React components under 200 lines. Use a flat-ish file structure. Avoid clever abstractions until they prove themselves. AI agents do their best work when the surrounding code is boring and predictable.

**Use Cursor's `.cursorrules` (or this repo's `Claude.md`) heavily.** Document your preferences: "Use Drizzle for all DB access. Never use `any`. Test files end in `.test.ts`. Components use named exports." Saves you re-stating preferences every session.

**Treat the model as a fast intern, not a senior engineer.** It will produce confident garbage on novel ballistics math you don't double-check. Always run the validation harness. Always read the diff. Never merge without reading.

**Hard problems to do yourself, not delegate:**
- The Hunter WEZ math model (this is the differentiator and the liability surface — own it personally).
- BLE protocol reverse engineering (subtle and requires hardware in hand).
- App Store / Play Store listings and screenshots (marketing copy is high-leverage).
- All cold-bore truing math (small errors here destroy user trust).

**Easy to delegate:**
- All UI scaffolding and form plumbing.
- SQLite schemas and Drizzle migrations.
- Importer parsers (you have file format examples; AI eats this for breakfast).
- Test fixture generation.
- Astro landing page.
- Most of the solver kernel (with rigorous validation).

---

## 9. Risks Specific to This Approach (and Mitigations)

| Risk | Mitigation |
|---|---|
| Solver accuracy ends up worse than incumbents and forums roast it | Validation harness against published tables is non-negotiable. Publish validation results publicly each release. Beta-test extensively before App Store submission. |
| BLE integrations break across iOS/Android version updates and you have no team to fix them quickly | Manual entry is always available; in-app status strip surfaces broken links honestly. EAS Update lets you push fixes within hours of detecting a regression. |
| Hornady, AB, or onX copies the differentiator features quickly | They won't move fast — they have organizational reasons not to (covered in §8.3 of the original concept). Your moat is hunter-first UX, brand trust, and the ability to ship weekly. They cannot ship weekly. |
| Solo founder burnout pre-launch | Hard 18-week timeline with weekly releases to forum testers. If a phase slips, cut scope before extending the timeline. The differentiators ship; everything else is negotiable. |
| Subscription model gets review-bombed in App Store ("everything should be free") | Free tier is real and useful. $24.99/year is below all comparable hunting apps. Founders Lifetime gives the loudest critics a one-time path. |
| Apple or Google rejects the app over weapons-adjacent content | Both stores allow ballistic calculators (Hornady 4DOF, AB Mobile, Strelok, Shooter all live there). Submission language emphasizes "hunting," "ethical shot decisions," "wildlife conservation." Avoid any military/tactical framing. |
| Open-Meteo policy change cuts off free tier suddenly | NOAA `api.weather.gov` is the backup; we ship with both clients on day one. Worst case, we promote to commercial weather tier (the $29–99/mo line item in V2) earlier than planned. |
| User loses data on phone replacement and blames you | iCloud Documents backup is automatic. Manual export (JSON + signed QR) is one-tap. UI surfaces "last backup: 2 days ago" to encourage hygiene. The Hornady incident is a wedge: market against it. |

---

## 10. Decision Summary

**Stack:** Expo + React Native + TypeScript everywhere. SQLite locally. MapLibre + free tiles. Open-Meteo direct. No backend. App Store / Play Store native billing. EAS for builds and OTA. Sentry + PostHog free tiers. Astro landing page on Cloudflare Pages.

**Build:** 18 weeks, one developer, ~20–30 hours/week with Claude Code and Cursor, validation-harness-driven for the solver, spec-first for the differentiator features.

**Operating cost at launch:** ~$136 in year 1, ~$111/year thereafter. Apple, Google, and a domain. That's the entire bill.

**Revenue:** $24.99/year and a $79 lifetime Founders pass, billed by Apple and Google directly. Net ~$1,000 from a conservative first-month cohort covers nine years of operating costs.

**Upgrade triggers:** Pay for infrastructure only when paying users force the move. ~1,000 subscribers unlocks Supabase + sync. ~10,000 users unlocks paid analytics/crash. ~25,000 subscribers funds first hire.

**What ships in V1 with all of the above:** Hunter WEZ, ShotPlan, wind-risk envelope, cold-bore intelligence, suppressor variants, the full table-stakes solver, hunter-first Field Mode UI, BLE chrono and Kestrel integration, signed-QR profile share, importers from every major competing app, offline maps, free upper-air weather. Five real differentiators no current app combines. Enough to validate the market and fund everything that comes next.