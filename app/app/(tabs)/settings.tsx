import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';

export default function SettingsScreen() {
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.primary }]}>SETTINGS</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.placeholder, { color: theme.dim }]}>
          Coming in Phase 2
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontFamily: 'SpaceMono-Regular', fontSize: 13, letterSpacing: 2 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontFamily: 'SpaceMono-Regular', fontSize: 13 },
});
