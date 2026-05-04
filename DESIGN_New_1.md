---
name: Mountain West Tactical
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#37393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#e9bcb3'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#af877f'
  outline-variant: '#5e3f38'
  surface-tint: '#ffb4a4'
  primary: '#ffb4a4'
  on-primary: '#640d00'
  primary-container: '#ff5634'
  on-primary-container: '#580a00'
  inverse-primary: '#b82000'
  secondary: '#c9c6c5'
  on-secondary: '#313030'
  secondary-container: '#474646'
  on-secondary-container: '#b7b4b4'
  tertiary: '#c8c6c5'
  on-tertiary: '#313030'
  tertiary-container: '#929090'
  on-tertiary-container: '#2a2a2a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad3'
  primary-fixed-dim: '#ffb4a4'
  on-primary-fixed: '#3e0500'
  on-primary-fixed-variant: '#8d1600'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c9c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  data-mono:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  legal-sm:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.02em
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max: 1280px
  grid-cols: '12'
---

## Brand & Style

The design system is engineered for high-stakes environments where precision and reliability are non-negotiable. It targets professional marksmen, backcountry hunters, and ballistic technicians who require tools that feel like extensions of their hardware. 

The aesthetic style is **Tactical Minimalism** blended with **High-Tech Instrumentation**. It avoids unnecessary decoration, focusing instead on structural integrity, data density, and immediate legibility under harsh lighting conditions. The visual language utilizes technical overlays and grid-based compositions to evoke the feeling of looking through a high-end optic or a ruggedized field tablet.

## Colors

The palette is strictly functional, optimized for "night mode" field use to preserve the user's natural night vision while highlighting critical data points.

- **Obsidian Core:** The primary background is #080808, providing a deep, non-reflective base that minimizes screen glare.
- **Safety Red:** The #FF3000 accent is used sparingly for primary actions, critical alerts, and crosshair elements. It symbolizes the "safety-off" state and high-priority focus.
- **Carbon Layers:** Mid-tones (1A1A1A) are used for UI shielding and container separation, mimicking the matte finish of anodized aluminum and carbon fiber.
- **Stark White:** Typography uses pure #FFFFFF to ensure the highest possible contrast ratio for rapid data acquisition.

## Typography

This design system utilizes two distinct typefaces to separate narrative content from technical data.

- **Space Grotesk** is the primary typeface for headlines and body copy. Its geometric structure feels modern and engineered, while maintaining high legibility at various scales.
- **Space Mono** is reserved for UI labels, coordinates, ballistic tables, and sensor data. The fixed-width character set ensures that columns of numbers remain perfectly aligned, critical for reading DOPE (Data Observed Prior Engagements) tables.
- **Styling Note:** All labels should be rendered in uppercase with increased letter spacing to mimic military-spec equipment markings.

## Layout & Spacing

The layout is built on a **Strict Fixed Grid** of 12 columns. Every element must align to a 4px baseline shift to maintain mathematical precision.

- **The Reticle Overlay:** Use a global background grid overlay with 32px squares at 5% opacity. In hero sections, center a subtle "crosshair" graphic that intersects at the primary focal point.
- **Data Density:** In tool-heavy views, padding is tightened to maximize the information displayed on one screen, reducing the need for scrolling in the field.
- **Margins:** External page margins are generous (24px+) to prevent UI elements from being obscured by rugged phone case lips or handheld grips.

## Elevation & Depth

In this design system, depth is communicated through **structural layering** rather than traditional shadows.

- **Tonal Stepping:** Instead of shadows, surfaces are "elevated" by changing the background color from #080808 (base) to #121212 (raised container).
- **Border Enclosures:** All containers use a 1px solid border (#FFFFFF at 10% opacity) to define their footprint.
- **The "Safety Glow":** Primary action elements (like the 'Calculate' button) utilize a soft, 8px outer glow using the primary #FF3000 color at 30% opacity to simulate illuminated cockpit instrumentation.
- **Topographic Textures:** Backgrounds for hero sections or empty states feature subtle topographic line-work (#FFFFFF at 3% opacity) to provide a sense of scale and terrain.

## Shapes

The shape language is **aggressive and architectural**. 

- **Hard Edges:** All buttons, cards, and input fields utilize 0px border radius. This conveys a "milled from billet" feel, echoing the hard lines of firearm receivers and tactical gear.
- **Angled Accents:** Use 45-degree chamfered corners on "Technical Tags" and decorative frame elements to reinforce the tactical aesthetic.

## Components

### Buttons
- **Primary:** Solid #FF3000 background, white text, 0px radius. Includes a subtle "pulse" or glow effect.
- **Secondary:** Transparent background, 1px white border (#FFFFFF), white text.
- **Ghost:** Monospaced text with a bracketed prefix, e.g., `[ VIEW MAP ]`.

### Technical Tags
- Small, rectangular badges with a #1A1A1A background and 1px border. 
- Use `label-caps` typography. 
- Example: `[ RANGE: 800YD ]` or `[ WIND: 5MPH ]`.

### Feature Grids
- Use 1px borders to separate grid items (resembling a spreadsheet or technical manual).
- Each cell features a `label-caps` header in the top-left and the data/description in the bottom-right.

### Input Fields
- Underlined style only (no full box) or a fully enclosed box with 0px radius. 
- Focused state changes the border/underline to #FF3000. 
- Use Space Mono for input text to ensure numerical clarity.

### Legal & Footers
- Set in `legal-sm` typography. 
- Layout should be structured in columns with clear, monospaced headers to look like a hardware specification sheet.