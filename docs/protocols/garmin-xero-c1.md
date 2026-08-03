# Protocol notes: Garmin Xero C1 / C1 Pro

**Hardware verification status:** UNVERIFIED — no C1 Pro soak in-house yet.  
**Do not claim “supported” in store copy until a hunter confirms live MV against known chrono.**

---

## Assumptions (surface explicitly)

1. C1 / C1 Pro use Garmin **MultiLink** BLE (same UUID family as other modern Garmin peripherals), not a simple open GATT velocity characteristic.  
2. MultiLink service UUID pattern matches community R10 / Gadgetbridge docs:  
   `6A4E[XXXX]-667B-11E3-949A-0800200C9A66`  
3. Channel characteristics:  
   - Service `…2800`  
   - Notify/write `…2810` (REGISTER + inbound)  
   - Write `…2820` (outbound, handle-prefixed)  
4. Shot velocity arrives as a GFDI / Fit-style payload after service registration; exact protobuf field IDs for C1 Pro are **unknown** until captured with a BLE sniffer or Garmin SDK partnership.  
5. Until the GFDI shot message is decoded, the adapter also accepts a **dev fixture characteristic path** and a pure parser for a provisional LE velocity frame used only in unit tests / mock transport.

---

## Advertisement heuristics

| Signal | Match |
|--------|-------|
| Local name contains | `Xero`, `XERO`, `C1 Pro`, `C1` (case-insensitive) |
| Preferred | Name starts with `Xero` |

False positives possible (other Garmin Xero optics). Adapter must confirm MultiLink service after connect.

---

## MultiLink REGISTER (community)

13-byte REGISTER write to `2810` (from public R10 / MultiLink notes — **assume until sniffed on C1**):

```
[0x00, 0x01, client_uuid×8, service_id_lo, service_id_hi, 0x00]
```

Reply on notify: success includes assigned `handle` byte. All subsequent writes to `2820` and notifies on `2810` are handle-prefixed.

References:

- Gadgetbridge Garmin MultiLink notes  
- Community R10 WIRE.md (MultiLink UUID table)  
- Garmin Xero C1 Pro owner’s manual (pairing via Garmin app — does not document GATT)

---

## Provisional velocity frame (test / mock only)

Until GFDI is decoded, mock transport emits:

```
bytes: [0x56, 0x45, fps_lo, fps_hi]   // 'V','E' + uint16 LE fps
```

Parser: `parseProvisionalVelocityFrame`. Production path must replace this with sniffed GFDI once available.

---

## Privacy / liability

- Chronograph MV is hunter-owned DOPE. Never include in crash reports.  
- Auto-apply to load is forbidden; Field UI must confirm.  
