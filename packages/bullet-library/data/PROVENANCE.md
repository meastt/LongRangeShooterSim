# Provenance

Every entry in `data/*.json` traces to a manufacturer-published source recorded on the
entry itself (`sourceUrl` + `retrievedAt`). This file records, per manufacturer, which
page(s)/document(s) were used as the primary source and when they were retrieved. See
`DISCREPANCIES.md` for the independent second-source cross-check and every judgment
call made while building the dataset.

Total entries: **619** across 8 data files (7 manufacturers + rimfire).

## Berger — 106 entries

- Primary source: https://bergerbullets.com/information/lines-and-designs/all-berger-bullets/
  (manufacturer product-line web table), retrieved 2026-07-27.
- Lines covered: Varmint (FB Varmint, High BC FB Varmint), Hunting (VLD Hunting, Classic
  Hunter, Elite Hunter, EOL Elite Hunter), Target/Tactical (OTM Tactical, Juggernaut OTM
  Tactical, Hybrid OTM Tactical, AR Hybrid OTM Tactical), and ELR Match Solid.
- One entry (`berger-elr-match-solid-0.375-407`, part 37407) was verified but omitted —
  see DISCREPANCIES.md.

## Sierra — 158 entries

- Primary source: https://sierrabullets.com/bullets/ (manufacturer storefront, `customFields`
  data pulled via the site's own BigCommerce GraphQL API — the same data that renders in
  each product's spec tab), retrieved 2026-07-27.
- Lines covered: VarmintKing, Tipped VarmintKing, MatchKing, Tipped MatchKing,
  MatchKing-X, GameKing, Tipped GameKing, Pro-Hunter, Full Metal Jacket variants within
  caliber range .172–.375.
- 18 duplicate packaging/cannelure variants (identical family/diameter/weight/BC) were
  dropped during dedup; the surviving entry keeps the base SKU.

## Nosler — 153 entries

- Primary source: 2026 Nosler Product Guide PDF,
  https://www.nosler.com/media/binaryanvil/media_library/2026-Catalog-Layout_Web.pdf,
  retrieved 2026-07-27.
- Lines covered: Partition, AccuBond, AccuBond Long Range, Ballistic Tip Hunting,
  Ballistic Silvertip, E-Tip, RDF, Custom Competition.

## Hornady — 49 entries

- Primary source: https://www.hornady.com/bc (Hornady's own published BC table; values
  are the manufacturer's Mach 2.25 "200-yard" reference figures), retrieved 2026-07-27.
- Lines covered: ELD Match, ELD-X, A-Tip Match, ELD-VT.
- Hornady's other bullet lines (V-Max, SST, InterLock, GMX, CX, etc.) are **not**
  included — out of scope for this initial pass, not omitted for data-quality reasons.

## Federal — 24 entries

- Primary source: https://www.federalpremium.com/reloading/bullets/ (manufacturer
  component-bullet spec pages), retrieved 2026-07-27.
- Lines covered: Terminal Ascent, Fusion, Trophy Bonded Tip, Trophy Bonded Bear Claw,
  Trophy Bonded Sledgehammer Solid.

## Lapua — 18 entries

- Primary source: 2026 Lapua Catalog PDF,
  https://www.lapua.com/wp-content/uploads/2026/06/Lapua_Catalog_2026_ENG_web.pdf,
  retrieved 2026-07-27, supplemented by two individual product pages (Scenar-L GB544 /
  GB545) on lapua.com for entries not itemized in the catalog table.
- Lines covered: Scenar, Scenar-L, Naturalis, Mega, FMJ.

## Barnes — 105 entries

- Primary source: https://barnesbullets.com/bullets/ (manufacturer storefront,
  `customFields` data pulled via the site's own BigCommerce GraphQL API), retrieved
  2026-07-27.
- Lines covered: TSX, TTSX, LRX, Match Burner, Varminator, within caliber range
  .204–.338.
- One row (SKU 32472, 25 Cal 117gr LRX BT) had its weight corrected from a GraphQL
  field-ordering artifact — see DISCREPANCIES.md.

## Rimfire — 6 entries

- CCI Standard Velocity: https://www.cci-ammunition.com/rimfire/cci/standard-velocity/6-35.html
- SK Standard Plus / SK Rifle Match: https://sk-ammunition.com/wp-content/uploads/2022/02/SK_TrajectoryChart_2022.png
- Lapua Center-X / Lapua Midas+: https://www.lapua.com/wp-content/uploads/2026/06/Lapua_Catalog_2026_ENG_web.pdf
- Eley Tenex: https://eley.co.uk/eley-tenex/
- All retrieved 2026-07-27. Rimfire is loaded ammunition (bought, not handloaded), so
  each entry carries `nominalMuzzleVelocityFps` from the manufacturer's own published
  spec instead of a handload MV.
- CCI does not publish a BC for Standard Velocity 40gr LRN; `g1Bc`/`g7Bc` are `null` by
  design rather than estimated (see DISCREPANCIES.md).

## Access note

Barnes' and Sierra's storefronts require confirming an "are you 18+" age-gate modal
before the product spec tabs (and the underlying GraphQL data) become available. The
user explicitly authorized confirming this modal for research purposes (2026-07-27,
mid-session). Cookie/consent banners on all sites were declined/rejected-all per
standing privacy default.
