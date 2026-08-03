/**
 * Pure Garmin MultiLink / provisional chrono parsers.
 * Protocol: docs/protocols/garmin-xero-c1.md
 */

/** MultiLink UUID family (Garmin). */
export const GARMIN_ML_BASE = '6a4e';
export const GARMIN_ML_SERVICE = '6a4e2800-667b-11e3-949a-0800200c9a66';
export const GARMIN_ML_NOTIFY = '6a4e2810-667b-11e3-949a-0800200c9a66';
export const GARMIN_ML_WRITE = '6a4e2820-667b-11e3-949a-0800200c9a66';

/** GFDI service id used in community MultiLink REGISTER (ASSUMED for C1). */
export const GARMIN_GFDI_SERVICE_ID = 0x0001;

/**
 * Build a 13-byte MultiLink REGISTER command.
 * Assumption: same layout as public R10 / Gadgetbridge MultiLink notes.
 */
export function buildMultilinkRegister(
  clientUuid: Uint8Array,
  serviceId = GARMIN_GFDI_SERVICE_ID,
): Uint8Array {
  if (clientUuid.length !== 8) {
    throw new Error('clientUuid must be 8 bytes');
  }
  const out = new Uint8Array(13);
  out[0] = 0x00;
  out[1] = 0x01;
  out.set(clientUuid, 2);
  out[10] = serviceId & 0xff;
  out[11] = (serviceId >> 8) & 0xff;
  out[12] = 0x00;
  return out;
}

/**
 * Parse REGISTER success reply — returns assigned handle when present.
 * Layout (community): [status, handle, ...] — status 0 = success.
 */
export function parseMultilinkRegisterReply(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  if (bytes[0] !== 0x00) return null;
  return bytes[1] ?? null;
}

/** Strip leading MultiLink handle byte from a notification payload. */
export function stripHandlePrefix(bytes: Uint8Array): { handle: number; payload: Uint8Array } | null {
  if (bytes.length < 2) return null;
  return { handle: bytes[0]!, payload: bytes.subarray(1) };
}

/**
 * Provisional velocity frame for mock / tests until GFDI shot message is decoded.
 * bytes: 'V','E', fps_lo, fps_hi
 */
export function parseProvisionalVelocityFrame(bytes: Uint8Array): number | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0x56 || bytes[1] !== 0x45) return null; // 'V','E'
  const fps = bytes[2]! | (bytes[3]! << 8);
  if (fps < 500 || fps > 5000) return null;
  return fps;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa is available in RN Hermes / Node test environments via global.
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
