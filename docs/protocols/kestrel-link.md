# Protocol notes: Kestrel 5x00 / 5700 LiNK

**Hardware verification status:** UNVERIFIED.  
LiNK application protocol is proprietary (NK / Kestrel Instruments). Full command set is **not** publicly documented for third-party apps.

---

## Assumptions

1. LiNK meters advertise BLE names containing `Kestrel` (and often model digits, e.g. `Kestrel 5700`).  
2. Some units may also expose Bluetooth SIG **Environmental Sensing** (`0x181A`) characteristics — if present we read them as a best-effort path.  
3. Full LiNK live stream (wind + station pressure + ballistics fields) likely requires reverse-engineered proprietary characteristics or an official partnership. Until then:  
   - Discover + connect + report status  
   - Parse ESS when available  
   - Otherwise show `connected · protocol pending` and keep AtmoInput as the fallback  

---

## ESS parse (when characteristic present)

| Characteristic | UUID | Units we convert to |
|----------------|------|---------------------|
| Temperature | `0x2A6E` | °F (from 0.01 °C) |
| Humidity | `0x2A6F` | % RH (0.01 %) |
| Pressure | `0x2A6D` | inHg (from 0.1 Pa) |

Station pressure vs sea-level: ESS Pressure is absolute; we treat it as **station** pressure for the solver (Claude.md weather convention). Confirm against Kestrel display on hardware.

---

## Wind

ESS does not define a standard wind-speed characteristic used by Kestrel. Wind from LiNK remains deferred — WindInput stays authoritative until proprietary parse lands.

---

## References

- Kestrel 5 Series user guide (LiNK = Bluetooth Smart; app/dongle ecosystem)  
- Bluetooth SIG Environmental Sensing Service  
