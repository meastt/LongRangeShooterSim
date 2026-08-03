/**
 * Provisional rangefinder frame parser (mock / tests).
 * Protocol: docs/protocols/rangefinder-readonly.md
 */

/** bytes: 'R','G', yd_lo, yd_hi */
export function parseProvisionalRangeFrame(bytes: Uint8Array): number | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0x52 || bytes[1] !== 0x47) return null; // 'R','G'
  const yd = bytes[2]! | (bytes[3]! << 8);
  if (yd < 1 || yd > 3000) return null;
  return yd;
}
