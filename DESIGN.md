---
# ============================================================
# DESIGN.md — RangeDOPE Design System
# ============================================================
# Generated: 2026-05-03
# Platforms: iOS (React Native / Expo) · Web (Astro / Vercel)
# ============================================================

color:
  # ── Core Palette ──────────────────────────────────────────
  primary:
    DEFAULT:  "#FF2200"   # Tactical red — the brand's heartbeat
    warm:     "#FF3000"   # Slightly orange-shifted, used on web + map UI
    dark:     "#CC0000"   # Bright mode primary (WCAG AA on white)
    night:    "#8B0000"   # Night-vision red — low luminance, preserves dark adaptation

  bg:
    day:      "#0A0A0A"   # True near-black base — modal darkness, not harsh
    bright:   "#F0F0EB"   # Warm off-white for outdoor daylight readability
    night:    "#000000"   # Pure black — maximize eye adaptation

  surface:
    day:      "#161616"   # Cards / panels lifted off bg
    bright:   "#FFFFFF"
    night:    "#0D0000"   # Slight red tint preserves red-only spectrum

  border:
    day:      "#2C2C2C"   # Visible but unobtrusive dividers
    bright:   "#C8C8C0"
    night:    "#280000"   # Red-tinted border in night mode

  label:
    day:      "#F0F0F0"   # High-contrast near-white
    bright:   "#111111"
    night:    "#7A0000"   # Dark red text — readable under red light only

  dim:
    day:      "#8A8A8A"   # 5.9:1 on #0A0A0A — WCAG AA compliant
    bright:   "#666666"   # 4.6:1 on white — WCAG AA compliant
    night:    "#4A0000"   # Subdued red for secondary labels

  nav:
    bg-day:      "#0D0D0D"
    bg-bright:   "#FFFFFF"
    bg-night:    "#060000"
    active-day:  "#FF2200"
    active-bright: "#CC0000"
    active-night:  "#8B0000"
    inactive-day:  "#5A5A5A"
    inactive-bright: "#888888"
    inactive-night:  "#4A0000"
    border-day:  "#2C2C2C"

  # ── Semantic / Overlays ───────────────────────────────────
  shooter-pin:  "#FF3000"   # Red — shooter position marker
  target-pin:   "#FFB300"   # Amber — target position marker
  wind-hold:    "#FFB300"   # Amber — lateral hold value in HUD

  blm-overlay:
    blm-public: "#F5C842"   # BLM federal land — yellow
    usfs:       "#4A8C4A"   # National Forest — green
    nps:        "#2E6E2E"   # National Park — dark green
    state:      "#8A6A2E"   # State land — brown
    private:    "#444444"   # Private — grey

  glass-overlay: "rgba(0,0,0,0.65)"   # Map HUD panel backgrounds
  crosshair:     "rgba(255,48,0,0.45)" # Tactical scope crosshair lines

  # ── Web Landing (Astro) ───────────────────────────────────
  web-surface:  "#101010"
  web-surface2: "#161616"
  web-primary-glow: "rgba(255,48,0,0.12)"

typography:
  # ── Typefaces ─────────────────────────────────────────────
  family:
    mono:    "SpaceMono-Regular"    # React Native — loaded via expo-font
    mono-web: "'Space Mono', 'SF Mono', monospace"  # Web (Google Fonts)
    sans-web: "'Space Grotesk', system-ui, -apple-system, sans-serif"

  # ── Scale — Mobile (dp / pt) ─────────────────────────────
  size:
    micro:    8    # DOPE table range labels, legend ticks
    label:    9    # Section headers, chip labels, form field labels (letterSpacing: 1-2)
    caption:  10   # Metric units, tab labels, map toggle text (letterSpacing: 1-1.5)
    body-sm:  11   # Secondary HUD metrics, notes, info text
    body:     12   # Panel titles, DOPE headers (letterSpacing: 2)
    body-md:  13   # Computed value labels, DOPE profile notes
    input:    14   # TextInput values, coordinate fields
    metric:   15   # Computed ballistic values (range, velocity)
    heading:  18   # Card titles, subsection headings
    display:  22   # Large computed holdover values (MIL/MOA)
    hud-main: 28   # Secondary HUD primary values (WIND, HOLD)
    hud-hero: 42   # DIAL (turret click count) — the biggest number on screen

  # ── Tracking (letterSpacing in dp) ───────────────────────
  tracking:
    none:   0
    tight: -1      # HUD hero display numbers (compression for large numerals)
    loose:  0.5    # Body text, profile notes
    wide:   1      # Standard UI labels
    wider:  1.5    # Chip/tag labels
    widest: 2      # Section headers, panel titles
    ultra:  3      # Web section labels

  # ── Line Height ───────────────────────────────────────────
  line-height:
    tight: 1.0     # Display numerals
    normal: 1.6
    relaxed: 1.7
    loose: 1.85    # Privacy policy body text

spacing:
  # Base-4 scale (dp / px)
  0:  0
  1:  4
  2:  8
  3:  12
  4:  16
  5:  20
  6:  24
  7:  28
  8:  32
  9:  36
  10: 40
  12: 48
  16: 64
  20: 80

  # Named semantic spacers
  panel-padding:    14    # Inner card / computed section padding
  hud-padding:      20    # FieldHUD outer padding
  section-padding:  32    # Full-bleed section interior
  safe-gap:          8    # Between map UI controls (offline btn, style toggle)

radius:
  sharp:  2     # Handle bar drag pill
  sm:     4     # Chip / tag badges, style toggle buttons
  md:     6     # Input fields, small cards
  lg:     8     # Buttons, GPS chip
  xl:    10     # Computed data cards
  2xl:   12     # Web feature cards
  3xl:   16     # Bottom sheet top corners (WaypointTypeSheet)
  full:  999    # Pill badges (hero badge on landing page)

elevation:
  # React Native shadow values
  map-overlay:
    shadowColor:   "#000"
    shadowOffset:  { width: 0, height: 2 }
    shadowOpacity: 0.4
    shadowRadius:  4
    elevation:     4

  panel:
    shadowColor:   "#000"
    shadowOffset:  { width: 0, height: -2 }
    shadowOpacity: 0.3
    shadowRadius:  8
    elevation:     8

  # Web drop shadows (CSS)
  logo-glow: "0 0 60px rgba(255,48,0,0.20), 0 20px 60px rgba(0,0,0,0.60)"
  card:      "none"   # Cards use border instead of shadow

motion:
  # Standard React Native / CSS transition durations (ms)
  fast:     150    # Hover states, toggle color changes
  normal:   200    # Button transforms, mode switches
  slow:     300    # Panel expand/collapse
  map-fade: 250    # Map style crossfade (MapLibre default)

  # Easing
  ease-out: "ease-out"
  spring:   "spring"   # Native feel for press interactions

  # Animations
  pulse-opacity:
    from: 1.0
    to:   0.3
    duration: 2000
    iteration: infinite
    # Used on: hero badge "●" dot on landing page

opacity:
  invisible:     0
  dim-overlay:  0.45    # Crosshair lines over map
  map-hillshade: 0.45   # ESRI hillshade on composite 3D style
  blm-overlay:   0.52   # BLM SMA raster over base map
  glass-panel:   0.65   # Map HUD dark glass backgrounds
  glass-nav:     0.72–0.85  # Bottom mode bar, nav bar
  inactive-tab:  0.45   # Nav icons not selected
  dimmed-label:  0.6    # Secondary coordinate text in waypoint list

border:
  width:
    hairline: 0.33   # StyleSheet.hairlineWidth (map mode divider)
    thin:     1
    medium:   1.5    # TextInput borders (more visible on dark bg)
    thick:    2      # Pin marker dot rings

  style: "solid"

# ── Map Layer Configuration ───────────────────────────────
map:
  default-style: "topo"
  styles:
    - id: topo
      label: TOPO
      source: USGS National Map
      url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
    - id: lidar
      label: LIDAR
      source: USGS 3DEP Shaded Relief
      url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}"
    - id: composite
      label: 3D
      source: ESRI Satellite + Hillshade (45% opacity)
    - id: satellite
      label: SAT
      source: ESRI World Imagery
    - id: vector
      label: VEC
      source: OpenFreeMap Liberty
  ownership-overlay:
    label: OWN
    opacity: 0.52
    source: BLM Surface Management Agency
    color: "#FFB300"   # Active toggle accent color
  pin-colors:
    shooter: "#FF3000"
    target:  "#FFB300"
  crosshair-opacity: 0.45
---

# RangeDOPE — Design Language

## Brand Identity

RangeDOPE is a long-range ballistic solver and tactical hunt planning tool for iOS. The visual language borrows from **military optics**, **aviation instrument panels**, and **night-vision equipment** — not consumer outdoor apps. Every design decision reinforces the idea that this is a precision instrument, not a recreational game.

The name "DOPE" is a real long-range shooting term: **Data On Previous Engagements** — the logged adjustments a shooter has verified through real-world firing. The UI reflects this vocabulary throughout.

---

## Color Philosophy

### Primary Red — `#FF2200` / `#FF3000`

The tactical red is the single most important design decision in the system. It serves three distinct purposes:

1. **Brand anchor** — immediately distinguishes RangeDOPE from every nature-green or sky-blue hunting app competitor
2. **Attention signal** — red values mean "this is the number you act on" (DIAL clicks, primary holdover)
3. **Night-vision compatible** — the `night-red` theme shifts all UI to deep reds (`#8B0000`, `#7A0000`) so the screen doesn't destroy dark-adapted vision in a predawn blind

### Background Darkness

The base background (`#0A0A0A`) is not pure black — it's chosen specifically because pure black (`#000000`) creates harsh contrast halos around bright text in dark environments. The near-black allows the red primary to appear to glow slightly without harsh edges.

### Three Themes

| Mode | Use case |
|---|---|
| **DAY** (default) | Normal light. Near-black bg, red primary, high-contrast white labels. |
| **BRIGHT** | Direct sunlight. Warm off-white bg, dark text, muted crimson primary. |
| **NIGHT-RED** | Predawn / post-sunset field use. Pure black, all UI rendered in deep reds. |

Theme switching is triggered by long-pressing the DIAL (turret click count) value in the Field HUD. The gesture is intentionally obscure — it's a power-user feature, not a setting buried in preferences.

---

## Typography

### Typeface: Space Mono

The **entire UI** — including data labels, section headers, navigation, and input fields — uses Space Mono. This is a deliberate, opinionated choice:

- Monospaced type means ballistic values **never shift horizontally as they update** (e.g., a dial count changing from `48` to `112` doesn't cause layout reflow)
- The military-instrument aesthetic is served by a font that reads like a radar display or a weapons system HUD
- Numbers are all the same width, making holdover tables and DOPE cards visually scannable as columns

On the web landing page, **Space Grotesk** is used for display headings (hero h1, feature card titles) and Space Mono is reserved for labels, badges, monospace data, and navigation — mirroring the app's role split.

### Type Hierarchy

The scale is intentionally compressed at the top end:

- **HUD Hero (42pt)**: DIAL turret click count. The one number the shooter reads at 1 meter while behind a rifle.
- **HUD Primary (28pt)**: HOLD and WIND hold values. Same distance, slightly secondary.
- **Display (22pt)**: Large computed values in shot plan panels.
- **Body inputs (14pt)**: Coordinate and elevation inputs.
- **Labels (9pt, letterSpacing: 1–2)**: Section headers, chip text, map toggle buttons. Always monospaced, always tracked wide.

Label text is **always uppercase with letter-spacing**. This is not stylistic — it's a legibility pattern from aviation instrument design where dense numeric displays need clear text hierarchy without bold or italic variation.

---

## Layout Patterns

### Field HUD

The Field HUD occupies the top 35–40% of the screen in portrait orientation. It uses a two-column grid for secondary metrics with the DIAL prominently centered above. A transparent glass-black panel (`rgba(0,0,0,0.65)`) sits over the live topographic map, giving the impression of a heads-up display over terrain.

The crosshair overlay — four 32dp red lines at 45% opacity that form an incomplete reticle around the screen center — reinforces the "looking through an optic" metaphor.

### Collapsible Data Panel

The shot plan data panel uses a bottom-sheet pattern with a drag handle. It collapses behind the map to give the user maximum tactical map visibility. The panel slides over the map; the map renders behind it at full size (not resized). This is critical — hunters often want to see terrain while still reading their data.

### Tactical Map Controls

Map UI controls are layered over the map using absolute positioning:
- **Style toggle bar** (top-right): `TOPO | LIDAR | 3D | SAT | VEC | OWN` — monospaced buttons on a dark glass pill
- **Offline download button** (top-left): Clears the MapLibre scale bar which anchors bottom-left
- **Map mode bar** (absolute bottom of map, not the screen): `🎯 SHOT PLAN | 📍 WAYPOINTS` — full-width, glass-black

---

## Iconography

RangeDOPE uses **Ionicons** for UI icons (trash, chevron, fingerprint, download) throughout the app — never decorative. Hunt waypoint types use **emoji** as map markers, chosen for:

- Zero asset management (no SVG/PNG files to maintain)
- Universal recognizability (🦌 = deer sighting needs no label)
- Rendering at map marker scale without aliasing

Waypoint types and their emoji:

| Type | Emoji | Color |
|---|---|---|
| SIGHTING | 👁 | `#FF3000` |
| TRACKS | 🦶 | `#C87941` |
| STAND | 🪑 | `#FF8C00` |
| GLASSING | 🔭 | `#00BFFF` |
| WATER | 💧 | `#29ABE2` |
| FOOD | 🌾 | `#7CB518` |
| MIGRATION | 🦌 | `#FFB300` |
| WAYPOINT | 📍 | `#E0E0E0` |

---

## Component Patterns

### Cards / Computed Sections

Data cards use a 1px border (`#2C2C2C`) instead of shadows. On a near-black background, shadows are invisible — borders provide the separation. Cards have `borderRadius: 10` and `padding: 14`.

### Chip / Tag Badges

Section-level category tags (e.g. "FIRST PRINCIPLES", "BLM OWNERSHIP") use:
- Background: `rgba(255,48,0,0.12)` — near-invisible red tint
- Border: `rgba(255,48,0,0.2)–0.3`
- Text: `#FF3000`, 9pt, letterSpacing 1.5, uppercase
- Radius: 4–6px (never pill — badges are not interactive)

### TextInput

Inputs use `borderWidth: 1.5` (not 1) because 1px borders on a dark background disappear. Font is `SpaceMono-Regular` at 14pt, same as data display, so coordinate values look continuous from typed to rendered.

### Bottom Sheets

The WaypointTypeSheet uses `borderTopLeftRadius: 16`, `borderTopRightRadius: 16` and `paddingBottom: 32` (iOS safe area compensation). Backdrop: `rgba(0,0,0,0.6)`. Animation: native slide-up.

---

## Web Landing Page

The landing page at `getrangedope.com` mirrors the app's design language translated to CSS:

- **Noise texture overlay**: SVG fractalNoise at 4% opacity adds grain that makes the flat black background feel tactile, not digital
- **Red glow radial gradient**: Behind the hero logo and in the CTA box corners — `radial-gradient(circle, rgba(255,48,0,0.06–0.08) 0%, transparent 70%)`
- **Feature grid**: 1px borders form the grid lines (not box-shadow, not card gaps) — like a military data table
- **Stats bar**: Full-bleed dark surface strip (`#101010`) separating hero from features — visual breath
- **Pulsing badge**: The "NOW IN BETA" hero badge has an animated `●` dot (opacity 1.0 → 0.3, 2s infinite) — the only animation on the page

---

## Design Anti-Patterns (What We Avoid)

- **No gradients in the app** (web landing uses minimal glows, app is flat)
- **No rounded corners > 12px on data cards** — this is an instrument, not a consumer app
- **No color-coded severity levels** beyond red/amber (green, yellow, orange traffic lights would feel gamified)
- **No decorative imagery** — the map IS the hero visual; no lifestyle photography
- **No system fonts in the mobile app** — Space Mono only, always
- **No dark-mode toggle** — the app has three precision modes, not a generic light/dark switch

---

## Accessibility Notes

- All `dim` text colors are validated at WCAG AA minimum (4.5:1 contrast ratio)
  - `#8A8A8A` on `#0A0A0A` = 5.9:1 ✓
  - `#666666` on `#FFFFFF` = 4.6:1 ✓
- Night-red mode intentionally does NOT meet WCAG contrast — it is designed for low-light field use where normal contrast would be harmful
- All interactive elements have `accessibilityLabel` props
- `hitSlop: 12` on all small icon-only touch targets
