# Spec: Shooter app importer

**Status:** Implemented (best-effort JSON / CSV)  
**Code:** `importShooterJSON`, `importShooterCSV` in `app/src/utils/importers.ts`

---

## Reality check

“Shooter” (York / Ballistic-style) exports vary by version. There is no single canonical public schema. This importer accepts common field names from community exports.

---

## JSON fields (aliases)

| Field | Maps to |
|-------|---------|
| `ProfileName` / `Name` / `name` | rifle name |
| `Cartridge` / `Caliber` / `caliber` | caliber |
| `BulletName` / `Bullet` | bullet |
| `BulletWeight` / `Weight` | grains |
| `BulletDiameter` / `Diameter` / `CaliberInches` | inches |
| `BC` / `BallisticCoefficient` | BC |
| `BCType` / `DragModel` (`G1`/`G7`) | drag |
| `MuzzleVelocity` / `MV` | fps |
| `ZeroRange` / `ZeroDistance` | yards |
| `SightHeight` / `ScopeHeight` | inches |

Case-insensitive key match after normalizing punctuation.

---

## CSV

Header row with any of the JSON aliases (normalized like Strelok). One profile per data row.

---

## Fixtures

`app/src/utils/importers.test.ts` — `shooter-json`, `shooter-csv`.
