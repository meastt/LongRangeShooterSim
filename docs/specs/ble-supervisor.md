# Spec: BLE supervisor

**Status:** Implemented (Phase 3 scaffolding — hardware soak pending)  
**Package:** `app/src/ble`  
**Stack:** `react-native-ble-plx` ≥ 3.5.1 (Expo config plugin; requires dev client / EAS Build — not Expo Go)

---

## 1. Goal

One supervisor owns all BLE state. Adapters parse vendor payloads. Field Mode shows a status strip for every tracked device. Manual entry remains the always-available fallback (Wind / Atmo / Range chips never require BLE).

Day-1 targets (priority):

1. Garmin Xero C1 / C1 Pro chronograph → muzzle velocity samples  
2. Kestrel 5x00 / 5700 LiNK → live atmosphere  
3. Rangefinder read-only (Sig / Leica / Vortex) → range yards when protocol known  

---

## 2. Architecture

```
BleTransport (interface)
    ├── BlePlxTransport   // react-native-ble-plx (native)
    └── NullTransport     // web / Expo Go / tests

BleSupervisor (singleton Zustand)
    ├── scan / stop / connect / disconnect / reconnect
    ├── adapter registry
    └── deviceStatuses[] + lastReading by role

Adapters (pure parse + connect hooks)
    ├── garmin-xero-c1
    ├── kestrel-link
    └── rangefinder-generic
```

**Invariant:** Parser functions are pure TypeScript with no RN imports — unit-tested with fixtures. Handshake assumptions are documented in `docs/protocols/*` and must be verified on hardware before claiming support.

---

## 3. Device status model

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | BLE peripheral id |
| `name` | string | Advertised name |
| `role` | `chrono` \| `meter` \| `rangefinder` | |
| `adapterId` | string | Registry key |
| `state` | see below | |
| `lastSeenAt` | epoch ms \| null | |
| `lastError` | string \| null | Hunter-readable |
| `detail` | string \| null | e.g. `2910 fps` |

States: `off` · `unauthorized` · `powered_off` · `idle` · `scanning` · `connecting` · `connected` · `error`

---

## 4. Readings → app

| Role | Reading | App effect |
|------|---------|------------|
| Chrono | `mvFps` | Offer to update active load MV (hunter confirms) |
| Meter | temp / pressure / RH / wind | Set `atmosphericOverride` + optional wind |
| Rangefinder | `rangeYards` | Set `rangeYards` in field store |

No reading is applied silently without UI feedback. Chrono MV never overwrites a load without an explicit APPLY.

---

## 5. Field Mode UX

- Status strip at the **top of every field screen** (Claude.md Field Mode rule 7).  
- Touch targets ≥ 56×56 dp for scan / connect actions.  
- Strip shows: adapter short label + state colour + last detail.  
- Tap strip → Devices panel (scan + connect list).  
- No animation beyond essential feedback.

---

## 6. Permissions

- iOS: `NSBluetoothAlwaysUsageDescription` via ble-plx config plugin.  
- Android: BLUETOOTH_SCAN / BLUETOOTH_CONNECT (API 31+) via plugin; location only if required by OS for scan.  
- Denied permission → strip shows `unauthorized`; manual entry unchanged.

---

## 7. Test fixtures

| Test | Expectation |
|------|-------------|
| MultiLink REGISTER reply parse | Extracts handle byte |
| Chrono velocity LE u16 | fps within 1 |
| ESS atmosphere bytes | °F / inHg / RH match fixture |
| NullTransport scan | No throw; statuses stay idle |
| Supervisor apply chrono | Pending MV set; load untouched until APPLY |

---

## 8. Non-goals (this slice)

- Background BLE while app killed  
- Garmin Connect pairing UX clone  
- Full proprietary Kestrel LiNK command set without hardware capture  
- Claiming “verified on device” before hardware soak  

---

## 9. References

- `docs/protocols/garmin-xero-c1.md`  
- `docs/protocols/kestrel-link.md`  
- `docs/protocols/rangefinder-readonly.md`  
- Claude.md — BLE common tasks + Field Mode status strip rule  
