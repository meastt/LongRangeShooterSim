/**
 * Field Mode tab — the primary shooting screen.
 * Combines RifleSwitcher + FieldHUD + RangeInput + status bar colour management.
 */
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FieldHUD } from '../../src/components/FieldHUD';
import { RangeInput } from '../../src/components/RangeInput';
import { WindInput } from '../../src/components/WindInput';
import { AtmoInput } from '../../src/components/AtmoInput';
import { RifleSwitcher } from '../../src/components/RifleSwitcher';
import { TacticalMap } from '../../src/components/Map/TacticalMap';
import { useFieldStore } from '../../src/store/fieldStore';
import { useSolverResult } from '../../src/hooks/useSolverResult';
import { useTheme } from '../../src/theme';

export default function FieldScreen() {
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  const result = useSolverResult();
  const { top: topInset } = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style={theme.statusBar} />

      {/* Map fills the background — topInset passed so toggle clears status bar */}
      <View style={StyleSheet.absoluteFill}>
        <TacticalMap topInset={topInset} />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Rifle switcher — swipe or tap arrows to cycle rifles */}
        <View style={styles.rifleBar}>
          <RifleSwitcher theme={theme} />
        </View>

        {/* Main HUD — scrollable so WEZ expansion doesn't overflow */}
        <View style={styles.hud}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
            <FieldHUD result={result} theme={theme} />
          </ScrollView>
        </View>

        {/* Wind + Atmo chips */}
        <View style={styles.secondaryInputs}>
          <WindInput theme={theme} />
          <AtmoInput theme={theme} />
        </View>

        {/* Range scrubber */}
        <View style={styles.rangeBar}>
          <RangeInput theme={theme} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  safe: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.72)',
  },
  rifleBar: {
    backgroundColor: 'rgba(8, 8, 8, 0.72)',
  },
  rangeBar: {
    backgroundColor: 'rgba(8, 8, 8, 0.72)',
  },
  hud: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryInputs: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(8, 8, 8, 0.88)',
  },
});
