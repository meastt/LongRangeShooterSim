/**
 * Garmin Xero C1 / C1 Pro chronograph adapter.
 * Protocol assumptions: docs/protocols/garmin-xero-c1.md
 */
import type { BleAdapter } from './types';
import {
  GARMIN_ML_NOTIFY,
  GARMIN_ML_SERVICE,
  GARMIN_ML_WRITE,
  base64ToBytes,
  buildMultilinkRegister,
  bytesToBase64,
  parseMultilinkRegisterReply,
  parseProvisionalVelocityFrame,
  stripHandlePrefix,
} from '../parsers/garmin';

function nameLooksLikeXero(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('xero') || n.includes('c1 pro') || /\bc1\b/.test(n);
}

export const garminXeroC1Adapter: BleAdapter = {
  id: 'garmin-xero-c1',
  shortLabel: 'XERO',

  match(peripheral) {
    if (!nameLooksLikeXero(peripheral.name)) return null;
    return {
      adapterId: this.id,
      role: 'chrono',
      shortLabel: this.shortLabel,
    };
  },

  async onConnected(transport, deviceId, onReading, onDetail) {
    const services = await transport.discoverServices(deviceId);
    const hasMl = services.some((u) => u.includes('6a4e2800'));

    if (!hasMl) {
      onDetail('no MultiLink — protocol pending');
      // Still monitor nothing; hunter can use manual MV.
      return () => undefined;
    }

    onDetail('handshaking…');

    // Fixed client UUID for Aim (8 bytes) — ASSUMPTION per MultiLink notes.
    const clientUuid = new Uint8Array([0x01, 0x00, 0x52, 0x44, 0x4f, 0x50, 0x45, 0x01]); // RD OPE
    const register = buildMultilinkRegister(clientUuid);
    let handle: number | null = null;

    const stopMonitor = transport.monitor(
      deviceId,
      GARMIN_ML_SERVICE,
      GARMIN_ML_NOTIFY,
      (_id, _char, b64) => {
        const bytes = base64ToBytes(b64);

        if (handle == null) {
          const h = parseMultilinkRegisterReply(bytes);
          if (h != null) {
            handle = h;
            onDetail('linked · waiting for shot');
          }
          return;
        }

        const stripped = stripHandlePrefix(bytes);
        const payload = stripped?.payload ?? bytes;

        // Production: decode GFDI shot message here once sniffed.
        const fps = parseProvisionalVelocityFrame(payload);
        if (fps != null) {
          onDetail(`${Math.round(fps)} fps`);
          onReading({
            kind: 'chrono',
            mvFps: fps,
            capturedAt: Date.now(),
            deviceId,
          });
        }
      },
    );

    try {
      await transport.write(
        deviceId,
        GARMIN_ML_SERVICE,
        GARMIN_ML_NOTIFY,
        bytesToBase64(register),
      );
      // Some stacks want REGISTER on 2810 (notify char) — documented assumption.
      void GARMIN_ML_WRITE;
    } catch (err) {
      onDetail(`handshake failed: ${err instanceof Error ? err.message : 'error'}`);
    }

    return stopMonitor;
  },
};
