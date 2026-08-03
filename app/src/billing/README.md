# Billing (RevenueCat)

V1 uses **RevenueCat** (`react-native-purchases`), not `expo-in-app-purchases`.

| Item | Value |
|------|--------|
| Entitlement | `pro` |
| Annual product | `yearly` |
| Founders lifetime | `founders` |
| Beta unlock | `EXPO_PUBLIC_PAYWALL_ENABLED` ≠ `true` → all features free |
| Store submit | Set `EXPO_PUBLIC_PAYWALL_ENABLED=true` + RC API keys in EAS secrets |

Hook: `app/src/hooks/useEntitlement.ts`  
UI: `app/src/components/PaywallScreen.tsx`  
Init: `app/app/_layout.tsx` → `initRevenueCat()`

When paywall is enabled, entitlement refresh **fails closed** (no Pro on RC errors).
