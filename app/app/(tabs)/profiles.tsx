/**
 * Profiles tab — rifle list with active load badges.
 * FAB → new-rifle modal. Tap a card → profile detail screen.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getRiflesWithActiveLoad } from '../../src/db/queries';
import type { RifleWithActiveLoad } from '../../src/db/queries';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';
import type { Theme } from '../../src/theme';

function RifleCard({
  rifle,
  active,
  theme,
  onPress,
  onSetActive,
}: {
  rifle: RifleWithActiveLoad;
  active: boolean;
  theme: Theme;
  onPress: () => void;
  onSetActive: () => void;
}) {
  const load = rifle.activeLoad;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: active ? theme.primary : theme.border,
          borderWidth: active ? 1.5 : 1,
        },
      ]}
      accessibilityLabel={`${rifle.name} rifle profile`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitles}>
          <Text style={[styles.rifleName, { color: theme.primary }]}>
            {rifle.name}
          </Text>
          <Text style={[styles.rifleCalber, { color: theme.label }]}>
            {rifle.caliber}
          </Text>
        </View>
        <Pressable
          onPress={onSetActive}
          hitSlop={12}
          accessibilityLabel={active ? 'Active rifle' : 'Set as active rifle'}
        >
          <Ionicons
            name={active ? 'radio-button-on' : 'radio-button-off'}
            size={22}
            color={active ? theme.primary : theme.dim}
          />
        </Pressable>
      </View>

      {load ? (
        <View style={styles.loadBadges}>
          <Badge
            text={`${Math.round(load.weightGrains)}gr ${load.bulletName}`}
            theme={theme}
          />
          <Badge text={`${load.dragModel} BC ${load.bc}`} theme={theme} />
          <Badge text={`MV ${Math.round(load.muzzleVelocityFps)} fps`} theme={theme} />
        </View>
      ) : (
        <Text style={[styles.noLoad, { color: theme.dim }]}>
          No load — tap to add
        </Text>
      )}
    </Pressable>
  );
}

function Badge({ text, theme }: { text: string; theme: Theme }) {
  return (
    <View style={[styles.badge, { backgroundColor: theme.border }]}>
      <Text style={[styles.badgeText, { color: theme.label }]}>{text}</Text>
    </View>
  );
}

export default function ProfilesScreen() {
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const setActiveRifleId = useFieldStore((s) => s.setActiveRifleId);

  const [rifles, setRifles] = useState<RifleWithActiveLoad[]>([]);

  const load = useCallback(async () => {
    const data = await getRiflesWithActiveLoad();
    setRifles(data);
      const firstId = data[0]?.id;
      if (!activeRifleId && firstId) setActiveRifleId(firstId);
  }, [activeRifleId, setActiveRifleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.primary }]}>PROFILES</Text>
      </View>

      {rifles.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="layers-outline" size={48} color={theme.dim} />
          <Text style={[styles.emptyTitle, { color: theme.label }]}>
            No rifle profiles yet
          </Text>
          <Text style={[styles.emptyBody, { color: theme.dim }]}>
            Tap + to add your first rifle.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rifles}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RifleCard
              rifle={item}
              active={item.id === activeRifleId}
              theme={theme}
              onPress={() => router.push(`/profile/${item.id}`)}
              onSetActive={() => setActiveRifleId(item.id)}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/profile/new-rifle')}
        style={[styles.fab, { backgroundColor: theme.primary }]}
        accessibilityLabel="Add new rifle profile"
      >
        <Ionicons name="add" size={28} color={theme.bg} />
      </Pressable>
    </SafeAreaView>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: 2,
  },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitles: { gap: 2 },
  rifleName: { fontFamily: FONT, fontSize: 16, letterSpacing: 0.3 },
  rifleCalber: { fontFamily: FONT, fontSize: 12, letterSpacing: 0.5 },
  loadBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: { fontFamily: FONT, fontSize: 11 },
  noLoad: { fontFamily: FONT, fontSize: 12 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 16 },
  emptyBody: { fontFamily: FONT, fontSize: 13, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
