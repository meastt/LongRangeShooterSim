/**
 * Generic rangefinder discovery stub.
 * Protocol: docs/protocols/rangefinder-readonly.md
 */
import type { BleAdapter } from './types';

const NAME_HINTS = ['sig', 'bdx', 'leica', 'crf', 'vortex', 'razor', 'ranger', 'rangefinder'];

function nameLooksLikeRangefinder(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return NAME_HINTS.some((h) => n.includes(h));
}

export const rangefinderGenericAdapter: BleAdapter = {
  id: 'rangefinder-generic',
  shortLabel: 'RF',

  match(peripheral) {
    if (!nameLooksLikeRangefinder(peripheral.name)) return null;
    return {
      adapterId: this.id,
      role: 'rangefinder',
      shortLabel: this.shortLabel,
    };
  },

  async onConnected(_transport, _deviceId, _onReading, onDetail) {
    // Vendor GATT parsers land after sniffer capture — status only for now.
    onDetail('connected · range pending');
    return () => undefined;
  },
};
