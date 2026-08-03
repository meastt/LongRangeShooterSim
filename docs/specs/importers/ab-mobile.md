# Spec: Applied Ballistics Mobile / Quantum importer

**Status:** Implemented (best-effort JSON)  
**Code:** `importABMobileJSON` in `app/src/utils/importers.ts`

---

## Reality check

AB Quantum’s primary handoff is a **proprietary QR**, not a public JSON schema. There is no official third-party export format.

This importer accepts **community / manual JSON** that hunters (or older AB Mobile backups) may produce, plus a flat object with common AB-like field names. It does **not** decode AB Quantum QR bitstreams.

Hunters switching from AB should prefer:

1. Re-enter critical fields (MV, BC/CDM note, zero), or  
2. Export whatever JSON/text they can gather into the flexible schema below.

---

## Accepted shapes

### Flat object

| Field (aliases) | Maps to |
|-----------------|---------|
| `rifleName` / `gunName` / `name` / `profileName` | rifle name |
| `cartridge` / `caliber` / `ammo` | caliber |
| `bulletName` / `bullet` / `projectile` | bullet name |
| `bulletWeight` / `weight` / `weightGrains` | grains |
| `bulletDiameter` / `diameter` / `caliberInches` | inches |
| `bc` / `g7Bc` / `g1Bc` / `ballisticCoefficient` | BC |
| `dragFunction` / `dragModel` / `bcType` (`G1`/`G7`) | drag |
| `muzzleVelocity` / `mv` / `muzzleVelocityFps` | fps |
| `zeroRange` / `zeroDistance` | yards |
| `sightHeight` / `scopeHeight` | inches |

Nested `bullet: { … }` is flattened before lookup.

### Array wrapper

`{ "profiles": [ … ] }` or a top-level array — each element parsed.

---

## Edge cases

- Missing BC + CDM-only profiles → reject row (we do not invent BC).  
- Diameter given in mm → if value > 1, divide by 25.4.  
- Empty file → throw / return [].  

---

## Fixtures

See `app/src/utils/importers.test.ts` — `ab-flat` and `ab-nested`.
