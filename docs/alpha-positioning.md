# Closed alpha positioning (Rokslide / Hunt Talk)

**Audience:** Long-range hunters evaluating RangeDOPE vs Strelok / AB / Hornady.  
**Tone:** Hunting, ethical shot, on-device honesty. No military/tactical framing.

---

## One-liner

> RangeDOPE is an on-device ballistics + hunt-planning app for hunters. Closed alpha on TestFlight — solver validation is public; BLE and some importers are still soak-testing.

---

## What to claim

- On-device modified point-mass G1/G7 solver with published harness results (`/validation`)  
- Field Mode HUD, ShotPlan, Hunter WEZ (estimated probability — you are responsible)  
- Strelok / Hornady / AB-style JSON / Shooter-style import; QR profile handoff (integrity hash)  
- Offline-first maps + weather cache; no account required  

## What not to claim

- “Take the shot” / fire-control language  
- “Verified on every chronograph” — BLE protocols are **unverified** until hardware soak  
- Full AB CDM library parity  
- App Store public launch (until paywall + products are live)  

---

## Suggested forum first post

```
Closed alpha — looking for hunters who already run a chrono and a Kestrel.

RangeDOPE is zero-backend: profiles, DOPE, and solutions stay on your phone.
Public solver validation: rangedope.com/validation

Honest gaps: Garmin/Kestrel BLE still needs hardware confirmation; AB Quantum
QR is proprietary so we take flexible JSON instead.

DM for TestFlight. Feedback on Field Mode with gloves on is gold.
```

---

## Env for alpha builds

```
EXPO_PUBLIC_PAYWALL_ENABLED=false
EXPO_PUBLIC_RC_APPLE_KEY=…   # optional until store submit
EXPO_PUBLIC_RC_GOOGLE_KEY=…
```

Flip `EXPO_PUBLIC_PAYWALL_ENABLED=true` only when RevenueCat products `yearly` / `founders` and entitlement `pro` are live in App Store Connect / Play Console.
