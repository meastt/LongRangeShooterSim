/**
 * FieldHUD — the primary ballistic display.
 *
 * Shows DIAL (turret clicks), ELEV HOLD (angular), WIND HOLD, RANGE, VELOCITY, TOF, ENERGY, MACH.
 * Long-press the DIAL value to cycle display modes (day / bright / night-red).
 * Tap the unit label (MIL / MOA) to toggle hold unit.
 * Adapts colours to the active Theme.
 *
 * MIL ↔ MOA conversion factor: 1 MIL = 3.43775 MOA
 *
 * DIAL: scope turret clicks (elevationHoldMils × clicksPerMrad), always an integer.
 * HOLD: elevation angle in the user's preferred unit (MIL or MOA).
 * WIND: lateral hold in the user's preferred unit (positive = aim right).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import type { SolverResult } from '../hooks/useSolverResult';
import type { Theme } from '../theme';
import { useFieldStore } from '../store/fieldStore';
import { HunterWEZCard } from './WEZ/HunterWEZCard';
import { WindRiskBand } from './WindRiskBand';
import { useWindRisk } from '../hooks/useWindRisk';

const MIL_TO_MOA = 3.43775;

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

interface MetricProps {
  label: string;
  value: string;
  unit: string;
  theme: Theme;
  large?: boolean;
  /** Called when the unit label is tapped — used for MIL/MOA toggle. */
  onPressUnit?: () => void;
  /** Override the primary colour (e.g. wind hold uses a secondary accent). */
  valueColor?: string;
}

/** Render a labelled metric block. */
function Metric({ label, value, unit, theme, large, onPressUnit, valueColor }: MetricProps) {
  const color = valueColor ?? theme.primary;
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.label }]}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text
          style={[
            large ? styles.metricValueLarge : styles.metricValueNormal,
            { color },
          ]}
        >
          {value}
        </Text>
        {onPressUnit ? (
          <Pressable
            onPress={onPressUnit}
            hitSlop={10}
            accessibilityLabel="Tap to toggle between MIL and MOA"
          >
            <Text style={[styles.metricUnitTappable, { color: theme.dim }]}>
              {unit}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.metricUnit, { color: theme.dim }]}>{unit}</Text>
        )}
      </View>
    </View>
  );
}

export function FieldHUD({ result, theme }: Props) {
  const cycleDisplayMode = useFieldStore((s) => s.cycleDisplayMode);
  const holdUnit = useFieldStore((s) => s.holdUnit);
  const toggleHoldUnit = useFieldStore((s) => s.toggleHoldUnit);
  const { width } = useWindowDimensions();
  const isWide = width > 400;

  // Winds-aloft for wind-risk envelope — null lat/lon disables the API call
  const windRisk = useWindRisk(null, null);

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

  const { row, profile, windHoldMils, dialClicks } = result;

  const profileLine = [
    profile.rifle.caliber,
    `${fmtInt(profile.load.weightGrains)}gr ${profile.load.bulletName}`,
    `${profile.zero.zeroRangeYards}yd zero`,
  ].join(' · ');

  // Convert hold values based on selected unit.
  const unitFactor = holdUnit === 'MOA' ? MIL_TO_MOA : 1;
  const holdDecimals = holdUnit === 'MOA' ? 1 : 2;

  const elevHoldRaw = (row.holdMils as number) * unitFactor;
  const windHoldRaw = windHoldMils * unitFactor;

  const elevHoldStr = fmt(elevHoldRaw, holdDecimals);
  const windHoldStr =
    windHoldMils === 0
      ? '—'
      : `${windHoldMils > 0 ? '+' : ''}${fmt(windHoldRaw, holdDecimals)}`;

  const velocity = fmtInt(row.velocityFps);
  const tof = fmt(row.timeOfFlightSeconds, 3);
  const energy = fmtInt(row.energyFtLbs);
  const mach = fmt(row.mach, 2);
  const range = fmtInt(row.rangeYards);

  // Dial display: integer click count with sign
  const dialSign = dialClicks >= 0 ? '+' : '';
  const dialStr = `${dialSign}${dialClicks}`;

  return (
    <View style={styles.container}>
      {/* Profile header — tap to open DOPE card */}
      <Pressable
        onPress={() => router.push('/profile/dope')}
        accessibilityLabel="View DOPE card"
      >
        <Text
          style={[styles.profileLine, { color: theme.dim }]}
          numberOfLines={1}
        >
          {profileLine} · <Text style={{ color: theme.primary }}>DOPE ›</Text>
        </Text>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Primary outputs row — DIAL and ELEV HOLD */}
      <View style={styles.primaryRow}>
        <Pressable
          onLongPress={cycleDisplayMode}
          hitSlop={16}
          style={styles.primaryCell}
          accessibilityLabel={`Dial: ${dialStr} clicks — long press to change display mode`}
        >
          <Metric
            label="DIAL"
            value={dialStr}
            unit="CLICKS"
            theme={theme}
            large
          />
        </Pressable>
        <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />
        <View style={styles.primaryCell}>
          <Metric
            label="ELEV HOLD"
            value={elevHoldStr}
            unit={holdUnit}
            theme={theme}
            large
            onPressUnit={toggleHoldUnit}
          />
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Wind hold row — now with risk envelope band */}
      <View style={styles.windRow}>
        <WindRiskBand
          windHoldText={
            windHoldMils === 0
              ? '—'
              : `${windHoldMils > 0 ? '+' : ''}${fmt(windHoldRaw, holdDecimals)}`
          }
          unitLabel={windHoldMils === 0 ? '' : holdUnit}
          risk={windRisk}
          theme={theme}
        />
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

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Hunter WEZ traffic light */}
      <HunterWEZCard result={result} theme={theme} />
    </View>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  container: {
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
  windRow: {
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
  metricUnitTappable: {
    fontFamily: FONT,
    fontSize: 12,
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
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
