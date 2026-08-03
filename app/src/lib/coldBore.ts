/**
 * Cold-bore intelligence — mean first-shot offset from the on-device log.
 *
 * Spec: docs/specs/cold-bore-intelligence.md
 * Events already store offset in milliradians (firstShotOffsetMrad).
 * v1: angular mean; do not invent fancy regression.
 */

export type ColdBoreConfidence = 'low' | 'medium' | 'high';

export type ColdBoreEventLike = {
  firstShotOffsetMrad: number;
  date: string;
  loadId?: string | null;
  suppressorEnabled?: boolean | null;
};

export type ColdBorePrediction = {
  /** Mean vertical cold offset in mils (positive = high / dial up). */
  elevOffsetMils: number;
  sampleCount: number;
  sampleSigmaMils: number;
  confidence: ColdBoreConfidence;
  /** True when confidence ≥ medium and ≥3 qualifying events. */
  canAutoApply: boolean;
  disclaimer: string;
};

const MAX_AGE_DAYS = 180;
const OUTLIER_SIGMA = 3;

function daysAgo(isoDate: string): number {
  const t = Date.parse(isoDate.length <= 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sampleStdDev(xs: number[], mu: number): number {
  if (xs.length < 2) return 0;
  const v = xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/**
 * Predict cold-bore elev offset for the active load + suppressor bucket.
 * Legacy rows (null loadId) are included only when no loadId filter is needed
 * or when they match the rifle-wide history for that suppressor state.
 */
export function predictColdBoreOffset(
  events: readonly ColdBoreEventLike[],
  opts: {
    loadId: string;
    suppressorEnabled: boolean;
  },
): ColdBorePrediction {
  const disclaimer =
    'Estimated from your cold-bore log. You are responsible for the shot decision.';

  const fresh = events.filter((e) => daysAgo(e.date) <= MAX_AGE_DAYS);
  const bucket = fresh.filter((e) => {
    const sup = e.suppressorEnabled ?? false;
    if (sup !== opts.suppressorEnabled) return false;
    // Prefer load-matched; allow legacy null loadId into the series.
    if (e.loadId != null && e.loadId !== opts.loadId) return false;
    return true;
  });

  if (bucket.length === 0) {
    return {
      elevOffsetMils: 0,
      sampleCount: 0,
      sampleSigmaMils: 0,
      confidence: 'low',
      canAutoApply: false,
      disclaimer,
    };
  }

  let offsets = bucket.map((e) => e.firstShotOffsetMrad);
  const mu0 = mean(offsets);
  const sig0 = sampleStdDev(offsets, mu0);
  if (sig0 > 0 && offsets.length >= 3) {
    offsets = offsets.filter((x) => Math.abs(x - mu0) <= OUTLIER_SIGMA * sig0);
  }

  const mu = mean(offsets);
  const sigma = sampleStdDev(offsets, mu);
  const n = offsets.length;

  let confidence: ColdBoreConfidence = 'low';
  if (n >= 5 && sigma <= 0.15) confidence = 'high';
  else if (n >= 3 && sigma <= 0.35) confidence = 'medium';
  else if (n >= 3) confidence = 'medium';

  const canAutoApply = n >= 3 && (confidence === 'medium' || confidence === 'high');

  return {
    elevOffsetMils: mu,
    sampleCount: n,
    sampleSigmaMils: sigma,
    confidence,
    canAutoApply,
    disclaimer,
  };
}
