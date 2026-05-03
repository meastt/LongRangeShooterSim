/**
 * WaypointTypeSheet — bottom sheet to select a waypoint type after long-press.
 *
 * Presents 8 waypoint type buttons in a 2×4 grid, then an optional note field.
 * Resolves the type + note via onConfirm, or cancels with onCancel.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { WAYPOINT_CONFIG, type WaypointType } from '../store/waypointStore';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';
const TYPES = Object.keys(WAYPOINT_CONFIG) as WaypointType[];

interface Props {
  visible: boolean;
  theme: Theme;
  onConfirm: (type: WaypointType, note: string) => void;
  onCancel: () => void;
}

export function WaypointTypeSheet({ visible, theme, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<WaypointType>('sighting');
  const [note, setNote] = useState('');

  function handleConfirm() {
    onConfirm(selected, note.trim());
    setNote('');
    setSelected('sighting');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={[styles.cancelBtn, { color: theme.dim }]}>CANCEL</Text>
            </Pressable>
            <Text style={[styles.title, { color: theme.primary }]}>ADD WAYPOINT</Text>
            <Pressable onPress={handleConfirm} hitSlop={12}>
              <Text style={[styles.confirmBtn, { color: theme.primary }]}>DROP</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Type grid */}
            <View style={styles.typeGrid}>
              {TYPES.map((type) => {
                const cfg = WAYPOINT_CONFIG[type];
                const active = selected === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setSelected(type)}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: active ? `${cfg.color}22` : 'transparent',
                        borderColor: active ? cfg.color : theme.border,
                      },
                    ]}
                    accessibilityLabel={`Select ${cfg.label} waypoint type`}
                  >
                    <Text style={styles.typeEmoji}>{cfg.emoji}</Text>
                    <Text style={[styles.typeLabel, { color: active ? cfg.color : theme.dim }]}>
                      {cfg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional note */}
            <Text style={[styles.noteLabel, { color: theme.dim }]}>NOTE (optional)</Text>
            <TextInput
              style={[styles.noteInput, { color: theme.label, borderColor: theme.border, backgroundColor: theme.bg }]}
              value={note}
              onChangeText={setNote}
              placeholder="Species, count, conditions…"
              placeholderTextColor={theme.dim}
              multiline
              numberOfLines={2}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontFamily: FONT,
    fontSize: 12,
    letterSpacing: 2,
  },
  cancelBtn: {
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: 1,
  },
  confirmBtn: {
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 8,
    gap: 4,
  },
  typeEmoji: {
    fontSize: 22,
  },
  typeLabel: {
    fontFamily: FONT,
    fontSize: 7,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  noteLabel: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  noteInput: {
    fontFamily: FONT,
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
    textAlignVertical: 'top',
  },
});
