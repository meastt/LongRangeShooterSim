/**
 * Profile detail screen — view a rifle profile, toggle suppressor, log cold-bore events,
 * and launch the MV Truing Wizard.
 *
 * Sections:
 *   RIFLE       — name, caliber, twist, barrel, suppressor toggle
 *   ACTIVE LOAD — bullet, weight, diameter, BC, MV + TUNE MV button
 *   SCOPE       — name, click value, turret cap
 *   ZERO        — range, scope height, date, atmosphere at zero
 *   COLD-BORE LOG — list of first-shot events + "+ LOG" button
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  getFieldProfile,
  deleteRifle,
  updateSuppressor,
  getColdBoreEvents,
  insertColdBoreEvent,
} from '../../src/db/queries';
import type { FieldProfile, ColdBoreEventRow } from '../../src/db/queries';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';
import type { Theme } from '../../src/theme';
import { MVTruingWizard } from '../../src/components/Truing/MVTruingWizard';
import { DSFTruingWizard } from '../../src/components/Truing/DSFTruingWizard';
import { TallTargetWizard } from '../../src/components/Truing/TallTargetWizard';
import { ProfileShare } from '../../src/components/ProfileShare';

const FONT = 'SpaceMono-Regular';

// ─── Small presentation helpers ───────────────────────────────────────────────

function Row({
  label,
  value,
  theme,
}: {
  label: string;
  value: string | null | undefined;
  theme: Theme;
}) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.dim }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.label }]}>{value}</Text>
    </View>
  );
}

/** A row that renders a Switch at the right edge for boolean settings. */
function SwitchRow({
  label,
  value,
  onToggle,
  theme,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  theme: Theme;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.dim }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={value ? theme.bg : theme.label}
      />
    </View>
  );
}

// ─── Cold-bore log row ────────────────────────────────────────────────────────

function ColdBoreRow({ event, theme }: { event: ColdBoreEventRow; theme: Theme }) {
  const sign = event.firstShotOffsetMrad >= 0 ? '+' : '';
  return (
    <View style={[styles.coldBoreRow, { borderBottomColor: theme.border }]}>
      <View style={styles.coldBoreLeft}>
        <Text style={[styles.coldBoreDate, { color: theme.label }]}>
          {event.date.slice(0, 10)}
        </Text>
        {event.tempFahrenheit != null && (
          <Text style={[styles.coldBoreMeta, { color: theme.dim }]}>
            {Math.round(event.tempFahrenheit)}°F
          </Text>
        )}
        {event.notes ? (
          <Text style={[styles.coldBoreMeta, { color: theme.dim }]} numberOfLines={1}>
            {event.notes}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.coldBoreOffset, { color: theme.primary }]}>
        {sign}{event.firstShotOffsetMrad.toFixed(2)}{' '}
        <Text style={{ fontSize: 11 }}>MIL</Text>
      </Text>
    </View>
  );
}

// ─── Log cold bore modal ──────────────────────────────────────────────────────

function LogColdBoreModal({
  rifleId,
  theme,
  onSave,
  onClose,
}: {
  rifleId: string;
  theme: Theme;
  onSave: () => void;
  onClose: () => void;
}) {
  const [offset, setOffset] = useState('');
  const [temp, setTemp] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const offsetNum = parseFloat(offset);
    if (isNaN(offsetNum)) {
      Alert.alert('Invalid offset', 'Enter a signed decimal value in milliradians (e.g. -0.25).');
      return;
    }
    setSaving(true);
    try {
      await insertColdBoreEvent({
        id: Crypto.randomUUID(),
        rifleId,
        date: new Date().toISOString().slice(0, 10),
        firstShotOffsetMrad: offsetNum,
        tempFahrenheit: parseFloat(temp) || null,
        notes: notes.trim() || null,
      });
      onSave();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.label} />
            </Pressable>
            <Text style={[styles.sheetTitle, { color: theme.primary }]}>LOG COLD BORE</Text>
            <Pressable onPress={save} disabled={saving} hitSlop={12}>
              <Text style={[styles.applyBtn, { color: saving ? theme.dim : theme.primary }]}>
                {saving ? 'SAVING…' : 'SAVE'}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.hint, { color: theme.dim }]}>
              Log the first-shot point-of-impact offset from your confirmed zero.
              Positive = high, negative = low.
            </Text>

            <View style={styles.logField}>
              <Text style={[styles.logFieldLabel, { color: theme.label }]}>
                First-shot offset (MIL)
              </Text>
              <TextInput
                style={[styles.logFieldInput, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={offset}
                onChangeText={setOffset}
                placeholder="-0.25"
                placeholderTextColor={theme.dim}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
              />
            </View>

            <View style={styles.logField}>
              <Text style={[styles.logFieldLabel, { color: theme.label }]}>
                Temperature at time of shot (°F) — optional
              </Text>
              <TextInput
                style={[styles.logFieldInput, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={temp}
                onChangeText={setTemp}
                placeholder="e.g. 28"
                placeholderTextColor={theme.dim}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.logField}>
              <Text style={[styles.logFieldLabel, { color: theme.label }]}>Notes — optional</Text>
              <TextInput
                style={[
                  styles.logFieldInput,
                  styles.logFieldTextarea,
                  { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Heavy frost, cold barrel 45 min"
                placeholderTextColor={theme.dim}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileDetailScreen() {
  const { rifleId } = useLocalSearchParams<{ rifleId: string }>();
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const setActiveRifleId = useFieldStore((s) => s.setActiveRifleId);

  const [profile, setProfile] = useState<FieldProfile | null>(null);
  const [coldBoreEvents, setColdBoreEvents] = useState<ColdBoreEventRow[]>([]);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [truingVisible, setTruingVisible] = useState(false);
  const [dsfVisible, setDsfVisible] = useState(false);
  const [tallTargetVisible, setTallTargetVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!rifleId) return;
    const [p, events] = await Promise.all([
      getFieldProfile(rifleId),
      getColdBoreEvents(rifleId),
    ]);
    setProfile(p);
    setColdBoreEvents(events);
  }, [rifleId]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

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

  async function handleToggleSuppressor() {
    if (!profile || !rifleId) return;
    const newVal = !profile.rifle.suppressorEnabled;
    await updateSuppressor(rifleId, newVal);
    // Optimistically update local state
    setProfile({ ...profile, rifle: { ...profile.rifle, suppressorEnabled: newVal } });
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

  const { rifle, load: profileLoad, scope, zero } = profile;
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
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push(`/profile/edit?rifleId=${rifleId}`)}
            hitSlop={12}
            style={[styles.dopeBtn, { borderColor: theme.dim }]}
            accessibilityLabel="Edit this rifle profile"
          >
            <Ionicons name="create-outline" size={14} color={theme.dim} />
            <Text style={[styles.dopeBtnText, { color: theme.dim }]}>EDIT</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/profile/dope?rifleId=${rifleId}`)}
            hitSlop={12}
            style={[styles.dopeBtn, { borderColor: theme.primary }]}
            accessibilityLabel="View DOPE card for this rifle"
          >
            <Ionicons name="list-outline" size={14} color={theme.primary} />
            <Text style={[styles.dopeBtnText, { color: theme.primary }]}>DOPE</Text>
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12}>
            <Ionicons name="trash-outline" size={20} color={theme.dim} />
          </Pressable>
        </View>
      </View>


      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Rifle */}
        <Text style={[styles.section, { color: theme.dim }]}>RIFLE</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Name" value={rifle.name} theme={theme} />
          <Row label="Caliber" value={rifle.caliber} theme={theme} />
          <Row label="Twist rate" value={rifle.twistRateIn ? `1:${rifle.twistRateIn}"` : undefined} theme={theme} />
          <Row label="Barrel" value={rifle.barrelLengthIn ? `${rifle.barrelLengthIn}"` : undefined} theme={theme} />
          <SwitchRow
            label="Suppressor"
            value={rifle.suppressorEnabled ?? false}
            onToggle={handleToggleSuppressor}
            theme={theme}
          />
        </View>

        {/* Load */}
        <View style={styles.coldBoreHeader}>
          <Text style={[styles.section, { color: theme.dim, marginTop: 0 }]}>ACTIVE LOAD</Text>
          <View style={styles.actionBtns}>
            <Pressable
              onPress={() => setTruingVisible(true)}
              style={[styles.logBtn, { borderColor: theme.dim }]}
              accessibilityLabel="Open MV truing wizard"
            >
              <Ionicons name="options-outline" size={14} color={theme.dim} />
              <Text style={[styles.logBtnText, { color: theme.dim }]}>MV</Text>
            </Pressable>
            <Pressable
              onPress={() => setDsfVisible(true)}
              style={[styles.logBtn, { borderColor: theme.dim }]}
              accessibilityLabel="Open DSF truing wizard"
            >
              <Ionicons name="analytics-outline" size={14} color={theme.dim} />
              <Text style={[styles.logBtnText, { color: theme.dim }]}>DSF</Text>
            </Pressable>
            <Pressable
              onPress={() => setShareVisible(true)}
              style={[styles.logBtn, { borderColor: theme.primary }]}
              accessibilityLabel="Share profile as QR code"
            >
              <Ionicons name="qr-code-outline" size={14} color={theme.primary} />
              <Text style={[styles.logBtnText, { color: theme.primary }]}>SHARE</Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Bullet" value={profileLoad.bulletName} theme={theme} />
          <Row label="Weight" value={`${profileLoad.weightGrains} gr`} theme={theme} />
          <Row label="Diameter" value={`${profileLoad.diameterInches}"`} theme={theme} />
          <Row label="BC" value={`${profileLoad.bc} (${profileLoad.dragModel})`} theme={theme} />
          <Row label="Muzzle velocity" value={`${profileLoad.muzzleVelocityFps} fps`} theme={theme} />
        </View>

        {/* Scope */}
        <View style={styles.coldBoreHeader}>
          <Text style={[styles.section, { color: theme.dim, marginTop: 0 }]}>SCOPE</Text>
          <Pressable
            onPress={() => setTallTargetVisible(true)}
            style={[styles.logBtn, { borderColor: theme.dim }]}
            accessibilityLabel="Open tall-target tracking test"
          >
            <Ionicons name="scan-outline" size={14} color={theme.dim} />
            <Text style={[styles.logBtnText, { color: theme.dim }]}>TRACK TEST</Text>
          </Pressable>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Name" value={scope.name} theme={theme} />
          <Row label="Click value" value={`${scope.clicksPerMrad} clicks/mrad`} theme={theme} />
          <Row label="Turret cap" value={scope.turretCapMrad ? `${scope.turretCapMrad} mrad` : 'Not set'} theme={theme} />
        </View>

        {/* Zero */}
        <Text style={[styles.section, { color: theme.dim }]}>ZERO</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Zero range" value={`${zero.zeroRangeYards} yd`} theme={theme} />
          <Row label="Scope height" value={`${zero.scopeHeightInches}"`} theme={theme} />
          <Row label="Date" value={zero.zeroDate} theme={theme} />
          <Row label="Temp" value={`${atmo.temperatureFahrenheit}°F`} theme={theme} />
          <Row label="Pressure" value={`${atmo.pressureInHg} inHg`} theme={theme} />
          <Row label="Humidity" value={`${atmo.relativeHumidityPct}%`} theme={theme} />
        </View>

        {/* Cold-bore log */}
        <View style={styles.coldBoreHeader}>
          <Text style={[styles.section, { color: theme.dim, marginTop: 0 }]}>COLD-BORE LOG</Text>
          <Pressable
            onPress={() => setLogModalVisible(true)}
            style={[styles.logBtn, { borderColor: theme.primary }]}
            accessibilityLabel="Log a new cold bore event"
          >
            <Ionicons name="add" size={14} color={theme.primary} />
            <Text style={[styles.logBtnText, { color: theme.primary }]}>LOG SHOT</Text>
          </Pressable>
        </View>

        {coldBoreEvents.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.dim, textAlign: 'center' }]}>
              No cold-bore events recorded yet.{'\n'}
              Tap LOG SHOT after your first shot of the day.
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, padding: 0, overflow: 'hidden' }]}>
            {coldBoreEvents.slice(0, 20).map((ev) => (
              <ColdBoreRow key={ev.id} event={ev} theme={theme} />
            ))}
          </View>
        )}

      </ScrollView>

      {/* MV Truing Wizard */}
      {truingVisible && profile && (
        <MVTruingWizard
          profile={profile}
          theme={theme}
          onComplete={() => { setTruingVisible(false); loadProfile(); }}
          onClose={() => setTruingVisible(false)}
        />
      )}

      {/* DSF Truing Wizard */}
      {dsfVisible && profile && (
        <DSFTruingWizard
          profile={profile}
          theme={theme}
          onComplete={() => { setDsfVisible(false); loadProfile(); }}
          onClose={() => setDsfVisible(false)}
        />
      )}

      {/* Tall-Target Test */}
      {tallTargetVisible && profile && (
        <TallTargetWizard
          profile={profile}
          theme={theme}
          onClose={() => setTallTargetVisible(false)}
        />
      )}

      {/* QR Profile Share */}
      {shareVisible && profile && (
        <ProfileShare
          profile={profile}
          theme={theme}
          onClose={() => setShareVisible(false)}
          onImported={() => { setShareVisible(false); loadProfile(); }}
        />
      )}

      {/* Cold-bore log modal */}
      {logModalVisible && (
        <LogColdBoreModal
          rifleId={rifleId!}
          theme={theme}
          onSave={() => {
            setLogModalVisible(false);
            loadProfile();
          }}
          onClose={() => setLogModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dopeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dopeBtnText: { fontFamily: FONT, fontSize: 10, letterSpacing: 1 },
  scroll: { padding: 16, gap: 4, paddingBottom: 48 },
  section: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 6,
  },
  card: { borderRadius: 10, padding: 14, gap: 10, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    minHeight: 28,
  },
  rowLabel: { fontFamily: FONT, fontSize: 11 },
  rowValue: { fontFamily: FONT, fontSize: 12, textAlign: 'right', flex: 1 },

  // Cold-bore
  coldBoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 6,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logBtnText: { fontFamily: FONT, fontSize: 10, letterSpacing: 1 },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coldBoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  coldBoreLeft: { flex: 1, gap: 2 },
  coldBoreDate: { fontFamily: FONT, fontSize: 12 },
  coldBoreMeta: { fontFamily: FONT, fontSize: 10 },
  coldBoreOffset: { fontFamily: FONT, fontSize: 20 },

  // Modal
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
  sheetTitle: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  applyBtn: { fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  sheetBody: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 24,
  },
  hint: { fontFamily: FONT, fontSize: 11, lineHeight: 18 },
  logField: { gap: 6 },
  logFieldLabel: { fontFamily: FONT, fontSize: 10, letterSpacing: 1 },
  logFieldInput: {
    fontFamily: FONT,
    fontSize: 20,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logFieldTextarea: {
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
  },

  // Empty states
  empty: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
