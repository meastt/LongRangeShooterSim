/**
 * DOPE screen — full ballistic table for the active rifle.
 *
 * Accessed via:
 *   • "DOPE" button on the Profile detail screen (profile/[rifleId]/dope)
 *   • Directly via expo-router link with rifleId param
 *
 * Reads the active field store wind so the wind column is live.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';
import { DOPECard } from '../../src/components/DOPECard';
import { useSolverResult } from '../../src/hooks/useSolverResult';

const FONT = 'SpaceMono-Regular';

export default function DOPEScreen() {
  const { rifleId } = useLocalSearchParams<{ rifleId: string }>();
  const displayMode = useFieldStore((s) => s.displayMode);
  const holdUnit = useFieldStore((s) => s.holdUnit);
  const windSpeedMph = useFieldStore((s) => s.windSpeedMph);
  const windClockPosition = useFieldStore((s) => s.windClockPosition);
  const theme = useTheme(displayMode);

  // useSolverResult already loads the active profile — we just need the profile.
  // We pass rifleId through the route so the DOPE card could show any rifle's
  // data, but for v1 we use the active profile from the solver hook.
  const result = useSolverResult();

  if (!result) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.dim }]}>
            No active rifle profile.{'\n'}Go to Profiles and create one.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <DOPECard
        profile={result.profile}
        theme={theme}
        holdUnit={holdUnit}
        windSpeedMph={windSpeedMph}
        windClockPos={windClockPosition}
        onClose={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
  },
});
