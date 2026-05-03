/**
 * useEntitlement — RevenueCat entitlement hook for RangeDOPE.
 *
 * IMPORTANT: RevenueCat MUST be configured once at app startup before this
 * hook is used. Configuration lives in app/_layout.tsx via initRevenueCat().
 * This hook only reads customer info — it never calls Purchases.configure().
 *
 * Beta mode:
 *   EXPO_PUBLIC_PAYWALL_ENABLED=false → isPro is always true.
 *   This keeps all features unlocked for TestFlight testers.
 *   Flip to "true" when submitting to the App Store.
 *
 * Entitlement identifier in RevenueCat dashboard: "pro"
 * Product identifiers: aim_hunter_annual, aim_founders_lifetime
 */
import { useState, useEffect, useCallback } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────

const PAYWALL_ENABLED = process.env['EXPO_PUBLIC_PAYWALL_ENABLED'] === 'true';

export const PRODUCT_IDS = {
  // Must match the Identifier field in RevenueCat → Product Catalog → Products exactly.
  annual:   'yearly',           // The "Yearly" product you created in RC
  lifetime: 'founders',         // Create this in RC if you want the one-time Founders pass
} as const;

export type EntitlementState = {
  isPro: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  restore: () => Promise<void>;
  purchase: (productId: string) => Promise<boolean>;
};

// ─── Lazy RC accessor ─────────────────────────────────────────────────────────
// react-native-purchases is native — lazy require keeps Expo Go from crashing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function getRC(): AnyRecord | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as AnyRecord;
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function isProFromRC(): Promise<boolean> {
  const RC = getRC();
  if (!RC) return true; // Expo Go / simulator without native build — unlock
  const info = await RC.getCustomerInfo();
  const active = info?.entitlements?.active as Record<string, unknown> | undefined;
  return !!active?.['pro'];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEntitlement(): EntitlementState {
  // Beta / no-paywall mode: unlock everything without hitting RC
  const [isPro, setIsPro]     = useState(!PAYWALL_ENABLED);
  const [loading, setLoading] = useState(PAYWALL_ENABLED);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!PAYWALL_ENABLED) return;
    try {
      setLoading(true);
      setIsPro(await isProFromRC());
    } catch (e) {
      setError(String(e));
      setIsPro(true); // fail open during beta
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { refresh(); }, [refresh]);

  async function restore(): Promise<void> {
    const RC = getRC();
    if (!RC) return;
    try {
      setLoading(true);
      const info = await RC.restorePurchases();
      const active = info?.entitlements?.active as Record<string, unknown> | undefined;
      setIsPro(!!active?.['pro']);
    } finally {
      setLoading(false);
    }
  }

  async function purchase(productId: string): Promise<boolean> {
    const RC = getRC();
    if (!RC) return false;
    try {
      setLoading(true);
      const offerings = await RC.getOfferings();
      const pkg = offerings?.current?.availablePackages?.find(
        (p: AnyRecord) => p.product?.identifier === productId,
      );
      if (!pkg) throw new Error(`Product ${productId} not found in RC offerings.`);
      const result = await RC.purchasePackage(pkg);
      const active = result?.customerInfo?.entitlements?.active as Record<string, unknown> | undefined;
      const proNow = !!active?.['pro'];
      setIsPro(proNow);
      return proNow;
    } catch (e) {
      if (String(e).includes('UserCancelledError')) return false;
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { isPro, loading, error, refresh, restore, purchase };
}
