/**
 * FieldHUD — the primary ballistic display.
 *
 * Shows DIAL, HOLD, RANGE, VELOCITY, TOF, ENERGY, MACH.
 * Long-press the DIAL value to cycle display modes.
 * Adapts colours to the active Theme (day / bright / night-red).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import type { SolverResult } from '../hooks/useSolverResult';
import type { Theme } from '../theme';
import { useFieldStore } from '../store/fieldStore';

interface Props {
  result: SolverResult | null;
  theme: Theme;
}

function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals);
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Render a labelled metric block. */
function Metric({
  label,
  value,
  unit,
  theme,
  large,
}: {
  label: string;
  value: string;
  unit: string;
  theme: Theme;
  large?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.label }]}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text
          style={[
            large ? styles.metricValueLarge : styles.metricValueNormal,
            { color: theme.primary },
          ]}
        >
          {value}
        </Text>
        <Text style={[styles.metricUnit, { color: theme.dim }]}>{unit}</Text>
      </View>
    </View>
  );
}

export function FieldHUD({ result, theme }: Props) {
  const cycleDisplayMode = useFieldStore((s) => s.cycleDisplayMode);
  const { width } = useWindowDimensions();
  const isWide = width > 400;

  if (!result) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.bg }]}>
        <Text style={[styles.emptyTitle, { color: theme.label }]}>
          No rifle selected
        </Text>
        <Text style={[styles.emptyBody, { color: theme.dim }]}>
          Go to Profiles and create a rifle profile to start.
        </Text>
      </View>
    );
  }

  const { row, profile } = result;

  const profileLine = [
    profile.rifle.caliber,
    `${fmtInt(profile.load.weightGrains)}gr ${profile.load.bulletName}`,
    `${profile.zero.zeroRangeYards}yd zero`,
  ].join(' · ');

  const dialMils = fmt(row.holdMils, 2);
  const velocity = fmtInt(row.velocityFps);
  const tof = fmt(row.timeOfFlightSeconds, 3);
  const energy = fmtInt(row.energyFtLbs);
  const mach = fmt(row.mach, 2);
  const range = fmtInt(row.rangeYards);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Profile header */}
      <Text
        style={[styles.profileLine, { color: theme.dim }]}
        numberOfLines={1}
      >
        {profileLine}
      </Text>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Primary outputs row — DIAL and HOLD (same value, different context) */}
      <View style={styles.primaryRow}>
        <Pressable
          onLongPress={cycleDisplayMode}
          hitSlop={16}
          style={styles.primaryCell}
          accessibilityLabel="Dial value — long press to change display mode"
        >
          <Metric
            label="DIAL"
            value={dialMils}
            unit="MIL"
            theme={theme}
            large
          />
        </Pressable>
        <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />
        <View style={styles.primaryCell}>
          <Metric
            label="HOLD"
            value={dialMils}
            unit="MIL"
            theme={theme}
            large
          />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Secondary row */}
      <View style={styles.secondaryRow}>
        <Metric label="RANGE" value={range} unit="YD" theme={theme} />
        <Metric label="VELOCITY" value={velocity} unit="FPS" theme={theme} />
        <Metric label="TOF" value={tof} unit="S" theme={theme} />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Tertiary row */}
      <View style={styles.secondaryRow}>
        <Metric label="ENERGY" value={energy} unit="FT·LB" theme={theme} />
        <Metric label="MACH" value={mach} unit="" theme={theme} />
        {isWide && (
          <Metric
            label="PATH"
            value={fmt(row.pathInches, 1)}
            unit='"'
            theme={theme}
          />
        )}
      </View>
    </View>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 0,
  },
  profileLine: {
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    marginVertical: 16,
    opacity: 0.6,
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    opacity: 0.6,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: 0,
  },
  primaryCell: {
    flex: 1,
    paddingHorizontal: 8,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    gap: 4,
    minWidth: 80,
  },
  metricLabel: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValueLarge: {
    fontFamily: FONT,
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: -1,
  },
  metricValueNormal: {
    fontFamily: FONT,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontFamily: FONT,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  emptyBody: {
    fontFamily: FONT,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
