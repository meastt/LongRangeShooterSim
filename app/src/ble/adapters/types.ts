import type { BleTransport } from '../transport';
import type { BleAdapterMatch, BleReading, ScannedPeripheral } from '../types';

export type BleAdapter = {
  readonly id: string;
  readonly shortLabel: string;
  match: (peripheral: ScannedPeripheral) => BleAdapterMatch | null;
  /**
   * After GATT connect — subscribe / handshake.
   * Returns a cleanup function.
   */
  onConnected: (
    transport: BleTransport,
    deviceId: string,
    onReading: (reading: BleReading) => void,
    onDetail: (detail: string) => void,
  ) => Promise<() => void>;
};
