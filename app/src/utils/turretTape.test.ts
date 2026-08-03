import { describe, expect, it } from 'vitest';
import { generateTurretTapeHtml } from './turretTape';

describe('turretTape HTML generator', () => {
  it('generates HTML string with 1:1 scale SVG turret strip and DOPE table', () => {
    const html = generateTurretTapeHtml({
      rifleName: '6.5 PRC Hunter',
      caliber: '6.5 PRC',
      bulletName: 'Hornady ELD-X',
      weightGrains: 143,
      muzzleVelocityFps: 2920,
      zeroRangeYards: 100,
      clicksPerMrad: 10,
      turretDiameterMm: 30,
      tapeHeightMm: 12,
      trajectoryRows: [
        { rangeYards: 100, elevHoldMils: 0 },
        { rangeYards: 200, elevHoldMils: 0.5 },
        { rangeYards: 300, elevHoldMils: 1.2 },
        { rangeYards: 400, elevHoldMils: 2.0 },
        { rangeYards: 500, elevHoldMils: 2.9 },
      ],
    });

    expect(html).toContain('AIM Custom Scope Turret Tape');
    expect(html).toContain('6.5 PRC Hunter');
    expect(html).toContain('143');
    expect(html).toContain('PRINT SCALE VERIFICATION');
    expect(html).toContain('<svg width="94.25mm" height="12mm"');
    expect(html).toContain('DOPE Reference Table');
  });
});
