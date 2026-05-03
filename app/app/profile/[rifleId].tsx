/**
 * Profile detail screen — view and edit a rifle profile.
 * Shows rifle info, all loads (with active indicator), scope, and zero.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFieldProfile, setActiveLoad, deleteRifle } from '../../src/db/queries';
import type { FieldProfile } from '../../src/db/queries';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';

function Row({
  label,
  value,
  dim,
}: {
  label: string;
  value: string | null | undefined;
  dim: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: dim }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: dim }]}>{value}</Text>
    </View>
  );
}

export default function ProfileDetailScreen() {
  const { rifleId } = useLocalSearchParams<{ rifleId: string }>();
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const setActiveRifleId = useFieldStore((s) => s.setActiveRifleId);

  const [profile, setProfile] = useState<FieldProfile | null>(null);

  const load = useCallback(async () => {
    if (!rifleId) return;
    const p = await getFieldProfile(rifleId);
    setProfile(p);
  }, [rifleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleDelete() {
    Alert.alert(
      'Delete rifle?',
      'This will permanently delete this rifle, all its loads, and all recorded zeros.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!rifleId) return;
            await deleteRifle(rifleId);
            if (activeRifleId === rifleId) setActiveRifleId(null);
            router.back();
          },
        },
      ],
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={theme.label} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>PROFILE</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.dim }]}>
            Profile incomplete — add a load and zero to use this rifle in Field Mode.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { rifle, load: activeLoad, scope, zero } = profile;
  const atmo = profile.atmosphericSnapshot;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.label} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.primary }]} numberOfLines={1}>
          {rifle.name.toUpperCase()}
        </Text>
        <Pressable onPress={handleDelete} hitSlop={12}>
          <Ionicons name="trash-outline" size={20} color={theme.dim} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Rifle */}
        <Text style={[styles.section, { color: theme.dim }]}>RIFLE</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Name" value={rifle.name} dim={theme.label} />
          <Row label="Caliber" value={rifle.caliber} dim={theme.label} />
          <Row label="Twist rate" value={rifle.twistRateIn ? `1:${rifle.twistRateIn}"` : undefined} dim={theme.label} />
          <Row label="Barrel" value={rifle.barrelLengthIn ? `${rifle.barrelLengthIn}"` : undefined} dim={theme.label} />
          <Row label="Suppressor" value={rifle.suppressorEnabled ? 'Enabled' : 'Disabled'} dim={theme.label} />
        </View>

        {/* Load */}
        <Text style={[styles.section, { color: theme.dim }]}>ACTIVE LOAD</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Bullet" value={activeLoad.bulletName} dim={theme.label} />
          <Row label="Weight" value={`${activeLoad.weightGrains} gr`} dim={theme.label} />
          <Row label="Diameter" value={`${activeLoad.diameterInches}"`} dim={theme.label} />
          <Row label="BC" value={`${activeLoad.bc} (${activeLoad.dragModel})`} dim={theme.label} />
          <Row label="Muzzle velocity" value={`${activeLoad.muzzleVelocityFps} fps`} dim={theme.label} />
        </View>

        {/* Scope */}
        <Text style={[styles.section, { color: theme.dim }]}>SCOPE</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Name" value={scope.name} dim={theme.label} />
          <Row label="Click value" value={`${scope.clicksPerMrad} clicks/mrad`} dim={theme.label} />
          <Row label="Turret cap" value={scope.turretCapMrad ? `${scope.turretCapMrad} mrad` : 'Not set'} dim={theme.label} />
        </View>

        {/* Zero */}
        <Text style={[styles.section, { color: theme.dim }]}>ZERO</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Zero range" value={`${zero.zeroRangeYards} yd`} dim={theme.label} />
          <Row label="Scope height" value={`${zero.scopeHeightInches}"`} dim={theme.label} />
          <Row label="Date" value={zero.zeroDate} dim={theme.label} />
          <Row label="Temp" value={`${atmo.temperatureFahrenheit}°F`} dim={theme.label} />
          <Row label="Pressure" value={`${atmo.pressureInHg} inHg`} dim={theme.label} />
          <Row label="Humidity" value={`${atmo.relativeHumidityPct}%`} dim={theme.label} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: FONT, fontSize: 13, letterSpacing: 2, flex: 1, textAlign: 'center' },
  scroll: { padding: 16, gap: 12, paddingBottom: 48 },
  section: { fontFamily: FONT, fontSize: 10, letterSpacing: 2, marginTop: 8, marginBottom: 4 },
  card: { borderRadius: 10, padding: 16, gap: 8, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontFamily: FONT, fontSize: 12 },
  rowValue: { fontFamily: FONT, fontSize: 12 },
  empty: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONT, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
