/**
 * Field Mode tab — the primary shooting screen.
 * Combines FieldHUD + RangeInput + status bar colour management.
 */
import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FieldHUD } from '../../src/components/FieldHUD';
import { RangeInput } from '../../src/components/RangeInput';
import { WindInput } from '../../src/components/WindInput';
import { AtmoInput } from '../../src/components/AtmoInput';
import { TacticalMap } from '../../src/components/Map/TacticalMap';
import { useFieldStore } from '../../src/store/fieldStore';
import { useSolverResult } from '../../src/hooks/useSolverResult';
import { useTheme } from '../../src/theme';

export default function FieldScreen() {
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  const result = useSolverResult();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.statusBar} />
      
      <View style={StyleSheet.absoluteFill}>
        <TacticalMap />
      </View>

      <View style={styles.hud}>
        <FieldHUD result={result} theme={theme} />
      </View>
      
      <View style={styles.secondaryInputs}>
        <WindInput theme={theme} />
        <AtmoInput theme={theme} />
      </View>

      <RangeInput theme={theme} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hud: {
    flex: 1,
  },
  secondaryInputs: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
});
