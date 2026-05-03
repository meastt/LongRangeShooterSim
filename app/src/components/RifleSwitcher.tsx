/**
 * RifleSwitcher — compact rifle-selector strip for Field Mode.
 *
 * Shows the active rifle name with left/right arrows.
 * Swipe left/right on the strip to cycle through rifles.
 * Satisfies the Field Mode UX rule: profile switch ≤ 2 taps from any field screen.
 *
 * Rifles are loaded from the DB on mount and whenever activeRifleId changes.
 * The active rifle is highlighted; tapping an arrow cycles to the next/prev.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  PanResponder,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRiflesWithActiveLoad } from '../db/queries';
import type { RifleWithActiveLoad } from '../db/queries';
import { useFieldStore } from '../store/fieldStore';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';
const SWIPE_THRESHOLD = 40; // px

interface Props {
  theme: Theme;
}

export function RifleSwitcher({ theme }: Props) {
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const setActiveRifleId = useFieldStore((s) => s.setActiveRifleId);

  const [rifles, setRifles] = useState<RifleWithActiveLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const swipeStartX = useRef<number | null>(null);

  const load = useCallback(async () => {
    const data = await getRiflesWithActiveLoad();
    setRifles(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeIdx = rifles.findIndex((r) => r.id === activeRifleId);
  const active = rifles[activeIdx] ?? rifles[0];

  function goNext() {
    if (rifles.length < 2) return;
    const next = rifles[(activeIdx + 1) % rifles.length];
    if (next) setActiveRifleId(next.id);
  }

  function goPrev() {
    if (rifles.length < 2) return;
    const prev = rifles[(activeIdx - 1 + rifles.length) % rifles.length];
    if (prev) setActiveRifleId(prev.id);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10,
      onPanResponderGrant: (evt) => {
        swipeStartX.current = evt.nativeEvent.pageX;
      },
      onPanResponderRelease: (evt) => {
        if (swipeStartX.current === null) return;
        const dx = evt.nativeEvent.pageX - swipeStartX.current;
        if (dx > SWIPE_THRESHOLD) goPrev();
        else if (dx < -SWIPE_THRESHOLD) goNext();
        swipeStartX.current = null;
      },
    }),
  ).current;

  if (loading) {
    return (
      <View style={[styles.container, { borderBottomColor: theme.border }]}>
        <ActivityIndicator size="small" color={theme.dim} />
      </View>
    );
  }

  if (!active) return null;

  const hasLoad = !!active.activeLoad;
  const canCycle = rifles.length > 1;

  return (
    <View
      style={[styles.container, { borderBottomColor: theme.border }]}
      {...panResponder.panHandlers}
    >
      {/* Prev arrow */}
      <Pressable
        onPress={goPrev}
        disabled={!canCycle}
        hitSlop={12}
        accessibilityLabel="Previous rifle"
      >
        <Ionicons
          name="chevron-back"
          size={18}
          color={canCycle ? theme.label : theme.border}
        />
      </Pressable>

      {/* Rifle info */}
      <View style={styles.center}>
        <Text style={[styles.rifleName, { color: theme.primary }]} numberOfLines={1}>
          {active.name}
        </Text>
        <Text style={[styles.rifleDetail, { color: theme.dim }]} numberOfLines={1}>
          {active.caliber}
          {hasLoad
            ? ` · ${Math.round(active.activeLoad!.weightGrains)}gr ${active.activeLoad!.bulletName}`
            : ' · NO LOAD'}
          {canCycle ? `  ${activeIdx + 1}/${rifles.length}` : ''}
        </Text>
      </View>

      {/* Next arrow */}
      <Pressable
        onPress={goNext}
        disabled={!canCycle}
        hitSlop={12}
        accessibilityLabel="Next rifle"
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={canCycle ? theme.label : theme.border}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  rifleName: {
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  rifleDetail: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
