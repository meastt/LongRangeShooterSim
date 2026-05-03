/**
 * RangeInput — large numeric range selector for Field Mode.
 *
 * - Tap a preset button (100, 200, … 1000 yd) to jump directly.
 * - Swipe up/down on the display to fine-tune ±1 yd per pixel.
 * - The range is clamped to 0–1760 yd (1 mile) by the field store.
 */
import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  PanResponder,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useFieldStore } from '../store/fieldStore';
import type { Theme } from '../theme';

const PRESETS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

interface Props {
  theme: Theme;
}

export function RangeInput({ theme }: Props) {
  const range = useFieldStore((s) => s.rangeYards);
  const setRange = useFieldStore((s) => s.setRange);
  const lastY = useRef<number | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        lastY.current = evt.nativeEvent.pageY;
      },
      onPanResponderMove: (evt) => {
        if (lastY.current === null) return;
        const dy = lastY.current - evt.nativeEvent.pageY; // positive = swipe up = increase
        const delta = Math.round(dy);
        if (Math.abs(delta) >= 1) {
          setRange(useFieldStore.getState().rangeYards + delta);
          lastY.current = evt.nativeEvent.pageY;
        }
      },
      onPanResponderRelease: () => {
        lastY.current = null;
      },
    }),
  ).current;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {/* Scrub display */}
      <View style={styles.scrubArea} {...panResponder.panHandlers}>
        <Text style={[styles.scrubLabel, { color: theme.label }]}>RANGE</Text>
        <Text style={[styles.scrubValue, { color: theme.primary }]}>
          {Math.round(range)}
        </Text>
        <Text style={[styles.scrubUnit, { color: theme.dim }]}>YD</Text>
        <Text style={[styles.scrubHint, { color: theme.dim }]}>
          ↕ swipe to adjust
        </Text>
      </View>

      {/* Preset buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presets}
      >
        {PRESETS.map((yd) => {
          const active = Math.round(range) === yd;
          return (
            <Pressable
              key={yd}
              onPress={() => setRange(yd)}
              style={[
                styles.presetBtn,
                {
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}
              accessibilityLabel={`Set range to ${yd} yards`}
            >
              <Text
                style={[
                  styles.presetText,
                  { color: active ? theme.bg : theme.label },
                ]}
              >
                {yd}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  scrubArea: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    gap: 8,
  },
  scrubLabel: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 1.5,
    width: 48,
  },
  scrubValue: {
    fontFamily: FONT,
    fontSize: 32,
    letterSpacing: -1,
  },
  scrubUnit: {
    fontFamily: FONT,
    fontSize: 12,
  },
  scrubHint: {
    fontFamily: FONT,
    fontSize: 10,
    marginLeft: 'auto',
  },
  presets: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  presetText: {
    fontFamily: FONT,
    fontSize: 13,
  },
});
