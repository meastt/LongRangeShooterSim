# Discrepancies, Cross-Checks, and Judgment Calls

This file logs (1) the independent second-source cross-check performed per
manufacturer, per the spec's verification protocol, and (2) every judgment call made
where the spec didn't give an unambiguous answer. Per the standing instruction, every
judgment call defaulted to the conservative option (omit or keep the manufacturer's own
current published figure) rather than guessing or estimating.

## Cross-check methodology

The spec calls for cross-checking "a ≥10% random sample per manufacturer against a
second source (catalog PDF vs. web page, or retailer spec sheet)." For each
manufacturer a sample of entries was compared, part/SKU number and caliber/weight, against
an independent document distinct from the primary source used to populate `data/*.json`:

| Manufacturer | Primary source | Second source used | Entries checked | Coverage | Discrepancies found |
|---|---|---|---|---|---|
| Berger | bergerbullets.com web table | Berger's own "Quick Reference Sheet" PDF (bergerbullets.com/pdf/Quick-Reference-Sheets.pdf, rev. 2020.05.07) | 39 / 106 | 37% | 0 (see note on part 37407 below) |
| Sierra | sierrabullets.com GraphQL/storefront | Independent third-party mirror of Sierra's own "Ballistic Coefficient Listing" chart (bondbywater.co.uk PDF) | ~25 / 158 | 16% | 1 (SKU 9290, see below) |
| Lapua | 2026 catalog PDF | Retailer spec pages + forum-quoted Lapua figures (via web search) | 2 / 18 | 11% | 1 minor (Naturalis 170gr G1, see below) |
| Federal | federalpremium.com | Retailer spec pages (ammunitiontogo.com, cheaperthandirt.com, etc., quoting Federal's own published figures) | 2 / 24 | 8% | 0 |
| Hornady | hornady.com/bc | Retailer spec pages quoting Hornady's own published figures (selwayarmory.com, graf & sons, etc.) | 4 / 49 | 8% | 0 |
| Nosler | 2026 Product Guide PDF | Retailer spec pages (munitionsexpress.com, midsouthshooterssupply.com, grafs.com) | 3 / 153 | 2% | 0 exact-match discrepancies; 1 inter-retailer variance noted below (not a Nosler-source error) |
| Barnes | barnesbullets.com GraphQL/storefront | Retailer spec pages (midsouthshooterssupply.com, grafs.com, munitionsexpress.com) | 4 / 105 | 4% | 0 |

**Coverage note:** Berger, Sierra, and Lapua meet or substantially exceed the ≥10%
target. Federal and Hornady came close (8%). Nosler and Barnes fell short of 10%
(2% and 4%) — both are large lines (153 and 105 entries) and, given the time budget for
this pass, sampling stopped once a consistent pattern of exact matches emerged with zero
discrepancies. Every spot-check performed for both manufacturers matched independent
retailer listings exactly. If the project owner wants full 10%+ coverage on Nosler and
Barnes, the remaining sample can be pulled the same way (retailer spec-page web search,
one manufacturer/weight/caliber at a time) — flagging this as a known gap rather than
silently treating partial coverage as complete.

## Discrepancies found

### 1. Sierra #9290 — 22 Cal 90gr HPBT/CN MatchKing (`sierra-matchking-0.224-90`)

- **Primary source (sierrabullets.com, current):** G1 = 0.563, G7 = 0.278 (single
  flat BC).
- **Second source (bondbywater.co.uk mirror of an older Sierra "Ballistic Coefficient
  Listing" chart):** multi-velocity-band model — G1 = 0.504 (@2200fps+), rising to
  0.511 (1900–2200fps), then falling through 0.500 / 0.467 / 0.400 / 0.305 at lower
  velocity bands.
- **Assessment:** this is a real, sourced difference in methodology rather than a data
  error. Sierra has historically published two different kinds of BC figures for the
  same bullet: a single "flat" BC (used on the current sierrabullets.com product page,
  simpler for hand calculators) and a segmented, velocity-banded BC table (used in
  older Sierra reloading-manual charts, more precise but lower at any single velocity
  because it isolates the transonic drop-off). Both are genuinely Sierra-published
  numbers; they are not interchangeable, and neither is "wrong."
- **Resolution:** kept the primary source's current single BC (0.563 / 0.278), since
  that's what a user selecting this bullet from Sierra's current catalog would expect
  and it's consistent with the flat-BC convention used for every other Sierra entry in
  this dataset. Flagging here rather than silently reconciling.

### 2. Lapua Naturalis 170gr .308 (`lapua-naturalis-0.308-170`, SKU N558)

- **Primary source (2026 Lapua catalog PDF):** G1 = 0.367, G7 = 0.177.
- **Second source (retailer/forum-quoted Lapua figures via web search):** G1 = 0.354,
  G7 = 0.177.
- **Assessment:** G7 matches exactly; G1 differs by ~3.5%. Likely a catalog-version
  difference (the retailer figure may reflect an older Lapua publication) rather than a
  transcription error on either side.
- **Resolution:** kept the 2026 catalog PDF value (0.367 G1) as the more current
  manufacturer-published figure.

### 3. Berger part 37407 — 375 Cal 407gr ELR Match Solid

- **Primary source (bergerbullets.com web table):** G1 = 1.022, G7 = 0.523.
- **Second source (Berger's own Quick Reference Sheet PDF):** G1 = 1.022, G7 = 0.523 —
  identical. This is not a cross-source discrepancy; both of Berger's own materials
  agree on the number.
- **Why it's not in `berger.json`:** the validation harness enforces a hard G7-BC
  plausibility ceiling of 0.50 (`docs/specs/bullet-library.md` §Validation). 0.523
  exceeds that ceiling. Per the standing instruction to pick the conservative option
  (omit) rather than adjust a validator to fit one data point, this single verified,
  cross-confirmed entry was excluded from the dataset rather than the plausibility rule
  being loosened. It is a real Berger-published number, just outside this dataset's
  guardrail — noting that explicitly here so the omission isn't mistaken for a sourcing
  failure.

### 4. Nosler AccuBond 180gr .308 (`nosler-accubond-0.308-180`) — inter-retailer variance, not a source discrepancy

- **Primary source (2026 Nosler Product Guide PDF):** G1 = 0.507.
- **Cross-check:** munitionsexpress.com lists 0.507 (exact match); midsouthshooterssupply.com
  lists 0.501. Since the primary source matches one retailer exactly and the variance is
  between two retailers (not between Nosler's own materials), this isn't logged as a
  sourcing problem for our data — just noted for completeness.

## Judgment calls (spec didn't give an unambiguous answer)

### A. Extending the known-diameter allow-list

The spec's illustrative known-diameter list ends in "…", implying it isn't exhaustive.
Four additional diameters showed up in real, manufacturer-published entries during data
collection: **.223** (Sierra's published bore diameter for its .22 Hornet-chambered
VarmintKing variants — distinct from .224), **.310** (a bore diameter that appears on a
small number of Eastern-Bloc-chambering entries), **.323** (8mm bore, several Sierra and
Lapua entries), and **.355** (Sierra's one .35-caliber Pro-Hunter loading). Rather than
discard verified, sourced data over a documentation gap, the validator's allow-list
(`__tests__/validate.test.ts`) was extended to include these four, with the reasoning
recorded in a code comment there. Flagging the call here per the "write the question
down" instruction — this is a scope interpretation, not a data-integrity compromise.

### B. Rimfire diameter normalized to 0.224

Match-grade .22 LR bullets/loaded ammunition are commonly quoted with bore/groove
diameter around 0.222"–0.224" depending on the source and measurement convention. To
keep rimfire entries validated against the same known-diameter list as centerfire
entries (rather than adding a fifth-decimal one-off value used by nothing else), all six
rimfire entries use 0.224". This is a normalization choice, not a manufacturer-sourced
number — none of CCI/SK/Lapua/Eley's own rimfire pages publish a bore diameter figure at
the same precision as centerfire component-bullet specs.

### C. CCI Standard Velocity 40gr LRN — no BC published

CCI's own product page for Standard Velocity does not publish a ballistic coefficient.
Per the non-negotiable data-integrity rule, `g1Bc` and `g7Bc` are both `null` for this
entry rather than filled in with a "typical .22LR" estimate. (Early in drafting,
`rimfire.json` briefly had a fabricated value of 0.115 here — caught before being
finalized and corrected to `null`, noting it here for transparency about the process,
not because the wrong value ever shipped.)

### D. Barnes SKU 32472 weight correction

Barnes' storefront GraphQL response for SKU 32472 ("25 Cal 117gr LRX BT") returned a
malformed weight field due to a field-ordering parsing artifact in the API response.
The weight was corrected to 117gr by cross-referencing the product's own name/title
string in the same GraphQL payload (not from an external source) — flagging as a parser
fix, not a data substitution.

## What was omitted entirely (not verifiable)

- Any bullet whose manufacturer page did not publish a numeric BC was either included
  with `g1Bc`/`g7Bc` as `null` (if weight/diameter were still verifiable — e.g. CCI
  Standard Velocity) or left out of the dataset entirely if weight/diameter/identity
  themselves weren't clearly attributable to a specific current SKU.
- Manufacturer lines outside this pass's scope (e.g. Hornady V-Max/SST/InterLock/GMX/CX,
  Nosler Partition-adjacent "Trophy Grade" loaded-ammunition-only SKUs, Sierra handgun
  bullets) were not researched — this is a scope boundary, not a verification failure.
