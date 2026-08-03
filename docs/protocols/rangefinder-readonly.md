# Protocol notes: rangefinder read-only (Sig / Leica / Vortex)

**Hardware verification status:** STUB — discovery + status only.

---

## Scope

Read-only range ingest into Field Mode `rangeYards`. No write-back to the optic. No “fire control” language in UI (hunting copy only).

---

## Assumptions

1. Vendor BLE stacks differ (Sig BDX, Leica .COM, Vortex). No single GATT is reliable without per-device capture.  
2. V1 ships a **generic rangefinder adapter** that:  
   - Matches advertised names (`SIG`, `BDX`, `Leica`, `CRF`, `Vortex`, `Razor`, `Ranger`)  
   - Connects and reports `connected · range pending`  
   - Accepts a provisional LE range frame from mock transport for tests  
3. Real parsers land one vendor at a time after sniffer capture + hunter verification.

---

## Provisional range frame (mock / test)

```
bytes: [0x52, 0x47, yd_lo, yd_hi]   // 'R','G' + uint16 LE yards
```

---

## Liability

Range from optic is advisory. Hunter confirms before dialing. App never says “take the shot.”  
