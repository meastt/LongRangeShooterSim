import { describe, expect, it } from 'vitest';
import { importHornadyJSON, importStrelokCSV } from '../utils/importers';

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
