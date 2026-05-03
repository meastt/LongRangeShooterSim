/**
 * Edit Rifle screen — full editing of all rifle properties.
 *
 * Reached via Profile Detail → [edit icon], or directly from new-rifle
 * flow for advanced users. Pre-populates from current profile data.
 *
 * Sections:
 *   RIFLE    — name, caliber, twist rate, barrel length, notes
 *   LOAD     — bullet name, weight, diameter, BC, drag model, MV, powder charge
 *   SCOPE    — name, clicks/mrad, turret cap mrad
 *   ZERO     — zero range, scope height, zero date, atmosphere
 */
import React, { useCallback, useState } from 'react';
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
  Switch,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getFieldProfile,
  upsertRifle,
  upsertLoad,
  upsertScope,
  upsertZero,
} from '../../src/db/queries';
import type { FieldProfile } from '../../src/db/queries';
import { ICAO_STANDARD_ATMOSPHERE } from '@aim/solver';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';
import type { Theme } from '../../src/theme';

const FONT = 'SpaceMono-Regular';

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  hint,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'numbers-and-punctuation';
  hint?: string;
  theme: Theme;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.label }]}>{label}</Text>
      {hint && <Text style={[styles.fieldHint, { color: theme.dim }]}>{hint}</Text>}
      <TextInput
        style={[styles.fieldInput, { color: theme.primary, backgroundColor: theme.surface, borderColor: theme.border }]}
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
          style={[styles.segmentOption, selected === opt && { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.segmentText, { color: selected === opt ? theme.bg : theme.label }]}>
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionHeader({ label, theme }: { label: string; theme: Theme }) {
  return <Text style={[styles.section, { color: theme.dim }]}>{label}</Text>;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function EditRifleScreen() {
  const { rifleId } = useLocalSearchParams<{ rifleId: string }>();
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);

  const [profile, setProfile] = useState<FieldProfile | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Rifle fields ────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [caliber, setCaliber] = useState('');
  const [twistRate, setTwistRate] = useState('');
  const [barrelLength, setBarrelLength] = useState('');
  const [rifleNotes, setRifleNotes] = useState('');

  // ── Load fields ─────────────────────────────────────────────────────────────
  const [bulletName, setBulletName] = useState('');
  const [weightGr, setWeightGr] = useState('');
  const [diameterIn, setDiameterIn] = useState('');
  const [bc, setBc] = useState('');
  const [dragModel, setDragModel] = useState<'G7' | 'G1'>('G7');
  const [mv, setMv] = useState('');
  const [powderCharge, setPowderCharge] = useState('');

  // ── Scope fields ─────────────────────────────────────────────────────────────
  const [scopeName, setScopeName] = useState('');
  const [clicksPerMrad, setClicksPerMrad] = useState('');
  const [turretCapMrad, setTurretCapMrad] = useState('');

  // ── Zero fields ─────────────────────────────────────────────────────────────
  const [zeroRange, setZeroRange] = useState('');
  const [scopeHeight, setScopeHeight] = useState('');
  const [zeroDate, setZeroDate] = useState('');
  const [tempF, setTempF] = useState('');
  const [pressureInHg, setPressureInHg] = useState('');
  const [humidityPct, setHumidityPct] = useState('');

  useFocusEffect(useCallback(() => {
    if (!rifleId) return;
    getFieldProfile(rifleId).then((p) => {
      if (!p) return;
      setProfile(p);

      setName(p.rifle.name);
      setCaliber(p.rifle.caliber);
      setTwistRate(p.rifle.twistRateIn != null ? String(p.rifle.twistRateIn) : '');
      setBarrelLength(p.rifle.barrelLengthIn != null ? String(p.rifle.barrelLengthIn) : '');
      setRifleNotes(p.rifle.notes ?? '');

      setBulletName(p.load.bulletName);
      setWeightGr(String(p.load.weightGrains));
      setDiameterIn(String(p.load.diameterInches));
      setBc(String(p.load.bc));
      setDragModel(p.load.dragModel as 'G7' | 'G1');
      setMv(String(p.load.muzzleVelocityFps));
      setPowderCharge(p.load.powderCharge ?? '');

      setScopeName(p.scope.name);
      setClicksPerMrad(String(p.scope.clicksPerMrad));
      setTurretCapMrad(p.scope.turretCapMrad != null ? String(p.scope.turretCapMrad) : '');

      setZeroRange(String(p.zero.zeroRangeYards));
      setScopeHeight(String(p.zero.scopeHeightInches));
      setZeroDate(p.zero.zeroDate);
      const atmo = p.atmosphericSnapshot;
      setTempF(String(Math.round(atmo.temperatureFahrenheit as number)));
      setPressureInHg(String((atmo.pressureInHg as number).toFixed(2)));
      setHumidityPct(String(atmo.relativeHumidityPct));
    });
  }, [rifleId]));

  async function save() {
    if (!profile || !rifleId) return;
    const bcNum = parseFloat(bc);
    const mvNum = parseFloat(mv);
    const wgNum = parseFloat(weightGr);
    const diaNum = parseFloat(diameterIn);
    const cpmNum = parseFloat(clicksPerMrad);
    const zrNum = parseFloat(zeroRange);
    const shNum = parseFloat(scopeHeight);
    const tempNum = parseFloat(tempF);
    const pressNum = parseFloat(pressureInHg);
    const humNum = parseFloat(humidityPct);

    if (!name.trim() || !caliber.trim()) {
      Alert.alert('Required', 'Name and caliber are required.');
      return;
    }
    if ([bcNum, mvNum, wgNum, diaNum, cpmNum, zrNum, shNum].some(isNaN)) {
      Alert.alert('Invalid numbers', 'Check BC, MV, weight, diameter, clicks/mrad, zero range, and scope height.');
      return;
    }

    setSaving(true);
    try {
      await upsertRifle({
        id: rifleId,
        name: name.trim(),
        caliber: caliber.trim(),
        twistRateIn: twistRate ? parseFloat(twistRate) : null,
        barrelLengthIn: barrelLength ? parseFloat(barrelLength) : null,
        suppressorEnabled: profile.rifle.suppressorEnabled,
        notes: rifleNotes.trim() || null,
      });

      await upsertLoad({
        id: profile.load.id,
        rifleId,
        isActive: true,
        bulletName: bulletName.trim() || 'Custom',
        weightGrains: wgNum,
        diameterInches: diaNum,
        bc: bcNum,
        dragModel,
        muzzleVelocityFps: mvNum,
        powderCharge: powderCharge.trim() || null,
        notes: profile.load.notes ?? null,
      });

      await upsertScope({
        id: profile.scope.id,
        rifleId,
        name: scopeName.trim() || 'Primary Scope',
        clicksPerMrad: cpmNum,
        turretCapMrad: turretCapMrad ? parseFloat(turretCapMrad) : null,
      });

      const atmoSnap = !isNaN(tempNum) && !isNaN(pressNum) && !isNaN(humNum)
        ? { temperatureFahrenheit: tempNum, pressureInHg: pressNum, relativeHumidityPct: humNum }
        : ICAO_STANDARD_ATMOSPHERE;

      await upsertZero({
        id: profile.zero.id,
        loadId: profile.load.id,
        scopeId: profile.scope.id,
        zeroRangeYards: zrNum,
        scopeHeightInches: shNum,
        zeroDate: zeroDate || new Date().toISOString().slice(0, 10),
        atmosphericSnapshot: JSON.stringify(atmoSnap),
        notes: profile.zero.notes ?? null,
      });

      router.back();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: theme.dim }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.label} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>EDIT PROFILE</Text>
          <Pressable onPress={save} disabled={saving} hitSlop={12}>
            <Text style={[styles.saveBtn, { color: saving ? theme.dim : theme.primary }]}>
              {saving ? 'SAVING…' : 'SAVE'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <SectionHeader label="RIFLE" theme={theme} />
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Tikka T3x CTR" theme={theme} />
          <Field label="Caliber" value={caliber} onChangeText={setCaliber} placeholder="e.g. 6.5 Creedmoor" theme={theme} />
          <Field label="Twist rate (in)" value={twistRate} onChangeText={setTwistRate} placeholder={'e.g. 8 (= 1:8")'} keyboardType="decimal-pad" theme={theme} />
          <Field label="Barrel length (in)" value={barrelLength} onChangeText={setBarrelLength} placeholder="e.g. 24" keyboardType="decimal-pad" theme={theme} />
          <Field label="Notes (optional)" value={rifleNotes} onChangeText={setRifleNotes} placeholder="e.g. Timney trigger, 2.5 lb" theme={theme} />

          <SectionHeader label="ACTIVE LOAD" theme={theme} />
          <Field label="Bullet name" value={bulletName} onChangeText={setBulletName} placeholder="e.g. Hornady 147gr ELD-M" theme={theme} />
          <Field label="Weight (gr)" value={weightGr} onChangeText={setWeightGr} placeholder="e.g. 147" keyboardType="decimal-pad" theme={theme} />
          <Field label="Diameter (in)" value={diameterIn} onChangeText={setDiameterIn} placeholder="e.g. 0.264" keyboardType="decimal-pad" theme={theme} />
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.label }]}>Drag model</Text>
            <SegmentControl options={['G7', 'G1']} selected={dragModel} onSelect={(v) => setDragModel(v as 'G7' | 'G1')} theme={theme} />
          </View>
          <Field
            label="BC (lb/in²)"
            value={bc}
            onChangeText={setBc}
            placeholder="e.g. 0.301"
            keyboardType="decimal-pad"
            hint="G7 BC from Berger / Hornady / Sierra data"
            theme={theme}
          />
          <Field label="Muzzle velocity (fps)" value={mv} onChangeText={setMv} placeholder="e.g. 2710" keyboardType="decimal-pad" theme={theme} />
          <Field label="Powder charge (optional)" value={powderCharge} onChangeText={setPowderCharge} placeholder="e.g. 41.5gr H4350" theme={theme} />

          <SectionHeader label="SCOPE" theme={theme} />
          <Field label="Scope name" value={scopeName} onChangeText={setScopeName} placeholder="e.g. Nightforce NX8 4-32x50" theme={theme} />
          <Field
            label="Clicks per mrad"
            value={clicksPerMrad}
            onChangeText={setClicksPerMrad}
            placeholder="e.g. 10"
            keyboardType="decimal-pad"
            hint="10 = 0.1 mrad/click (most modern scopes). 4 = 1/4 MOA."
            theme={theme}
          />
          <Field
            label="Turret cap (mrad, optional)"
            value={turretCapMrad}
            onChangeText={setTurretCapMrad}
            placeholder="e.g. 10"
            keyboardType="decimal-pad"
            hint="Total elevation travel before re-indexing required."
            theme={theme}
          />

          <SectionHeader label="ZERO" theme={theme} />
          <Field label="Zero range (yd)" value={zeroRange} onChangeText={setZeroRange} placeholder="e.g. 100" keyboardType="decimal-pad" theme={theme} />
          <Field label="Scope height (in)" value={scopeHeight} onChangeText={setScopeHeight} placeholder="e.g. 1.5" keyboardType="decimal-pad" hint="Center of objective to center of bore." theme={theme} />
          <Field label="Zero date (YYYY-MM-DD)" value={zeroDate} onChangeText={setZeroDate} placeholder={new Date().toISOString().slice(0, 10)} theme={theme} />

          <SectionHeader label="ATMOSPHERE AT ZERO" theme={theme} />
          <Text style={[styles.atmoHint, { color: theme.dim }]}>
            Conditions when the rifle was zeroed. Used for atmospheric correction.
            Leave blank to use ICAO standard ({String(ICAO_STANDARD_ATMOSPHERE.temperatureFahrenheit)}°F / {String(ICAO_STANDARD_ATMOSPHERE.pressureInHg)} inHg).
          </Text>
          <Field label="Temperature (°F)" value={tempF} onChangeText={setTempF} placeholder="59" keyboardType="decimal-pad" theme={theme} />
          <Field label="Station pressure (inHg)" value={pressureInHg} onChangeText={setPressureInHg} placeholder="29.92" keyboardType="decimal-pad" theme={theme} />
          <Field label="Relative humidity (%)" value={humidityPct} onChangeText={setHumidityPct} placeholder="50" keyboardType="decimal-pad" theme={theme} />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 13 },
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
  section: { fontFamily: FONT, fontSize: 10, letterSpacing: 2, marginTop: 12, marginBottom: 2 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FONT, fontSize: 11, letterSpacing: 0.5 },
  fieldHint: { fontFamily: FONT, fontSize: 10, lineHeight: 15 },
  fieldInput: {
    fontFamily: FONT,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  segmentOption: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontFamily: FONT, fontSize: 13 },
  atmoHint: { fontFamily: FONT, fontSize: 10, lineHeight: 16, marginBottom: 4 },
});
