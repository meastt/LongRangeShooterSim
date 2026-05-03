/**
 * HunterWEZCard — collapsible WEZ traffic light on the Field Mode HUD.
 *
 * Collapsed: a single traffic-light pill (GREEN/YELLOW/RED) with hit %.
 * Expanded: full breakdown — hit probability, velocity, energy, reason text.
 *
 * Species defaults: elk (10" vitals, 1800 fps min).
 * Long-press the pill to cycle species.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { computeWEZ, SPECIES_DEFAULTS } from '../../utils/wez';
import type { WEZTrafficLight, Species } from '../../utils/wez';
import type { SolverResult } from '../../hooks/useSolverResult';
import type { Theme } from '../../theme';

interface Props {
  result: SolverResult;
  theme: Theme;
  /** Wind uncertainty in MIL — from wind-risk envelope or default 0.2. */
  windSigmaMil?: number;
}

const SPECIES_CYCLE: Exclude<Species, 'custom'>[] = [
  'elk', 'mule_deer', 'whitetail', 'antelope', 'black_bear',
];

const LIGHT_COLORS: Record<WEZTrafficLight, string> = {
  clear:    '#22C55E',   // green-500
  marginal: '#F59E0B',   // amber-500
  hold:     '#EF4444',   // red-500
};

const LIGHT_LABELS: Record<WEZTrafficLight, string> = {
  clear:    'CLEAR',
  marginal: 'MARGINAL',
  hold:     'HOLD',
};

const FONT = 'SpaceMono-Regular';

export function HunterWEZCard({ result, theme, windSigmaMil = 0.2 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [speciesIdx, setSpeciesIdx] = useState(0);

  const speciesKey = SPECIES_CYCLE[speciesIdx]!;
  const species = SPECIES_DEFAULTS[speciesKey];

  const wez = computeWEZ(result.row, species, windSigmaMil);
  const lightColor = LIGHT_COLORS[wez.trafficLight];

  function cycleSpecies() {
    setSpeciesIdx((i) => (i + 1) % SPECIES_CYCLE.length);
  }

  return (
    <View style={styles.wrapper}>
      {/* Compact pill — always visible */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        onLongPress={cycleSpecies}
        style={[styles.pill, { borderColor: lightColor }]}
        accessibilityLabel={`WEZ: ${LIGHT_LABELS[wez.trafficLight]} — ${wez.hitPct.toFixed(0)}% hit probability for ${species.name}. Long-press to change species.`}
      >
        {/* Traffic light dot */}
        <View style={[styles.dot, { backgroundColor: lightColor }]} />
        <Text style={[styles.pillLabel, { color: lightColor }]}>
          {LIGHT_LABELS[wez.trafficLight]}
        </Text>
        <Text style={[styles.pillHit, { color: theme.dim }]}>
          {wez.hitPct.toFixed(0)}% {species.name.toUpperCase()}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={theme.dim}
          style={styles.chevron}
        />
      </Pressable>

      {/* Expanded detail panel */}
      {expanded && (
        <View style={[styles.detail, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {/* Row: Hit probability */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.dim }]}>HIT PROBABILITY</Text>
            <Text style={[styles.detailValue, { color: lightColor }]}>
              {wez.hitPct.toFixed(1)}%
            </Text>
          </View>

          {/* Row: Velocity */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.dim }]}>IMPACT VELOCITY</Text>
            <Text style={[
              styles.detailValue,
              { color: wez.velocityAdequate ? theme.label : LIGHT_COLORS.hold },
            ]}>
              {Math.round(result.row.velocityFps as number)} FPS
              {!wez.velocityAdequate ? ' ⚠' : ' ✓'}
            </Text>
          </View>

          {/* Row: Energy */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.dim }]}>IMPACT ENERGY</Text>
            <Text style={[
              styles.detailValue,
              { color: wez.energyAdequate ? theme.label : LIGHT_COLORS.hold },
            ]}>
              {Math.round(result.row.energyFtLbs)} FT·LB
              {!wez.energyAdequate ? ' ⚠' : ' ✓'}
            </Text>
          </View>

          {/* Row: Vital zone target */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.dim }]}>VITAL ZONE</Text>
            <Text style={[styles.detailValue, { color: theme.dim }]}>
              {species.vitalZoneInches}" ({species.name})
            </Text>
          </View>

          {/* Reason text */}
          <Text style={[styles.reason, { color: theme.dim }]} numberOfLines={3}>
            {wez.reason}
          </Text>

          {/* Species cycle hint */}
          <Text style={[styles.hint, { color: theme.dim }]}>
            Long-press pill to change species
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pillLabel: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  pillHit: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  chevron: { marginLeft: 2 },

  detail: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  detailValue: {
    fontFamily: FONT,
    fontSize: 13,
  },
  reason: {
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 2,
  },
  hint: {
    fontFamily: FONT,
    fontSize: 8,
    letterSpacing: 0.5,
    marginTop: 2,
    opacity: 0.6,
  },
});
