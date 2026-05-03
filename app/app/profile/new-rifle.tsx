/**
 * New Rifle quick-create modal.
 * Minimum viable: name, caliber, drag model, BC, MV.
 * Saves with sensible defaults (100 yd zero, 1.5" scope height, ICAO atmosphere).
 * Full editing available from the profile detail screen after creation.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { upsertRifle, upsertLoad, upsertScope, upsertZero } from '../../src/db/queries';
import { ICAO_STANDARD_ATMOSPHERE } from '@aim/solver';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';
import type { Theme } from '../../src/theme';

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  theme: Theme;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.label }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            color: theme.primary,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.dim}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

function SegmentControl({
  options,
  selected,
  onSelect,
  theme,
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  theme: Theme;
}) {
  return (
    <View style={[styles.segment, { borderColor: theme.border }]}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onSelect(opt)}
          style={[
            styles.segmentOption,
            selected === opt && { backgroundColor: theme.primary },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              { color: selected === opt ? theme.bg : theme.label },
            ]}
          >
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function NewRifleScreen() {
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  const setActiveRifleId = useFieldStore((s) => s.setActiveRifleId);

  const [name, setName] = useState('');
  const [caliber, setCaliber] = useState('');
  const [bulletName, setBulletName] = useState('');
  const [weightGr, setWeightGr] = useState('');
  const [diameterIn, setDiameterIn] = useState('');
  const [dragModel, setDragModel] = useState<'G7' | 'G1'>('G7');
  const [bc, setBc] = useState('');
  const [mv, setMv] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !caliber.trim() || !bc.trim() || !mv.trim()) {
      Alert.alert('Missing fields', 'Name, caliber, BC, and MV are required.');
      return;
    }
    const bcNum = parseFloat(bc);
    const mvNum = parseFloat(mv);
    const wgNum = parseFloat(weightGr) || 175;
    const diaNum = parseFloat(diameterIn) || 0.308;

    if (isNaN(bcNum) || isNaN(mvNum)) {
      Alert.alert('Invalid values', 'BC and MV must be numbers.');
      return;
    }

    setSaving(true);
    try {
      const rifleId = Crypto.randomUUID();
      const loadId = Crypto.randomUUID();
      const scopeId = Crypto.randomUUID();
      const zeroId = Crypto.randomUUID();

      await upsertRifle({
        id: rifleId,
        name: name.trim(),
        caliber: caliber.trim(),
        twistRateIn: null,
        barrelLengthIn: null,
        suppressorEnabled: false,
        notes: null,
      });

      await upsertLoad({
        id: loadId,
        rifleId,
        isActive: true,
        bulletName: bulletName.trim() || 'Custom',
        weightGrains: wgNum,
        diameterInches: diaNum,
        bc: bcNum,
        dragModel,
        muzzleVelocityFps: mvNum,
        powderCharge: null,
        notes: null,
      });

      await upsertScope({
        id: scopeId,
        rifleId,
        name: 'Primary Scope',
        clicksPerMrad: 10,
        turretCapMrad: null,
      });

      await upsertZero({
        id: zeroId,
        loadId,
        scopeId,
        zeroRangeYards: 100,
        scopeHeightInches: 1.5,
        zeroDate: new Date().toISOString().slice(0, 10),
        atmosphericSnapshot: JSON.stringify(ICAO_STANDARD_ATMOSPHERE),
        notes: null,
      });

      setActiveRifleId(rifleId);
      router.back();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.label} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>
            NEW RIFLE
          </Text>
          <Pressable onPress={save} disabled={saving} hitSlop={12}>
            <Text style={[styles.saveBtn, { color: saving ? theme.dim : theme.primary }]}>
              {saving ? 'SAVING…' : 'SAVE'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.section, { color: theme.dim }]}>RIFLE</Text>
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Tikka T3x" theme={theme} />
          <Field label="Caliber" value={caliber} onChangeText={setCaliber} placeholder="e.g. 6.5 PRC" theme={theme} />

          <Text style={[styles.section, { color: theme.dim }]}>LOAD</Text>
          <Field label="Bullet name" value={bulletName} onChangeText={setBulletName} placeholder="e.g. 147gr ELD-M" theme={theme} />
          <Field label="Weight (gr)" value={weightGr} onChangeText={setWeightGr} placeholder="e.g. 147" keyboardType="decimal-pad" theme={theme} />
          <Field label="Diameter (in)" value={diameterIn} onChangeText={setDiameterIn} placeholder="e.g. 0.264" keyboardType="decimal-pad" theme={theme} />

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.label }]}>Drag model</Text>
            <SegmentControl
              options={['G7', 'G1']}
              selected={dragModel}
              onSelect={(v) => setDragModel(v as 'G7' | 'G1')}
              theme={theme}
            />
          </View>

          <Field label="BC (lb/in²)" value={bc} onChangeText={setBc} placeholder="e.g. 0.301" keyboardType="decimal-pad" theme={theme} />
          <Field label="Muzzle velocity (fps)" value={mv} onChangeText={setMv} placeholder="e.g. 2710" keyboardType="decimal-pad" theme={theme} />

          <Text style={[styles.note, { color: theme.dim }]}>
            Defaults: 100 yd zero · 1.5" scope height · ICAO atmosphere.
            Edit these from the profile detail screen.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  saveBtn: { fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  scroll: { padding: 20, gap: 12, paddingBottom: 48 },
  section: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FONT, fontSize: 11, letterSpacing: 0.5 },
  fieldInput: {
    fontFamily: FONT,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: { fontFamily: FONT, fontSize: 13 },
  note: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 16,
  },
});
