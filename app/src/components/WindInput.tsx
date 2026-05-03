/**
 * WindInput — compact status and trigger for wind settings.
 * Shows speed and a clock-position arrow.
 * Tap to open the wind adjustment sheet (Phase 2).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldStore } from '../store/fieldStore';
import type { Theme } from '../theme';

interface Props {
  theme: Theme;
}

export function WindInput({ theme }: Props) {
  const windSpeed = useFieldStore((s) => s.windSpeedMph);
  const clock = useFieldStore((s) => s.windClockPosition);

  // Simple rotation calculation for the arrow.
  // 12 o'clock (0°) is headwind. 3 o'clock (90°) is full value right.
  const rotation = (clock / 12) * 360;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => {
        /* TODO: Open Wind Sheet in Phase 2 */
      }}
    >
      <View style={styles.content}>
        <Ionicons
          name="arrow-up-outline"
          size={16}
          color={theme.primary}
          style={{ transform: [{ rotate: `${rotation}deg` }] }}
        />
        <Text style={[styles.value, { color: theme.primary }]}>
          {Math.round(windSpeed)}
        </Text>
        <Text style={[styles.unit, { color: theme.dim }]}>MPH</Text>
      </View>
      <Text style={[styles.label, { color: theme.label }]}>WIND</Text>
    </Pressable>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
    gap: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontFamily: FONT,
    fontSize: 16,
  },
  unit: {
    fontFamily: FONT,
    fontSize: 10,
  },
  label: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
  },
});
