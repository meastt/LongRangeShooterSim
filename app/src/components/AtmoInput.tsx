/**
 * AtmoInput — shows current atmospheric conditions (override or zero-time).
 * Tap to open the atmospheric override sheet (Phase 2).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldStore } from '../store/fieldStore';
import { useSolverResult } from '../hooks/useSolverResult';
import type { Theme } from '../theme';

interface Props {
  theme: Theme;
}

export function AtmoInput({ theme }: Props) {
  const result = useSolverResult();
  const override = useFieldStore((s) => s.atmosphericOverride);

  if (!result) return null;

  const { profile } = result;
  const current = override ?? profile.atmosphericSnapshot;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => {
        /* TODO: Open Atmo Sheet in Phase 2 */
      }}
    >
      <View style={styles.content}>
        <Ionicons name="thermometer-outline" size={16} color={theme.primary} />
        <Text style={[styles.value, { color: theme.primary }]}>
          {Math.round(current.temperatureFahrenheit)}°
        </Text>
        <Text style={[styles.unit, { color: theme.dim }]}>F</Text>
      </View>
      <Text style={[styles.label, { color: theme.label }]}>
        {override ? 'OVERRIDE' : 'STANDARD'}
      </Text>
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
