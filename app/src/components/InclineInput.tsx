/**
 * InclineInput — line-of-sight incline (°). + = uphill.
 * Compact chip matching WindInput / AtmoInput Field Mode pattern.
 * Spec: docs/specs/solver-advanced-corrections.md §4.6
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldStore } from '../store/fieldStore';
import type { Theme } from '../theme';

interface Props {
  theme: Theme;
}

const PRESETS = [-30, -15, 0, 15, 30];

export function InclineInput({ theme }: Props) {
  const inclineDeg = useFieldStore((s) => s.inclineDeg);
  const setInclineDeg = useFieldStore((s) => s.setInclineDeg);

  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');

  const openModal = useCallback(() => {
    setDraft(String(Math.round(inclineDeg)));
    setVisible(true);
  }, [inclineDeg]);

  function apply() {
    const n = parseFloat(draft);
    setInclineDeg(Number.isFinite(n) ? n : 0);
    setVisible(false);
  }

  const label =
    inclineDeg === 0
      ? 'FLAT'
      : `${inclineDeg > 0 ? '+' : ''}${Math.round(inclineDeg)}°`;

  return (
    <>
      <Pressable
        style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={openModal}
        accessibilityLabel={`Incline: ${label}. Tap to adjust.`}
      >
        <View style={styles.chipContent}>
          <Ionicons name="swap-vertical-outline" size={16} color={theme.dim} />
          <View>
            <Text style={[styles.chipLabel, { color: theme.dim }]}>INCLINE</Text>
            <Text style={[styles.chipValue, { color: theme.primary }]}>{label}</Text>
          </View>
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.label }]}>LINE-OF-SIGHT INCLINE</Text>
            <Text style={[styles.hint, { color: theme.dim }]}>
              Degrees from horizontal. + uphill · − downhill. Elev hold scaled by cos(angle).
            </Text>

            <View style={styles.presets}>
              {PRESETS.map((d) => {
                const active = Math.round(parseFloat(draft) || 0) === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDraft(String(d))}
                    style={[
                      styles.preset,
                      {
                        backgroundColor: active ? theme.primary : theme.surface,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                    accessibilityLabel={`Set incline to ${d} degrees`}
                  >
                    <Text style={{ color: active ? theme.bg : theme.label, fontFamily: FONT, fontSize: 13 }}>
                      {d > 0 ? `+${d}` : String(d)}°
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={draft}
              onChangeText={setDraft}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, { color: theme.primary, borderColor: theme.border, backgroundColor: theme.surface }]}
              placeholder="0"
              placeholderTextColor={theme.dim}
              accessibilityLabel="Incline degrees"
            />

            <Pressable
              onPress={apply}
              style={[styles.apply, { backgroundColor: theme.primary }]}
              accessibilityLabel="Apply incline"
            >
              <Text style={[styles.applyText, { color: theme.bg }]}>APPLY</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipLabel: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  chipValue: {
    fontFamily: FONT,
    fontSize: 16,
    marginTop: 2,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: FONT,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  hint: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 16,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    minHeight: 56,
    minWidth: 56,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontFamily: FONT,
    fontSize: 28,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  apply: {
    minHeight: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: FONT,
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '700',
  },
});
