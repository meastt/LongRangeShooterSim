/**
 * Offers applying a chronograph MV sample to the active load.
 * Spec: docs/specs/ble-supervisor.md — never silent overwrite.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useBleSupervisor } from '../ble/supervisor';
import { useFieldStore } from '../store/fieldStore';
import { getFieldProfile, upsertLoad } from '../db/queries';
import type { Theme } from '../theme';

interface Props {
  theme: Theme;
}

export function BleChronoBanner({ theme }: Props) {
  const pending = useBleSupervisor((s) => s.pendingChrono);
  const clearPendingChrono = useBleSupervisor((s) => s.clearPendingChrono);
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const bumpProfileEpoch = useFieldStore((s) => s.bumpProfileEpoch);
  const [busy, setBusy] = useState(false);

  if (!pending) return null;

  async function apply() {
    if (!activeRifleId) {
      Alert.alert('No rifle', 'Select a rifle profile before applying chronograph MV.');
      return;
    }
    setBusy(true);
    try {
      const profile = await getFieldProfile(activeRifleId);
      if (!profile) {
        Alert.alert('Incomplete profile', 'Active rifle needs a load before MV can be saved.');
        return;
      }
      const { createdAt: _c, updatedAt: _u, ...load } = profile.load;
      await upsertLoad({
        ...load,
        muzzleVelocityFps: pending!.mvFps,
      });
      clearPendingChrono();
      bumpProfileEpoch();
      Alert.alert(
        'MV updated',
        `Active load set to ${Math.round(pending!.mvFps)} fps from chronograph. Verify against your trueing notes before hunting use.`,
      );
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.primary }]}>CHRONO SAMPLE</Text>
        <Text style={[styles.value, { color: theme.label }]}>
          {Math.round(pending.mvFps)} fps
        </Text>
        <Text style={[styles.hint, { color: theme.dim }]}>
          Estimated from BLE — you are responsible for verifying before hunting use.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.primary, minHeight: 56, minWidth: 72 }]}
          onPress={() => void apply()}
          disabled={busy}
          accessibilityLabel="Apply chronograph muzzle velocity to active load"
        >
          <Text style={[styles.btnText, { color: theme.bg }]}>APPLY</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, { borderColor: theme.border, borderWidth: 1, minHeight: 56, minWidth: 72 }]}
          onPress={clearPendingChrono}
          accessibilityLabel="Dismiss chronograph sample"
        >
          <Text style={[styles.btnText, { color: theme.label }]}>SKIP</Text>
        </Pressable>
      </View>
    </View>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  value: {
    fontFamily: FONT,
    fontSize: 22,
    marginTop: 4,
  },
  hint: {
    fontFamily: FONT,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  actions: {
    gap: 8,
  },
  btn: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnText: {
    fontFamily: FONT,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
});
