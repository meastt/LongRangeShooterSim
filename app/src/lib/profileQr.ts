/**
 * QR profile envelope — SHA-256 integrity (not Ed25519 auth).
 * Spec note: Ed25519 deferred until a key registry exists (v2).
 */
import * as Crypto from 'expo-crypto';
import type { FieldProfile } from '../db/queries';

export const PROFILE_QR_VERSION = 1;

export type ProfileQrEnvelope = {
  v: number;
  sig: string;
  data: string;
};

export async function buildQRPayload(profile: FieldProfile): Promise<string> {
  const data = JSON.stringify(profile);
  const sig = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data,
  );
  const envelope: ProfileQrEnvelope = { v: PROFILE_QR_VERSION, sig, data };
  return btoa(unescape(encodeURIComponent(JSON.stringify(envelope))));
}

export type ParseQrResult =
  | { ok: true; profile: FieldProfile }
  | { ok: false; error: string };

export async function parseQRPayload(raw: string): Promise<ParseQrResult> {
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const envelope = JSON.parse(json) as ProfileQrEnvelope;
    if (envelope.v !== PROFILE_QR_VERSION) {
      return { ok: false, error: `Unsupported payload version: ${envelope.v}` };
    }
    const expectedSig = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      envelope.data,
    );
    if (expectedSig !== envelope.sig) {
      return { ok: false, error: 'Integrity check failed — payload may be corrupted.' };
    }
    const profile = JSON.parse(envelope.data) as FieldProfile;
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, error: `Parse error: ${String(e)}` };
  }
}
