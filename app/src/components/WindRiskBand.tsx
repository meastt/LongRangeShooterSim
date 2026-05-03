/**
 * WindRiskBand — visual wind-risk envelope widget for the Field HUD.
 *
 * Displays the current wind hold value with a coloured band underneath
 * whose width reflects upper-air wind variance (σ_wind from useWindRisk).
 *
 * Risk levels:
 *   Low      (σ < 4 mph)  — green narrow band — wind is predictable
 *   Moderate (σ < 9 mph)  — amber medium band  — plan for some variance
 *   High     (σ ≥ 9 mph)  — red wide band      — significant unpredictability
 *
 * When no GPS location is available (lat/lon null), the band is hidden and
 * only the plain wind-hold number is shown.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { WindRiskResult } from '../hooks/useWindRisk';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';

interface Props {
  /** Formatted wind hold string (e.g. "+0.8" or "+2.7 MOA") */
  windHoldText: string;
  /** Wind unit label */
  unitLabel: string;
  /** Risk data from useWindRisk — null = no location, still show value */
  risk: WindRiskResult | null;
  theme: Theme;
}

const RISK_COLORS: Record<string, string> = {
  low: '#22C55E',
  moderate: '#F59E0B',
  high: '#EF4444',
};

const BAND_WIDTHS: Record<string, number> = {
  low: 0.25,       // 25% of container
  moderate: 0.55,  // 55%
  high: 0.95,      // 95%
};

export function WindRiskBand({ windHoldText, unitLabel, risk, theme }: Props) {
  const hasRisk = risk !== null && risk.error === null && risk.sigmaWindMph > 0;
  const bandColor = hasRisk ? (RISK_COLORS[risk!.level] ?? theme.dim) : theme.dim;
  const bandFrac = hasRisk ? (BAND_WIDTHS[risk!.level] ?? 0.25) : 0;

  return (
    <View style={styles.container}>
      {/* Value row */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.dim }]}>WIND</Text>
        <Text style={[styles.value, { color: bandColor }]}>{windHoldText}</Text>
        <Text style={[styles.unit, { color: theme.dim }]}>{unitLabel}</Text>
      </View>

      {/* Risk band */}
      {hasRisk && (
        <View style={[styles.bandTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.bandFill,
              {
                backgroundColor: bandColor,
                width: `${bandFrac * 100}%` as `${number}%`,
              },
            ]}
          />
        </View>
      )}

      {/* Risk annotation */}
      {hasRisk && (
        <Text style={[styles.riskLabel, { color: bandColor }]}>
          {risk!.level.toUpperCase()} WIND RISK · σ {risk!.sigmaWindMph.toFixed(1)} mph
          {risk!.fromCache ? ' (cached)' : ''}
        </Text>
      )}

      {risk?.error && (
        <Text style={[styles.riskLabel, { color: theme.dim }]}>
          wind-aloft unavailable
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  label: { fontFamily: FONT, fontSize: 10, letterSpacing: 2, minWidth: 44 },
  value: { fontFamily: FONT, fontSize: 28, letterSpacing: -0.5 },
  unit: { fontFamily: FONT, fontSize: 12 },
  bandTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  bandFill: {
    height: 4,
    borderRadius: 2,
  },
  riskLabel: {
    fontFamily: FONT,
    fontSize: 8,
    letterSpacing: 1,
  },
});
