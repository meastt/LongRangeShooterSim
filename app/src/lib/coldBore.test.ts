import { describe, expect, it } from 'vitest';
import { predictColdBoreOffset } from './coldBore';

describe('predictColdBoreOffset', () => {
  it('predicts ~+0.3 mil from five events at the same offset', () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      firstShotOffsetMrad: 0.3,
      date: `2026-07-${10 + i}`,
      loadId: 'load-a',
      suppressorEnabled: false,
    }));
    const p = predictColdBoreOffset(events, {
      loadId: 'load-a',
      suppressorEnabled: false,
    });
    expect(p.elevOffsetMils).toBeCloseTo(0.3, 5);
    expect(p.sampleCount).toBe(5);
    expect(p.canAutoApply).toBe(true);
    expect(p.confidence).not.toBe('low');
  });

  it('stays low confidence with only two events', () => {
    const events = [
      { firstShotOffsetMrad: 0.2, date: '2026-07-01', loadId: 'load-a', suppressorEnabled: false },
      { firstShotOffsetMrad: 0.4, date: '2026-07-02', loadId: 'load-a', suppressorEnabled: false },
    ];
    const p = predictColdBoreOffset(events, {
      loadId: 'load-a',
      suppressorEnabled: false,
    });
    expect(p.confidence).toBe('low');
    expect(p.canAutoApply).toBe(false);
  });

  it('ignores events from a different load when loadId is set', () => {
    const events = [
      { firstShotOffsetMrad: 0.9, date: '2026-07-01', loadId: 'other', suppressorEnabled: false },
      { firstShotOffsetMrad: 0.9, date: '2026-07-02', loadId: 'other', suppressorEnabled: false },
      { firstShotOffsetMrad: 0.9, date: '2026-07-03', loadId: 'other', suppressorEnabled: false },
      { firstShotOffsetMrad: 0.1, date: '2026-07-04', loadId: 'load-a', suppressorEnabled: false },
    ];
    const p = predictColdBoreOffset(events, {
      loadId: 'load-a',
      suppressorEnabled: false,
    });
    expect(p.sampleCount).toBe(1);
    expect(p.elevOffsetMils).toBeCloseTo(0.1, 5);
    expect(p.canAutoApply).toBe(false);
  });
});
