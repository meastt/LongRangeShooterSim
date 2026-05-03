/**
 * OfflineRegionPicker — interactive bounding box selector + download manager.
 *
 * Two modes:
 *   1. PICK — shows a bounding-box overlay on top of the TacticalMap that the
 *      user can adjust with +/− lat/lng controls. Displays estimated tile count
 *      and MB before committing to download.
 *   2. MANAGE — lists all downloaded regions with size, date, and a delete button.
 *
 * OSM / USGS disclaimer is shown prominently per the build plan.
 *
 * Used from:
 *   - ShotPlan map (floating "⬇ Offline" button)
 *   - Settings → OFFLINE MAPS section
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  estimateTileCount,
  estimateMegabytes,
  downloadRegion,
  loadRegions,
  deleteRegion,
} from '../utils/offlineRegions';
import type { BoundingBox, OfflineRegion, DownloadProgress } from '../utils/offlineRegions';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';

// ─── Default bounding box (central Utah — good hunting country default) ───────

const DEFAULT_BOUNDS: BoundingBox = {
  minLng: -112.0,
  minLat:  39.5,
  maxLng: -110.5,
  maxLat:  40.5,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMb(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Bound adjuster ───────────────────────────────────────────────────────────

function BoundRow({
  label,
  value,
  onInc,
  onDec,
  theme,
}: {
  label: string;
  value: number;
  onInc: () => void;
  onDec: () => void;
  theme: Theme;
}) {
  return (
    <View style={styles.boundRow}>
      <Text style={[styles.boundLabel, { color: theme.dim }]}>{label}</Text>
      <View style={styles.boundControls}>
        <Pressable onPress={onDec} hitSlop={8} style={[styles.adjBtn, { borderColor: theme.border }]}>
          <Text style={[styles.adjBtnText, { color: theme.label }]}>−</Text>
        </Pressable>
        <Text style={[styles.boundValue, { color: theme.primary }]}>{value.toFixed(2)}°</Text>
        <Pressable onPress={onInc} hitSlop={8} style={[styles.adjBtn, { borderColor: theme.border }]}>
          <Text style={[styles.adjBtnText, { color: theme.label }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Region card ─────────────────────────────────────────────────────────────

function RegionCard({
  region,
  onDelete,
  theme,
}: {
  region: OfflineRegion;
  onDelete: () => void;
  theme: Theme;
}) {
  return (
    <View style={[styles.regionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.regionCardHeader}>
        <View style={styles.regionCardTitles}>
          <Text style={[styles.regionName, { color: theme.primary }]}>{region.name}</Text>
          <Text style={[styles.regionMeta, { color: theme.dim }]}>
            {region.tilesDownloaded.toLocaleString()} tiles · {formatMb(region.bytesOnDisk)} · {formatDate(region.downloadedAt)}
          </Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={12} accessibilityLabel={`Delete ${region.name}`}>
          <Ionicons name="trash-outline" size={18} color={theme.dim} />
        </Pressable>
      </View>
      <Text style={[styles.regionBounds, { color: theme.dim }]}>
        {region.bounds.minLat.toFixed(2)}°–{region.bounds.maxLat.toFixed(2)}°N  ·  {region.bounds.minLng.toFixed(2)}°–{region.bounds.maxLng.toFixed(2)}°E
      </Text>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Pre-fill bounds from map centre when opened from ShotPlan */
  initialBounds?: BoundingBox;
  theme: Theme;
}

export function OfflineRegionPicker({ visible, onDismiss, initialBounds, theme }: Props) {
  const [tab, setTab] = useState<'pick' | 'manage'>('pick');
  const [bounds, setBounds] = useState<BoundingBox>(initialBounds ?? DEFAULT_BOUNDS);
  const [regionName, setRegionName] = useState('Hunt Area');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [regions, setRegions] = useState<OfflineRegion[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const refreshRegions = useCallback(async () => {
    const r = await loadRegions();
    setRegions(r);
  }, []);

  useEffect(() => {
    if (visible) refreshRegions();
  }, [visible, refreshRegions]);

  const estimated = estimateTileCount(bounds);
  const estimatedMb = estimateMegabytes(bounds);

  async function startDownload() {
    if (estimated > 5000) {
      Alert.alert(
        'Area too large',
        `This area requires ~${estimated.toLocaleString()} tiles (~${estimatedMb} MB). Reduce the area to under 5,000 tiles by shrinking the bounding box or reducing the zoom range.`,
      );
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setDownloading(true);
    setProgress({ downloaded: 0, total: estimated, bytesDownloaded: 0 });

    try {
      const id = Crypto.randomUUID();
      await downloadRegion(
        {
          id,
          name: regionName || 'Hunt Area',
          bounds,
          sources: ['usgs_topo'],
          minZoom: 10,
          maxZoom: 14,
        },
        (p) => setProgress(p),
        controller.signal,
      );
      await refreshRegions();
      Alert.alert('Download complete', `${regionName} is available offline.`);
      setTab('manage');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        Alert.alert('Download failed', String(e));
      }
    } finally {
      setDownloading(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function cancelDownload() {
    abortRef.current?.abort();
  }

  async function handleDelete(id: string, name: string) {
    Alert.alert(
      `Delete "${name}"?`,
      'This will remove all downloaded tiles for this area.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRegion(id);
            await refreshRegions();
          },
        },
      ],
    );
  }

  const adj = (field: keyof BoundingBox, delta: number) =>
    setBounds((b) => ({ ...b, [field]: parseFloat((b[field] + delta).toFixed(2)) }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.label} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>OFFLINE MAPS</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {(['pick', 'manage'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: tab === t ? theme.primary : theme.dim }]}>
                {t === 'pick' ? 'DOWNLOAD AREA' : `SAVED (${regions.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {tab === 'pick' ? (
            <>
              {/* Disclaimer */}
              <View style={[styles.disclaimer, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}30` }]}>
                <Ionicons name="information-circle-outline" size={14} color={theme.dim} />
                <Text style={[styles.disclaimerText, { color: theme.dim }]}>
                  Tiles downloaded for personal hunting use only, per USGS/OSM terms.
                </Text>
              </View>

              {/* Bounds adjuster */}
              <Text style={[styles.sectionLabel, { color: theme.dim }]}>BOUNDING BOX</Text>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <BoundRow label="North lat"  value={bounds.maxLat} onInc={() => adj('maxLat', 0.25)} onDec={() => adj('maxLat', -0.25)} theme={theme} />
                <BoundRow label="South lat"  value={bounds.minLat} onInc={() => adj('minLat', 0.25)} onDec={() => adj('minLat', -0.25)} theme={theme} />
                <BoundRow label="East lng"   value={bounds.maxLng} onInc={() => adj('maxLng', 0.25)} onDec={() => adj('maxLng', -0.25)} theme={theme} />
                <BoundRow label="West lng"   value={bounds.minLng} onInc={() => adj('minLng', 0.25)} onDec={() => adj('minLng', -0.25)} theme={theme} />
              </View>

              {/* Estimate */}
              <View style={[styles.estimate, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.estimateRow}>
                  <Text style={[styles.estimateLabel, { color: theme.dim }]}>Zoom levels</Text>
                  <Text style={[styles.estimateValue, { color: theme.label }]}>10 – 14</Text>
                </View>
                <View style={styles.estimateRow}>
                  <Text style={[styles.estimateLabel, { color: theme.dim }]}>Tiles</Text>
                  <Text style={[
                    styles.estimateValue,
                    { color: estimated > 5000 ? '#EF4444' : theme.primary },
                  ]}>
                    ~{estimated.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.estimateRow}>
                  <Text style={[styles.estimateLabel, { color: theme.dim }]}>Est. size</Text>
                  <Text style={[styles.estimateValue, { color: theme.label }]}>~{estimatedMb} MB</Text>
                </View>
                {estimated > 5000 && (
                  <Text style={[styles.estimateWarn, { color: '#EF4444' }]}>
                    Area too large. Reduce bounding box to under 5,000 tiles.
                  </Text>
                )}
              </View>

              {/* Progress */}
              {downloading && progress && (
                <View style={[styles.progressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.progressLabel, { color: theme.dim }]}>
                    {progress.downloaded} / {progress.total} tiles · {formatMb(progress.bytesDownloaded)}
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: theme.primary, width: `${(progress.downloaded / progress.total) * 100}%` as `${number}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Download button */}
              {downloading ? (
                <Pressable
                  onPress={cancelDownload}
                  style={[styles.btn, { backgroundColor: '#EF4444' }]}
                  accessibilityLabel="Cancel download"
                >
                  <Text style={[styles.btnText, { color: '#fff' }]}>CANCEL DOWNLOAD</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={startDownload}
                  disabled={estimated > 5000}
                  style={[
                    styles.btn,
                    { backgroundColor: estimated > 5000 ? theme.border : theme.primary },
                  ]}
                  accessibilityLabel="Download offline tiles"
                >
                  {downloading
                    ? <ActivityIndicator color={theme.bg} />
                    : <Text style={[styles.btnText, { color: theme.bg }]}>⬇ DOWNLOAD AREA</Text>
                  }
                </Pressable>
              )}
            </>
          ) : (
            <>
              {regions.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="map-outline" size={40} color={theme.dim} />
                  <Text style={[styles.emptyText, { color: theme.dim }]}>
                    No offline areas yet.{'\n'}Use the Download tab to save a hunting area.
                  </Text>
                </View>
              ) : (
                regions.map((r) => (
                  <RegionCard
                    key={r.id}
                    region={r}
                    onDelete={() => handleDelete(r.id, r.name)}
                    theme={theme}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontFamily: FONT, fontSize: 10, letterSpacing: 1 },
  scroll: { padding: 16, gap: 12, paddingBottom: 48 },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  disclaimerText: { fontFamily: FONT, fontSize: 9, lineHeight: 15, flex: 1 },

  sectionLabel: { fontFamily: FONT, fontSize: 9, letterSpacing: 2, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },

  boundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  boundLabel: { fontFamily: FONT, fontSize: 11 },
  boundControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adjBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjBtnText: { fontFamily: FONT, fontSize: 18, lineHeight: 22 },
  boundValue: { fontFamily: FONT, fontSize: 14, minWidth: 72, textAlign: 'center' },

  estimate: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  estimateLabel: { fontFamily: FONT, fontSize: 11 },
  estimateValue: { fontFamily: FONT, fontSize: 11 },
  estimateWarn: { fontFamily: FONT, fontSize: 10, marginTop: 4 },

  progressCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  progressLabel: { fontFamily: FONT, fontSize: 10 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },

  btn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnText: { fontFamily: FONT, fontSize: 13, letterSpacing: 1 },

  regionCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  regionCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  regionCardTitles: { flex: 1, gap: 2 },
  regionName: { fontFamily: FONT, fontSize: 13 },
  regionMeta: { fontFamily: FONT, fontSize: 10 },
  regionBounds: { fontFamily: FONT, fontSize: 9 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontFamily: FONT, fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
