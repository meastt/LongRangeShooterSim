import type { BleAdapter } from './types';
import { garminXeroC1Adapter } from './garmin-xero-c1';
import { kestrelLinkAdapter } from './kestrel-link';
import { rangefinderGenericAdapter } from './rangefinder-generic';
import type { BleAdapterMatch, ScannedPeripheral } from '../types';

/** Priority order — first match wins. */
export const BLE_ADAPTERS: readonly BleAdapter[] = [
  garminXeroC1Adapter,
  kestrelLinkAdapter,
  rangefinderGenericAdapter,
];

export function matchAdapter(peripheral: ScannedPeripheral): BleAdapterMatch | null {
  for (const adapter of BLE_ADAPTERS) {
    const m = adapter.match(peripheral);
    if (m) return m;
  }
  return null;
}

export function getAdapter(adapterId: string): BleAdapter | undefined {
  return BLE_ADAPTERS.find((a) => a.id === adapterId);
}
