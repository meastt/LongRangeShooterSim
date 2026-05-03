/**
 * Field Mode tab — the primary shooting screen.
 * Combines FieldHUD + RangeInput + status bar colour management.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <View style={styles.root}>
      <StatusBar style={theme.statusBar} />
      
      <View style={StyleSheet.absoluteFill}>
        <TacticalMap />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.hud}>
          <FieldHUD result={result} theme={theme} />
        </View>
        
        <View style={styles.secondaryInputs}>
          <WindInput theme={theme} />
          <AtmoInput theme={theme} />
        </View>

        <RangeInput theme={theme} />
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
