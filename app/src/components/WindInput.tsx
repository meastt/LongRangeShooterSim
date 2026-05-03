/**
 * WindInput — wind speed and clock-position entry.
 *
 * Tap the chip to open a full-featured modal:
 *   • Speed presets (0–30 mph) + free-text numeric input
 *   • 12-position clock dial rendered with absolute-positioned buttons
 *   • Live "effective" crosswind display (speed × |sin(angle)|)
 *
 * Tap the unit label (MIL/MOA) on the main HUD to toggle hold units.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldStore } from '../store/fieldStore';
import type { Theme } from '../theme';

interface Props {
  theme: Theme;
}

const SPEED_PRESETS = [0, 5, 10, 15, 20, 25, 30];

const CLOCK_DIAMETER = 220;
const BTN_SIZE = 36;
const RADIUS = 80;
const CENTER = CLOCK_DIAMETER / 2;

/** Direction labels shown around the clock face for hunter reference. */
const CLOCK_LABELS: Record<number, string> = {
  12: 'HEAD',
  3: 'FULL →',
  6: 'TAIL',
  9: '← FULL',
};

function getClockBtnPos(hour: number) {
  // hour 12 = top, 3 = right, 6 = bottom, 9 = left
  const angle = (hour * Math.PI) / 6 - Math.PI / 2;
  return {
    left: CENTER + RADIUS * Math.cos(angle) - BTN_SIZE / 2,
    top: CENTER + RADIUS * Math.sin(angle) - BTN_SIZE / 2,
  };
}

/** Effective crosswind component factor for a given clock position. */
function crosswindFactor(clockPos: number): number {
  const angle = (clockPos / 12) * 2 * Math.PI;
  return Math.abs(Math.sin(angle));
}

export function WindInput({ theme }: Props) {
  const windSpeed = useFieldStore((s) => s.windSpeedMph);
  const clock = useFieldStore((s) => s.windClockPosition);
  const setWind = useFieldStore((s) => s.setWind);

  const [visible, setVisible] = useState(false);
  const [draftSpeed, setDraftSpeed] = useState('');
  const [draftClock, setDraftClock] = useState(clock);

  const openModal = useCallback(() => {
    setDraftSpeed(String(Math.round(windSpeed)));
    setDraftClock(clock);
    setVisible(true);
  }, [windSpeed, clock]);

  function apply() {
    const speed = Math.max(0, Math.min(99, parseFloat(draftSpeed) || 0));
    setWind(speed, draftClock);
    setVisible(false);
  }

  // Arrow rotation: 12 o'clock (0°) = headwind, clockwise.
  const rotation = ((clock - 12) / 12) * 360;

  const effectiveMph = windSpeed * crosswindFactor(clock);

  const draftEffective = (parseFloat(draftSpeed) || 0) * crosswindFactor(draftClock);

  return (
    <>
      {/* Compact chip shown on the Field screen */}
      <Pressable
        style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={openModal}
        accessibilityLabel={`Wind: ${Math.round(windSpeed)} mph at ${clock} o'clock. Tap to adjust.`}
      >
        <View style={styles.chipContent}>
          <Ionicons
            name="arrow-up-outline"
            size={16}
            color={theme.primary}
            style={{ transform: [{ rotate: `${rotation}deg` }] }}
          />
          <Text style={[styles.chipValue, { color: theme.primary }]}>
            {Math.round(windSpeed)}
          </Text>
          <Text style={[styles.chipUnit, { color: theme.dim }]}>MPH</Text>
        </View>
        <Text style={[styles.chipLabel, { color: theme.label }]}>WIND</Text>
      </Pressable>

      {/* Full wind-entry modal */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={[styles.sheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.label} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.primary }]}>WIND INPUT</Text>
              <Pressable onPress={apply} hitSlop={12} accessibilityLabel="Apply wind settings">
                <Text style={[styles.applyBtn, { color: theme.primary }]}>APPLY</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">

              {/* Speed section */}
              <Text style={[styles.sectionLabel, { color: theme.dim }]}>SPEED</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
                {SPEED_PRESETS.map((mph) => {
                  const active = parseInt(draftSpeed, 10) === mph;
                  return (
                    <Pressable
                      key={mph}
                      onPress={() => setDraftSpeed(String(mph))}
                      style={[
                        styles.presetBtn,
                        {
                          backgroundColor: active ? theme.primary : 'transparent',
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.presetText, { color: active ? theme.bg : theme.label }]}>
                        {mph}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.speedInputRow}>
                <TextInput
                  style={[
                    styles.speedInput,
                    {
                      color: theme.primary,
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      fontFamily: 'SpaceMono-Regular',
                    },
                  ]}
                  value={draftSpeed}
                  onChangeText={setDraftSpeed}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.dim}
                  accessibilityLabel="Enter wind speed in mph"
                />
                <Text style={[styles.speedInputUnit, { color: theme.dim }]}>MPH</Text>
              </View>

              {/* Clock position */}
              <Text style={[styles.sectionLabel, { color: theme.dim }]}>DIRECTION (CLOCK POSITION)</Text>

              <View style={styles.clockWrapper}>
                {/* Crosshair centre dot */}
                <View style={[styles.clockCentre, { backgroundColor: theme.border }]} />

                {/* Hour buttons */}
                {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => {
                  const pos = getClockBtnPos(hour);
                  const active = draftClock === hour;
                  const label = CLOCK_LABELS[hour];
                  return (
                    <Pressable
                      key={hour}
                      onPress={() => setDraftClock(hour)}
                      style={[
                        styles.clockBtn,
                        pos,
                        {
                          backgroundColor: active ? theme.primary : theme.bg,
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}
                      accessibilityLabel={`${hour} o'clock${label ? ` — ${label}` : ''}`}
                    >
                      <Text
                        style={[
                          styles.clockBtnText,
                          { color: active ? theme.bg : theme.label },
                        ]}
                      >
                        {hour}
                      </Text>
                    </Pressable>
                  );
                })}

                {/* Cardinal labels */}
                {Object.entries(CLOCK_LABELS).map(([hour, lbl]) => {
                  const h = parseInt(hour, 10);
                  const pos = getClockBtnPos(h);
                  // Place label outside the button ring
                  const labelOffset = 28;
                  const angle = (h * Math.PI) / 6 - Math.PI / 2;
                  const labelPos = {
                    left: CENTER + (RADIUS + labelOffset) * Math.cos(angle) - 30,
                    top: CENTER + (RADIUS + labelOffset) * Math.sin(angle) - 8,
                  };
                  return (
                    <Text
                      key={`lbl-${hour}`}
                      style={[styles.cardinalLabel, labelPos, { color: theme.dim }]}
                      pointerEvents="none"
                    >
                      {lbl}
                    </Text>
                  );
                })}
              </View>

              {/* Effective crosswind */}
              <View style={[styles.effectiveRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.effectiveLabel, { color: theme.dim }]}>EFFECTIVE CROSSWIND</Text>
                <Text style={[styles.effectiveValue, { color: theme.primary }]}>
                  {draftEffective.toFixed(1)} MPH
                </Text>
                <Text style={[styles.effectiveHint, { color: theme.dim }]}>
                  at {draftClock === 12 || draftClock === 6
                    ? 'no'
                    : draftClock === 3 || draftClock === 9
                    ? 'full'
                    : 'partial'}{' '}
                  value
                </Text>
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  // Chip (compact field display)
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
    gap: 2,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipValue: {
    fontFamily: FONT,
    fontSize: 16,
  },
  chipUnit: {
    fontFamily: FONT,
    fontSize: 10,
  },
  chipLabel: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
  },

  // Modal overlay
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetTitle: {
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: 2,
  },
  applyBtn: {
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: 1,
  },
  sheetBody: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 8,
  },

  // Speed presets
  presetsRow: {
    flexGrow: 0,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
  },
  presetText: {
    fontFamily: FONT,
    fontSize: 13,
  },

  // Speed text input
  speedInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedInput: {
    flex: 1,
    fontSize: 24,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  speedInputUnit: {
    fontFamily: FONT,
    fontSize: 13,
  },

  // Clock dial
  clockWrapper: {
    width: CLOCK_DIAMETER,
    height: CLOCK_DIAMETER,
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  clockCentre: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    left: CENTER - 3,
    top: CENTER - 3,
  },
  clockBtn: {
    position: 'absolute',
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockBtnText: {
    fontFamily: FONT,
    fontSize: 11,
  },
  cardinalLabel: {
    position: 'absolute',
    fontFamily: FONT,
    fontSize: 8,
    letterSpacing: 0.5,
    width: 60,
    textAlign: 'center',
  },

  // Effective crosswind
  effectiveRow: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  effectiveLabel: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
    flex: 1,
  },
  effectiveValue: {
    fontFamily: FONT,
    fontSize: 18,
  },
  effectiveHint: {
    fontFamily: FONT,
    fontSize: 10,
  },
});
