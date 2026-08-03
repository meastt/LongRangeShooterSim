import { describe, expect, it } from 'vitest';
import {
  importABMobileJSON,
  importHornadyJSON,
  importShooterCSV,
  importShooterJSON,
  importStrelokCSV,
} from '../utils/importers';

describe('importStrelokCSV', () => {
  it('parses a header + one profile row', () => {
    const csv = [
      'Name,Caliber,BC,BC type,Weight (gr),Diameter (in),MV (fps),Zero range (yd),Scope height (in),Zero temp (F),Zero pressure (inHg),Zero humidity (%)',
      'Elk Rifle,6.5 Creedmoor,0.310,G7,140,0.264,2710,100,1.5,59,29.92,50',
    ].join('\n');

    const profiles = importStrelokCSV(csv);
    expect(profiles).toHaveLength(1);
    const p = profiles[0]!;
    expect(p.name).toBe('Elk Rifle');
    expect(p.caliber).toBe('6.5 Creedmoor');
    expect(p.dragModel).toBe('G7');
    expect(p.bc).toBeCloseTo(0.31);
    expect(p.weightGrains).toBe(140);
    expect(p.muzzleVelocityFps).toBe(2710);
    expect(p.zeroRangeYards).toBe(100);
  });

  it('returns empty array for header-only CSV', () => {
    expect(importStrelokCSV('Name,Caliber,BC\n')).toEqual([]);
  });
});

describe('importHornadyJSON', () => {
  it('prefers G7 when present', () => {
    const p = importHornadyJSON(
      JSON.stringify({
        cartridge: '7mm PRC',
        bulletName: 'ELD-M',
        bulletWeight: 180,
        bulletDiameter: 0.284,
        g7Bc: 0.402,
        muzzleVelocity: 2950,
        sightHeight: 1.8,
        zeroRange: 100,
      }),
    );
    expect(p.dragModel).toBe('G7');
    expect(p.bc).toBeCloseTo(0.402);
    expect(p.name).toContain('7mm PRC');
    expect(p.muzzleVelocityFps).toBe(2950);
  });
});

describe('importABMobileJSON', () => {
  it('parses flat AB-style object', () => {
    const profiles = importABMobileJSON(
      JSON.stringify({
        rifleName: 'Elk Rig',
        cartridge: '6.5 Creedmoor',
        bulletName: 'ELD-M',
        bulletWeight: 140,
        bulletDiameter: 0.264,
        g7Bc: 0.31,
        dragFunction: 'G7',
        muzzleVelocity: 2710,
        zeroRange: 100,
        sightHeight: 1.5,
      }),
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.name).toBe('Elk Rig');
    expect(profiles[0]!.dragModel).toBe('G7');
    expect(profiles[0]!.muzzleVelocityFps).toBe(2710);
  });

  it('parses nested bullet + profiles array', () => {
    const profiles = importABMobileJSON(
      JSON.stringify({
        profiles: [
          {
            gunName: 'Sheep',
            caliber: '7mm PRC',
            bullet: {
              name: 'ELD-M',
              weight: 180,
              diameter: 0.284,
              bc: 0.402,
              dragModel: 'G7',
            },
            mv: 2950,
          },
        ],
      }),
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.bulletName).toBe('ELD-M');
    expect(profiles[0]!.bc).toBeCloseTo(0.402);
  });

  it('converts mm diameter', () => {
    const profiles = importABMobileJSON(
      JSON.stringify({
        name: 'Test',
        caliber: '6.5',
        bulletName: 'X',
        weight: 140,
        diameter: 6.71,
        bc: 0.3,
        bcType: 'G7',
        mv: 2700,
      }),
    );
    expect(profiles[0]!.diameterInches).toBeCloseTo(6.71 / 25.4, 3);
  });
});

describe('importShooterJSON / CSV', () => {
  it('parses Shooter-style PascalCase JSON', () => {
    const profiles = importShooterJSON(
      JSON.stringify({
        ProfileName: 'Whitetail',
        Cartridge: '.308 Win',
        BulletName: 'SMK',
        BulletWeight: 175,
        BulletDiameter: 0.308,
        BC: 0.243,
        BCType: 'G7',
        MuzzleVelocity: 2600,
        ZeroRange: 100,
        SightHeight: 1.5,
      }),
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.name).toBe('Whitetail');
    expect(profiles[0]!.weightGrains).toBe(175);
  });

  it('parses Shooter CSV via Strelok-compatible headers', () => {
    const csv = [
      'Name,Caliber,BC,BC type,Weight (gr),Diameter (in),MV (fps),Zero range (yd),Scope height (in)',
      'Whitetail,.308 Win,0.243,G7,175,0.308,2600,100,1.5',
    ].join('\n');
    const profiles = importShooterCSV(csv);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.muzzleVelocityFps).toBe(2600);
  });
});
