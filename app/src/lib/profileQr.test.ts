import { describe, expect, it, vi } from 'vitest';

// expo-crypto is native — stub digest for Node vitest.
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algo: string, data: string) => {
    // Deterministic fake hash for tests (not cryptographic).
    let h = 0;
    for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(16, '0');
  },
}));

import { ICAO_STANDARD_ATMOSPHERE } from '@aim/solver';
import type { FieldProfile } from '../db/queries';
import { buildQRPayload, parseQRPayload } from './profileQr';

function fakeProfile(): FieldProfile {
  return {
    rifle: {
      id: 'r1',
      name: 'Test',
      caliber: '6.5 Creedmoor',
      twistRateIn: 8,
      barrelLengthIn: 24,
      suppressorEnabled: false,
      notes: null,
      createdAt: '',
      updatedAt: '',
    },
    load: {
      id: 'l1',
      rifleId: 'r1',
      isActive: true,
      bulletName: 'ELD-M',
      weightGrains: 140,
      diameterInches: 0.264,
      bc: 0.31,
      dragModel: 'G7',
      muzzleVelocityFps: 2710,
      powderCharge: null,
      libraryBulletId: null,
      suppressorMvDeltaFps: null,
      suppressorZeroShiftMilsElev: null,
      suppressorZeroShiftMilsWind: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
    },
    scope: {
      id: 's1',
      rifleId: 'r1',
      name: 'Scope',
      clicksPerMrad: 10,
      turretCapMrad: null,
      createdAt: '',
      updatedAt: '',
    },
    zero: {
      id: 'z1',
      loadId: 'l1',
      scopeId: 's1',
      zeroRangeYards: 100,
      scopeHeightInches: 1.5,
      zeroDate: '2026-01-01',
      atmosphericSnapshot: '{}',
      notes: null,
      createdAt: '',
    },
    atmosphericSnapshot: ICAO_STANDARD_ATMOSPHERE,
  };
}

describe('profile QR envelope', () => {
  it('round-trips a profile', async () => {
    const payload = await buildQRPayload(fakeProfile());
    const parsed = await parseQRPayload(payload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.profile.rifle.name).toBe('Test');
      expect(parsed.profile.load.muzzleVelocityFps).toBe(2710);
    }
  });

  it('rejects tampered payload', async () => {
    const payload = await buildQRPayload(fakeProfile());
    const json = decodeURIComponent(escape(atob(payload)));
    const envelope = JSON.parse(json) as { v: number; sig: string; data: string };
    envelope.data = envelope.data.replace('Test', 'Hack');
    const bad = btoa(unescape(encodeURIComponent(JSON.stringify(envelope))));
    const parsed = await parseQRPayload(bad);
    expect(parsed.ok).toBe(false);
  });
});
