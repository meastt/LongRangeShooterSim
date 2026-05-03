import { db } from './client';
import { rifles, loads, scopes, zeros } from './schema';
import * as crypto from 'expo-crypto';

async function seed() {
  console.log('[Seed] Starting database population...');

  const now = () => new Date().toISOString();
  const uuid = () => crypto.randomUUID();

  // 1. Carbon Razor Rimfire
  const razorId = uuid();
  const razorLoadId = uuid();
  const razorScopeId = uuid();

  await db.insert(rifles).values({
    id: razorId,
    name: 'Fierce Carbon Razor Rimfire',
    caliber: '.22 LR',
    twistRateIn: 16,
    barrelLengthIn: 18,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(loads).values({
    id: razorLoadId,
    rifleId: razorId,
    isActive: true,
    bulletName: 'CCI Standard Velocity',
    weightGrains: 40,
    diameterInches: 0.223,
    bc: 0.12,
    dragModel: 'G1',
    muzzleVelocityFps: 1070,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(scopes).values({
    id: razorScopeId,
    rifleId: razorId,
    name: 'Nightforce NXS 2.5-10x42',
    clicksPerMrad: 10,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(zeros).values({
    id: uuid(),
    loadId: razorLoadId,
    scopeId: razorScopeId,
    zeroRangeYards: 50,
    scopeHeightInches: 1.5,
    zeroDate: now(),
    atmosphericSnapshot: JSON.stringify({
      temperatureFahrenheit: 59,
      pressureInHg: 29.92,
      relativeHumidityPct: 50,
    }),
    createdAt: now(),
  });

  // 2. Reaper HTAC
  const reaperId = uuid();
  const reaperLoadId = uuid();
  const reaperScopeId = uuid();

  await db.insert(rifles).values({
    id: reaperId,
    name: 'Fierce Reaper HTAC',
    caliber: '7mm PRC',
    twistRateIn: 8,
    barrelLengthIn: 20,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(loads).values({
    id: reaperLoadId,
    rifleId: reaperId,
    isActive: true,
    bulletName: 'Hornady ELD-M',
    weightGrains: 180,
    diameterInches: 0.284,
    bc: 0.402, // G7
    dragModel: 'G7',
    muzzleVelocityFps: 2950,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(scopes).values({
    id: reaperScopeId,
    rifleId: reaperId,
    name: 'Swarovski Z5i+ 5-25x56 BT-4W+',
    clicksPerMrad: 10,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(zeros).values({
    id: uuid(),
    loadId: reaperLoadId,
    scopeId: reaperScopeId,
    zeroRangeYards: 100,
    scopeHeightInches: 1.8,
    zeroDate: now(),
    atmosphericSnapshot: JSON.stringify({
      temperatureFahrenheit: 59,
      pressureInHg: 29.92,
      relativeHumidityPct: 50,
    }),
    createdAt: now(),
  });

  // 3. Twisted Mini Rogue XP 2.0
  const rogueId = uuid();
  const rogueLoadId = uuid();
  const rogueScopeId = uuid();

  await db.insert(rifles).values({
    id: rogueId,
    name: 'Fierce Twisted Mini Rogue XP 2.0',
    caliber: '6.5 Creedmoor',
    twistRateIn: 8,
    barrelLengthIn: 22,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(loads).values({
    id: rogueLoadId,
    rifleId: rogueId,
    isActive: true,
    bulletName: 'Hornady ELD-M',
    weightGrains: 140,
    diameterInches: 0.264,
    bc: 0.326, // G7
    dragModel: 'G7',
    muzzleVelocityFps: 2710,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(scopes).values({
    id: rogueScopeId,
    rifleId: rogueId,
    name: 'Nightforce NX8 F1 4-32x50 MOAR',
    clicksPerMrad: 10,
    createdAt: now(),
    updatedAt: now(),
  });

  await db.insert(zeros).values({
    id: uuid(),
    loadId: rogueLoadId,
    scopeId: rogueScopeId,
    zeroRangeYards: 100,
    scopeHeightInches: 1.7,
    zeroDate: now(),
    atmosphericSnapshot: JSON.stringify({
      temperatureFahrenheit: 59,
      pressureInHg: 29.92,
      relativeHumidityPct: 50,
    }),
    createdAt: now(),
  });

  console.log('[Seed] Database population complete.');
}

export default seed;
