/**
 * Settings screen — pre-hunt readiness checklist + app configuration.
 *
 * Checklist items:
 *   ✓ Active rifle profile set
 *   ✓ Zero date < 30 days (warn if stale)
 *   ✓ Atmospheric data < 2 hours old (from weather cache)
 *   ✓ MV truing current (warn if no truing events in cold-bore log)
 *   ✓ Cold-bore logged today (contextual reminder)
 *
 * Phase 2 additions:
 *   ✓ Offline maps downloaded
 *   ✓ Battery > 50% (requires native API, deferred)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';
import { useSolverResult } from '../../src/hooks/useSolverResult';
import { getColdBoreEvents } from '../../src/db/queries';
import { exportBackup, importBackup, getLastBackupMeta } from '../../src/utils/backup';
import type { BackupMeta } from '../../src/utils/backup';
import { loadRegions } from '../../src/utils/offlineRegions';
import type { OfflineRegion } from '../../src/utils/offlineRegions';
import { OfflineRegionPicker } from '../../src/components/OfflineRegionPicker';
import { useProGate, PaywallScreen } from '../../src/components/PaywallScreen';

const FONT = 'SpaceMono-Regular';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

type CheckItem = {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
};

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass: '#22C55E',
  warn: '#F59E0B',
  fail: '#EF4444',
  info: '#6B7280',
};

const STATUS_ICON: Record<CheckStatus, 'checkmark-circle' | 'warning' | 'close-circle' | 'information-circle'> = {
  pass: 'checkmark-circle',
  warn: 'warning',
  fail: 'close-circle',
  info: 'information-circle',
};

function CheckRow({ item, theme }: { item: CheckItem; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.checkRow, { borderBottomColor: theme.border }]}>
      <Ionicons
        name={STATUS_ICON[item.status]}
        size={20}
        color={STATUS_COLOR[item.status]}
        style={styles.checkIcon}
      />
      <View style={styles.checkText}>
        <Text style={[styles.checkLabel, { color: theme.label }]}>{item.label}</Text>
        <Text style={[styles.checkDetail, { color: theme.dim }]}>{item.detail}</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const displayMode = useFieldStore((s) => s.displayMode);
  const cycleDisplayMode = useFieldStore((s) => s.cycleDisplayMode);
  const holdUnit = useFieldStore((s) => s.holdUnit);
  const toggleHoldUnit = useFieldStore((s) => s.toggleHoldUnit);
  const activeRifleId = useFieldStore((s) => s.activeRifleId);
  const theme = useTheme(displayMode);
  const result = useSolverResult();

  const [coldBoreToday, setColdBoreToday] = useState(false);
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null);
  const [backupWorking, setBackupWorking] = useState(false);
  const [offlineRegions, setOfflineRegions] = useState<OfflineRegion[]>([]);
  const [offlinePickerVisible, setOfflinePickerVisible] = useState(false);

  const { isPro, showPaywall, PaywallModal } = useProGate(theme);

  const today = new Date().toISOString().slice(0, 10);

  useFocusEffect(useCallback(() => {
    if (!activeRifleId) { setColdBoreToday(false); return; }
    getColdBoreEvents(activeRifleId).then((events) => {
      setColdBoreToday(events.some((e) => e.date === today));
    });
    getLastBackupMeta().then(setBackupMeta);
    loadRegions().then(setOfflineRegions);
  }, [activeRifleId, today]));

  async function handleExport() {
    setBackupWorking(true);
    try {
      await exportBackup();
      const meta = await getLastBackupMeta();
      setBackupMeta(meta);
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setBackupWorking(false);
    }
  }

  async function handleImport() {
    setBackupWorking(true);
    try {
      const result = await importBackup();
      if (result === null) return; // cancelled
      Alert.alert(
        'Import complete',
        `Imported ${result.riflesImported} rifle(s), ${result.loadsImported} load(s), ${result.scopesImported} scope(s), ${result.zerosImported} zero(s).`,
      );
    } catch (e) {
      Alert.alert('Import failed', String(e));
    } finally {
      setBackupWorking(false);
    }
  }

  // ─── Build checklist ─────────────────────────────────────────────────────────

  const checks: CheckItem[] = [];

  // 1. Active rifle
  if (activeRifleId && result) {
    checks.push({
      id: 'rifle',
      label: 'Active rifle profile',
      detail: result.profile.rifle.name,
      status: 'pass',
    });
  } else {
    checks.push({
      id: 'rifle',
      label: 'Active rifle profile',
      detail: 'No rifle selected — go to Profiles.',
      status: 'fail',
    });
  }

  // 2. Zero freshness
  if (result) {
    const zeroDate = new Date(result.profile.zero.zeroDate ?? 0);
    const ageMs = Date.now() - zeroDate.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const ageLabel =
      ageDays < 1 ? 'Today' :
      ageDays < 30 ? `${Math.floor(ageDays)} days ago` :
      `${Math.floor(ageDays)} days ago — consider re-zeroing`;
    checks.push({
      id: 'zero',
      label: 'Zero freshness',
      detail: `Zeroed: ${result.profile.zero.zeroDate ?? 'unknown'} (${ageLabel})`,
      status: ageDays > 60 ? 'fail' : ageDays > 30 ? 'warn' : 'pass',
    });
  } else {
    checks.push({ id: 'zero', label: 'Zero freshness', detail: 'No profile active.', status: 'info' });
  }

  // 3. Atmospheric data
  const override = useFieldStore.getState().atmosphericOverride;
  checks.push({
    id: 'atmo',
    label: 'Atmospheric data',
    detail: override
      ? `Manual override active — ${Math.round(override.temperatureFahrenheit as number)}°F`
      : 'Using zero-time standard atmosphere',
    status: override ? 'pass' : 'info',
  });

  // 4. Cold-bore log
  checks.push({
    id: 'coldbore',
    label: 'Cold-bore logged today',
    detail: coldBoreToday
      ? 'First shot offset recorded for today.'
      : 'No cold-bore entry yet today — log from Profiles after first shot.',
    status: coldBoreToday ? 'pass' : 'warn',
  });

  // 5. Dev build note
  checks.push({
    id: 'devbuild',
    label: 'Offline maps',
    detail: 'Requires dev build (expo run:ios) — run when ready for field use.',
    status: 'info',
  });

  const allClear = checks.every((c) => c.status === 'pass');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const hasFail = checks.some((c) => c.status === 'fail');
  const overallStatus: CheckStatus = hasFail ? 'fail' : hasWarn ? 'warn' : allClear ? 'pass' : 'info';

  const overallLabel =
    overallStatus === 'pass' ? 'READY TO HUNT' :
    overallStatus === 'warn' ? 'REVIEW WARNINGS' :
    overallStatus === 'fail' ? 'NOT READY' : 'INCOMPLETE';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.primary }]}>SETTINGS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Readiness summary pill */}
        <View style={[styles.summaryPill, { borderColor: STATUS_COLOR[overallStatus] }]}>
          <Ionicons
            name={STATUS_ICON[overallStatus]}
            size={22}
            color={STATUS_COLOR[overallStatus]}
          />
          <Text style={[styles.summaryLabel, { color: STATUS_COLOR[overallStatus] }]}>
            {overallLabel}
          </Text>
        </View>

        {/* Checklist */}
        <Text style={[styles.sectionLabel, { color: theme.dim }]}>PRE-HUNT READINESS</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {checks.map((item) => (
            <CheckRow key={item.id} item={item} theme={theme} />
          ))}
        </View>

        {/* Display mode toggle */}
        <Text style={[styles.sectionLabel, { color: theme.dim }]}>DISPLAY</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            style={styles.settingRow}
            onPress={cycleDisplayMode}
            accessibilityLabel="Cycle display mode"
          >
            <Text style={[styles.settingLabel, { color: theme.label }]}>Display mode</Text>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.primary }]}>
                {displayMode.toUpperCase().replace('-', ' ')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.dim} />
            </View>
          </Pressable>

          <Pressable
            style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.border }]}
            onPress={toggleHoldUnit}
            accessibilityLabel="Toggle hold unit"
          >
            <Text style={[styles.settingLabel, { color: theme.label }]}>Hold unit</Text>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.primary }]}>{holdUnit}</Text>
              <Ionicons name="swap-horizontal-outline" size={16} color={theme.dim} />
            </View>
          </Pressable>
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: theme.dim }]}>
          RangeDOPE v1.0 · com.rangedope.ballistics
        </Text>

        {/* Backup & Restore */}
        <Text style={[styles.sectionLabel, { color: theme.dim }]}>DATA</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.settingLabel, { color: theme.label }]}>Last backup</Text>
              <Text style={[styles.checkDetail, { color: theme.dim }]}>
                {backupMeta
                  ? `${new Date(backupMeta.createdAt).toLocaleDateString()} · ${backupMeta.rifleCount} rifle(s)`
                  : 'No backup yet'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleExport}
            disabled={backupWorking}
            style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.border }]}
            accessibilityLabel="Export all data backup"
          >
            {backupWorking
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />
            }
            <Text style={[styles.settingLabel, { color: theme.primary }]}>Export all data (JSON)</Text>
          </Pressable>

          <Pressable
            onPress={handleImport}
            disabled={backupWorking}
            style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.border }]}
            accessibilityLabel="Import data from backup file"
          >
            <Ionicons name="cloud-download-outline" size={18} color={theme.label} />
            <Text style={[styles.settingLabel, { color: theme.label }]}>Restore from backup file</Text>
          </Pressable>

        </View>

        {/* Import from other apps */}
        <Text style={[styles.sectionLabel, { color: theme.dim }]}>IMPORT FROM OTHER APPS</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            onPress={handleImport}
            disabled={backupWorking}
            style={styles.settingRow}
            accessibilityLabel="Import Strelok Pro CSV profile"
          >
            <Ionicons name="document-text-outline" size={18} color={theme.label} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.settingLabel, { color: theme.label }]}>Strelok Pro · CSV</Text>
              <Text style={[styles.checkDetail, { color: theme.dim }]}>Pick a Strelok Pro export file</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.dim} />
          </Pressable>
          <Pressable
            onPress={handleImport}
            disabled={backupWorking}
            style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.border }]}
            accessibilityLabel="Import Hornady 4DOF JSON profile"
          >
            <Ionicons name="document-text-outline" size={18} color={theme.label} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.settingLabel, { color: theme.label }]}>Hornady 4DOF · JSON</Text>
              <Text style={[styles.checkDetail, { color: theme.dim }]}>Pick a Hornady CustomShop export</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.dim} />
          </Pressable>
        </View>

        {/* Offline Maps */}
        <Text style={[styles.sectionLabel, { color: theme.dim }]}>OFFLINE MAPS</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.settingLabel, { color: theme.label }]}>Downloaded areas</Text>
              <Text style={[styles.checkDetail, { color: theme.dim }]}>
                {offlineRegions.length === 0
                  ? 'No offline areas saved.'
                  : `${offlineRegions.length} area(s) · ${offlineRegions.reduce((s, r) => s + r.tilesDownloaded, 0).toLocaleString()} tiles`}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              if (!isPro) { showPaywall('Offline Maps'); return; }
              setOfflinePickerVisible(true);
            }}
            style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.border }]}
            accessibilityLabel="Manage offline map areas"
          >
            <Ionicons name="map-outline" size={18} color={theme.primary} />
            <Text style={[styles.settingLabel, { color: theme.primary }]}>Manage offline areas</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.dim} />
          </Pressable>
        </View>

        {/* Subscription */}
        <Text style={[styles.sectionLabel, { color: theme.dim }]}>SUBSCRIPTION</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.settingLabel, { color: theme.label }]}>RangeDOPE Pro</Text>
              <Text style={[styles.checkDetail, { color: isPro ? '#22C55E' : theme.dim }]}>
                {isPro ? '✓ Pro — all features unlocked' : 'Free — upgrade to unlock all features'}
              </Text>
            </View>
          </View>
          {!isPro && (
            <Pressable
              onPress={() => showPaywall()}
              style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: theme.border }]}
              accessibilityLabel="Upgrade to RangeDOPE Pro"
            >
              <Ionicons name="star-outline" size={18} color={theme.primary} />
              <Text style={[styles.settingLabel, { color: theme.primary }]}>Go Pro — $24.99/yr</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>

      {/* Modals */}
      <PaywallModal />
      <OfflineRegionPicker
        visible={offlinePickerVisible}
        onDismiss={() => { setOfflinePickerVisible(false); loadRegions().then(setOfflineRegions); }}
        theme={theme}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  scroll: { padding: 16, gap: 8, paddingBottom: 48 },

  // Readiness pill
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  summaryLabel: { fontFamily: FONT, fontSize: 16, letterSpacing: 2 },

  // Section headers
  sectionLabel: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 4,
  },

  // Card
  card: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },

  // Checklist
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  checkIcon: { marginTop: 1 },
  checkText: { flex: 1, gap: 2 },
  checkLabel: { fontFamily: FONT, fontSize: 12 },
  checkDetail: { fontFamily: FONT, fontSize: 10, lineHeight: 15 },

  // Settings rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  settingLabel: { fontFamily: FONT, fontSize: 12 },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { fontFamily: FONT, fontSize: 12 },

  version: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 12,
  },
});
