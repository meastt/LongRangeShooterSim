/**
 * ShotPlan screen — hunt planning layer.
 *
 * Phase 2.3: Glassing pin + target polygon with real-time ballistic solve.
 *
 * Workflow:
 *   1. Enter shooter and target coordinates (lat/lng/elevation).
 *   2. App computes range (haversine), bearing, elevation delta, and angle-of-sight
 *      correction (cosine rule).
 *   3. Range is pushed into the field store so the live solver resolves
 *      at that distance — the COMPUTED card shows real dial and wind hold.
 *   4. Map centers on the midpoint between the two pins.
 *
 * Accessible: tap the PLAN tab (4th tab, map-outline icon).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useFieldStore } from '../../src/store/fieldStore';
import { useTheme } from '../../src/theme';
import { useSolverResult } from '../../src/hooks/useSolverResult';
import { TacticalMap } from '../../src/components/Map/TacticalMap';
import type { PinMarker, WaypointMarker } from '../../src/components/Map/TacticalMap';
import { SunOverlay } from '../../src/components/SunOverlay';
import { OfflineRegionPicker } from '../../src/components/OfflineRegionPicker';
import { useProGate } from '../../src/components/PaywallScreen';
import { WaypointTypeSheet } from '../../src/components/WaypointTypeSheet';
import { useWaypointStore, WAYPOINT_CONFIG } from '../../src/store/waypointStore';
import type { WaypointType } from '../../src/store/waypointStore';

const FONT = 'SpaceMono-Regular';
const MIL_TO_MOA = 3.43775;

// ─── Haversine distance helper ─────────────────────────────────────────────────

function haversineYards(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // Earth radius, metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const metres = 2 * R * Math.asin(Math.sqrt(a));
  return metres * 1.09361;
}

// ─── Pin entry helpers ─────────────────────────────────────────────────────────

type Pin = {
  label: string;
  lat: string;
  lng: string;
  elevFt: string;
};

function emptyPin(label: string): Pin {
  return { label, lat: '', lng: '', elevFt: '' };
}

function PinInput({
  pin,
  onChange,
  theme,
  onGPS,
}: {
  pin: Pin;
  onChange: (p: Pin) => void;
  theme: ReturnType<typeof useTheme>;
  /** If provided, renders a GPS button next to the header */
  onGPS?: () => void;
}) {
  return (
    <View style={styles.pinCard}>
      <View style={styles.pinCardHeader}>
        <Text style={[styles.pinLabel, { color: theme.label }]}>{pin.label}</Text>
        {onGPS && (
          <Pressable
            onPress={onGPS}
            style={[styles.gpsBtn, { borderColor: theme.primary }]}
            accessibilityLabel={`Fill ${pin.label} coordinates from GPS`}
          >
            <Ionicons name="locate-outline" size={13} color={theme.primary} />
            <Text style={[styles.gpsBtnText, { color: theme.primary }]}>GPS</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.pinRow}>
        <View style={styles.pinField}>
          <Text style={[styles.pinFieldLabel, { color: theme.dim }]}>LAT</Text>
          <TextInput
            style={[styles.pinInput, { color: theme.label, borderColor: theme.border, backgroundColor: theme.surface }]}
            value={pin.lat}
            onChangeText={(v) => onChange({ ...pin, lat: v })}
            placeholder="39.7500"
            placeholderTextColor={theme.dim}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.pinField}>
          <Text style={[styles.pinFieldLabel, { color: theme.dim }]}>LNG</Text>
          <TextInput
            style={[styles.pinInput, { color: theme.label, borderColor: theme.border, backgroundColor: theme.surface }]}
            value={pin.lng}
            onChangeText={(v) => onChange({ ...pin, lng: v })}
            placeholder="-111.0937"
            placeholderTextColor={theme.dim}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={[styles.pinField, { flex: 0.6 }]}>
          <Text style={[styles.pinFieldLabel, { color: theme.dim }]}>ELEV FT</Text>
          <TextInput
            style={[styles.pinInput, { color: theme.label, borderColor: theme.border, backgroundColor: theme.surface }]}
            value={pin.elevFt}
            onChangeText={(v) => onChange({ ...pin, elevFt: v })}
            placeholder="7200"
            placeholderTextColor={theme.dim}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ShotPlanScreen() {
  const displayMode = useFieldStore((s) => s.displayMode);
  const theme = useTheme(displayMode);
  const holdUnit = useFieldStore((s) => s.holdUnit);
  const setRange = useFieldStore((s) => s.setRange);
  const result = useSolverResult();

  const { isPro, showPaywall, PaywallModal } = useProGate(theme);
  const [offlineVisible, setOfflineVisible] = useState(false);

  const [shooter, setShooter] = useState<Pin>(emptyPin('SHOOTER'));
  const [target, setTarget] = useState<Pin>(emptyPin('TARGET'));
  const [panelExpanded, setPanelExpanded] = useState(true);
  /** Which pin the next long-press will drop — auto-advances shooter→target */
  const [dropMode, setDropMode] = useState<'shooter' | 'target'>('shooter');

  // ─── Waypoint system ───────────────────────────────────────────────────────
  /** 'shot' = long-press drops SHOOTER/TARGET, 'waypoint' = opens type picker */
  const [mapMode, setMapMode] = useState<'shot' | 'waypoint'>('shot');
  /** Pending long-press location waiting for the type picker to resolve */
  const [pendingLngLat, setPendingLngLat] = useState<[number, number] | null>(null);
  const { waypoints, addWaypoint, removeWaypoint } = useWaypointStore();

  /** Convert persisted waypoints to WaypointMarker[] for the map */
  const waypointMarkers: WaypointMarker[] = waypoints.map((w) => ({
    id: w.id,
    lngLat: [w.lng, w.lat] as [number, number],
    emoji: WAYPOINT_CONFIG[w.type].emoji,
    color: WAYPOINT_CONFIG[w.type].color,
    label: WAYPOINT_CONFIG[w.type].label,
  }));

  // ─── GPS auto-fill ─────────────────────────────────────────────────────────
  const getGPSLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Access Needed',
        'Enable location in Settings to use GPS auto-fill.',
        [{ text: 'OK' }],
      );
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, altitude } = loc.coords;
      const elevFt = altitude != null ? Math.round(altitude * 3.28084).toString() : '';
      setShooter((prev) => ({
        ...prev,
        lat: latitude.toFixed(6),
        lng: longitude.toFixed(6),
        elevFt,
      }));
    } catch {
      Alert.alert('GPS Error', 'Could not get location. Make sure GPS is enabled.');
    }
  }, []);

  // ─── Long-press handler (branches on mapMode) ──────────────────────────────
  const handleMapLongPress = useCallback(
    (lngLat: [number, number]) => {
      if (mapMode === 'waypoint') {
        // Show type picker — store the location until user confirms
        setPendingLngLat(lngLat);
        return;
      }
      // Shot-plan mode — cycle SHOOTER → TARGET
      const lng = lngLat[0].toFixed(6);
      const lat = lngLat[1].toFixed(6);
      if (dropMode === 'shooter') {
        setShooter((prev) => ({ ...prev, lat, lng }));
        setDropMode('target');
      } else {
        setTarget((prev) => ({ ...prev, lat, lng }));
        setDropMode('shooter');
      }
    },
    [mapMode, dropMode],
  );

  function handleWaypointConfirm(type: WaypointType, note: string) {
    if (!pendingLngLat) return;
    addWaypoint({ type, lat: pendingLngLat[1], lng: pendingLngLat[0], note });
    setPendingLngLat(null);
  }

  // ─── Pin tap handler — allows moving or clearing placed pins ──────────────
  const handlePinPress = useCallback((pinId: string) => {
    if (pinId === 'shooter') {
      Alert.alert(
        'Shooter Pin',
        'What would you like to do?',
        [
          {
            text: 'Move Shooter',
            onPress: () => setDropMode('shooter'),
          },
          {
            text: 'Clear Shooter',
            style: 'destructive',
            onPress: () => {
              setShooter(emptyPin('SHOOTER'));
              setDropMode('shooter');
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else if (pinId === 'target') {
      Alert.alert(
        'Target Pin',
        'What would you like to do?',
        [
          {
            text: 'Move Target',
            onPress: () => setDropMode('target'),
          },
          {
            text: 'Clear Target',
            style: 'destructive',
            onPress: () => {
              setTarget(emptyPin('TARGET'));
              setDropMode('target');
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }, []);

  // Derived plan data
  const sLat = parseFloat(shooter.lat);
  const sLng = parseFloat(shooter.lng);
  const tLat = parseFloat(target.lat);
  const tLng = parseFloat(target.lng);
  const sElev = parseFloat(shooter.elevFt) || 0;
  const tElev = parseFloat(target.elevFt) || 0;

  const hasCoords = [sLat, sLng, tLat, tLng].every((v) => !isNaN(v));
  const rangeYdFlat = hasCoords ? Math.round(haversineYards(sLat, sLng, tLat, tLng)) : null;
  const elevDelta = tElev - sElev;

  // Angle-corrected range (incline correction):
  // Ballistic range = slant range × cos(angle). The vertical separation between
  // shooter and target in the same horizontal distance is elevDelta feet.
  const slantRangeYd = rangeYdFlat;
  const angleDeg = slantRangeYd
    ? Math.atan(elevDelta / (slantRangeYd * 3)) * (180 / Math.PI) // 3ft/yd
    : 0;
  const correctedRangeYd = slantRangeYd
    ? Math.round(slantRangeYd * Math.cos((angleDeg * Math.PI) / 180))
    : null;

  // Push the corrected range into the field store whenever it changes so the
  // useSolverResult hook picks it up and produces real ballistic output.
  useEffect(() => {
    if (correctedRangeYd !== null) {
      setRange(correctedRangeYd);
    }
  }, [correctedRangeYd, setRange]);

  // Bearing (shooter → target)
  function bearingDeg(): number | null {
    if (!hasCoords) return null;
    const dLng = ((tLng - sLng) * Math.PI) / 180;
    const lat1 = (sLat * Math.PI) / 180;
    const lat2 = (tLat * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  const bearing = bearingDeg();

  // Format hold value in user's preferred unit.
  function fmtHold(mils: number, decimals = 2): string {
    if (holdUnit === 'MOA') return (mils * MIL_TO_MOA).toFixed(1) + ' MOA';
    return mils.toFixed(decimals) + ' MIL';
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <TacticalMap
          initialCenter={
            hasCoords
              ? [(sLng + tLng) / 2, (sLat + tLat) / 2]
              : undefined
          }
          initialZoom={hasCoords ? 13 : 11}
          pins={[
            ...(shooter.lat && shooter.lng ? [{
              id: 'shooter',
              lngLat: [parseFloat(shooter.lng), parseFloat(shooter.lat)] as [number, number],
              label: 'SHOOTER',
              color: '#FF3000',
            }] : []),
            ...(target.lat && target.lng ? [{
              id: 'target',
              lngLat: [parseFloat(target.lng), parseFloat(target.lat)] as [number, number],
              label: 'TARGET',
              color: '#FFB300',
            }] : []),
          ]}
          waypointMarkers={waypointMarkers}
          onLongPress={handleMapLongPress}
          onPinPress={handlePinPress}
        />

        {/* Map mode toggle bar */}
        <View style={styles.dropModeBar}>
          <Pressable
            onPress={() => setMapMode('shot')}
            style={[styles.mapModeBtn, mapMode === 'shot' && styles.mapModeBtnActive]}
          >
            <Text style={[styles.mapModeBtnText, { color: mapMode === 'shot' ? '#FF3000' : 'rgba(255,255,255,0.4)' }]}>
              🎯 SHOT PLAN
            </Text>
          </Pressable>
          <View style={styles.mapModeDivider} />
          <Pressable
            onPress={() => setMapMode('waypoint')}
            style={[styles.mapModeBtn, mapMode === 'waypoint' && styles.mapModeBtnActive]}
          >
            <Text style={[styles.mapModeBtnText, { color: mapMode === 'waypoint' ? '#FFB300' : 'rgba(255,255,255,0.4)' }]}>
              📍 WAYPOINTS
            </Text>
          </Pressable>
        </View>

        {/* Offline download button — top-right to clear scale bar */}
        <Pressable
          onPress={() => {
            if (!isPro) { showPaywall('Offline Maps'); return; }
            setOfflineVisible(true);
          }}
          style={styles.offlineBtn}
          accessibilityLabel="Download offline map tiles"
        >
          <Ionicons name="download-outline" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.offlineBtnText}>OFFLINE</Text>
        </Pressable>
      </View>

      {/* Paywall + offline modals */}
      <PaywallModal />
      <OfflineRegionPicker
        visible={offlineVisible}
        onDismiss={() => setOfflineVisible(false)}
        theme={theme}
      />
      {/* Waypoint type picker — appears after long-press in WAYPOINT mode */}
      <WaypointTypeSheet
        visible={pendingLngLat !== null}
        theme={theme}
        onConfirm={handleWaypointConfirm}
        onCancel={() => setPendingLngLat(null)}
      />

      {/* Collapsible data panel */}
      <View style={[styles.panel, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <Pressable
          style={styles.panelHandle}
          onPress={() => setPanelExpanded((v) => !v)}
        >
          <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
          <Text style={[styles.panelTitle, { color: theme.primary }]}>SHOT PLAN</Text>
          <Ionicons
            name={panelExpanded ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={theme.dim}
          />
        </Pressable>

        {panelExpanded && (
          <ScrollView contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">

            {/* Pin inputs — SHOOTER gets GPS auto-fill */}
            <PinInput pin={shooter} onChange={setShooter} theme={theme} onGPS={getGPSLocation} />
            <PinInput pin={target} onChange={setTarget} theme={theme} />

            {/* Computed data */}
            {hasCoords && rangeYdFlat !== null && (
              <View style={[styles.computedCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.computedTitle, { color: theme.dim }]}>COMPUTED</Text>

                <View style={styles.computedRow}>
                  <Text style={[styles.computedLabel, { color: theme.dim }]}>Slant range</Text>
                  <Text style={[styles.computedValue, { color: theme.primary }]}>{rangeYdFlat.toLocaleString()} yd</Text>
                </View>

                {correctedRangeYd !== null && correctedRangeYd !== rangeYdFlat && (
                  <View style={styles.computedRow}>
                    <Text style={[styles.computedLabel, { color: theme.dim }]}>Ballistic range</Text>
                    <Text style={[styles.computedValue, { color: theme.primary }]}>{correctedRangeYd.toLocaleString()} yd</Text>
                  </View>
                )}

                <View style={styles.computedRow}>
                  <Text style={[styles.computedLabel, { color: theme.dim }]}>Bearing</Text>
                  <Text style={[styles.computedValue, { color: theme.primary }]}>
                    {bearing !== null ? `${bearing.toFixed(1)}°` : '—'}
                  </Text>
                </View>

                <View style={styles.computedRow}>
                  <Text style={[styles.computedLabel, { color: theme.dim }]}>Angle</Text>
                  <Text style={[styles.computedValue, { color: theme.primary }]}>
                    {elevDelta >= 0 ? '+' : ''}{angleDeg.toFixed(1)}°
                    {' '}({elevDelta >= 0 ? '+' : ''}{Math.round(elevDelta)} ft)
                  </Text>
                </View>

                {/* Live solver output */}
                {result ? (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.computedRow}>
                      <Text style={[styles.computedLabel, { color: theme.dim }]}>Dial</Text>
                      <Text style={[styles.computedValueLarge, { color: theme.primary }]}>
                        {result.dialClicks >= 0 ? '+' : ''}{result.dialClicks} CLICKS
                      </Text>
                    </View>

                    <View style={styles.computedRow}>
                      <Text style={[styles.computedLabel, { color: theme.dim }]}>Elev hold</Text>
                      <Text style={[styles.computedValue, { color: theme.primary }]}>
                        {fmtHold(result.row.holdMils as number)}
                      </Text>
                    </View>

                    {result.windHoldMils !== 0 && (
                      <View style={styles.computedRow}>
                        <Text style={[styles.computedLabel, { color: theme.dim }]}>Wind hold</Text>
                        <Text style={[styles.computedValue, { color: theme.primary }]}>
                          {result.windHoldMils > 0 ? '+' : ''}{fmtHold(result.windHoldMils)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.computedRow}>
                      <Text style={[styles.computedLabel, { color: theme.dim }]}>TOF</Text>
                      <Text style={[styles.computedValue, { color: theme.primary }]}>
                        {result.row.timeOfFlightSeconds.toFixed(2)} s
                      </Text>
                    </View>

                    <View style={styles.computedRow}>
                      <Text style={[styles.computedLabel, { color: theme.dim }]}>Impact energy</Text>
                      <Text style={[styles.computedValue, { color: theme.primary }]}>
                        {Math.round(result.row.energyFtLbs).toLocaleString()} ft·lb
                      </Text>
                    </View>

                    <View style={styles.computedRow}>
                      <Text style={[styles.computedLabel, { color: theme.dim }]}>Impact velocity</Text>
                      <Text style={[styles.computedValue, { color: theme.primary }]}>
                        {Math.round(result.row.velocityFps as number).toLocaleString()} fps
                      </Text>
                    </View>

                    <Text style={[styles.profileNote, { color: theme.dim }]}>
                      {result.profile.rifle.caliber} · {Math.round(result.profile.load.weightGrains)}gr {result.profile.load.bulletName}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.noProfile, { color: theme.dim }]}>
                    Set an active rifle in Profiles to compute a dial.
                  </Text>
                )}
              </View>
            )}

            {!hasCoords && (
              <Text style={[styles.hint, { color: theme.dim }]}>
                Tap GPS to fill your shooter position.{'\n'}
                SHOT PLAN mode: long-press map to drop pins.{'\n'}
                WAYPOINTS mode: long-press to log sightings, stands &amp; more.
              </Text>
            )}

            {/* Sun / glass-time advisor */}
            {hasCoords && (
              <SunOverlay
                lat={sLat}
                lon={sLng}
                shooterBearing={bearing ?? 0}
                theme={theme}
              />
            )}

            {/* Waypoint list */}
            {waypoints.length > 0 && (
              <View style={[styles.computedCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.computedTitle, { color: theme.dim }]}>WAYPOINTS ({waypoints.length})</Text>
                {waypoints.map((w) => {
                  const cfg = WAYPOINT_CONFIG[w.type];
                  return (
                    <View key={w.id} style={styles.waypointRow}>
                      <Text style={styles.waypointRowEmoji}>{cfg.emoji}</Text>
                      <View style={styles.waypointRowBody}>
                        <Text style={[styles.waypointRowType, { color: cfg.color }]}>{cfg.label}</Text>
                        {!!w.note && (
                          <Text style={[styles.waypointRowNote, { color: theme.dim }]} numberOfLines={1}>
                            {w.note}
                          </Text>
                        )}
                        <Text style={[styles.waypointRowCoords, { color: theme.dim }]}>
                          {w.lat.toFixed(4)}, {w.lng.toFixed(4)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => removeWaypoint(w.id)}
                        hitSlop={12}
                        accessibilityLabel={`Remove ${cfg.label} waypoint`}
                      >
                        <Ionicons name="trash-outline" size={14} color={theme.dim} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapContainer: { flex: 1, minHeight: 200, position: 'relative' },

  // Offline button overlay — top-right so it clears the scale bar
  offlineBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,0,0.4)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  offlineBtnText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.8)',
  },

  // Panel
  panel: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: '60%' },
  panelHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  // Visible drag handle pill
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  panelTitle: { fontFamily: FONT, fontSize: 12, letterSpacing: 2, flex: 1 },
  panelBody: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },

  // Pin inputs
  pinCard: { gap: 8 },
  pinCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // SHOOTER / TARGET header — section label, must be clearly legible
  pinLabel: { fontFamily: FONT, fontSize: 10, letterSpacing: 2 },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gpsBtnText: { fontFamily: FONT, fontSize: 9, letterSpacing: 1 },
  pinRow: { flexDirection: 'row', gap: 8 },
  pinField: { flex: 1, gap: 5 },
  // LAT / LNG / ELEV FT micro-labels
  pinFieldLabel: { fontFamily: FONT, fontSize: 9, letterSpacing: 1 },
  pinInput: {
    fontFamily: FONT,
    fontSize: 14,
    borderWidth: 1.5,          // Thicker border — visible against dark bg
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  // Computed card
  computedCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  computedTitle: { fontFamily: FONT, fontSize: 9, letterSpacing: 2 },
  computedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  computedLabel: { fontFamily: FONT, fontSize: 11 },
  computedValue: { fontFamily: FONT, fontSize: 15 },
  computedValueLarge: { fontFamily: FONT, fontSize: 22 },
  divider: { height: 1, opacity: 0.4 },
  profileNote: { fontFamily: FONT, fontSize: 9, marginTop: 4, letterSpacing: 0.5 },
  noProfile: { fontFamily: FONT, fontSize: 11, textAlign: 'center', lineHeight: 18 },

  hint: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Map mode toggle bar (SHOT PLAN / WAYPOINTS)
  dropModeBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.80)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  mapModeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
  },
  mapModeBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: 'transparent', // color applied via text
  },
  mapModeBtnText: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
  },
  mapModeDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dropModeText: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.55)',
  },

  // Waypoint list rows in the panel
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  waypointRowEmoji: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  waypointRowBody: {
    flex: 1,
    gap: 1,
  },
  waypointRowType: {
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 1,
  },
  waypointRowNote: {
    fontFamily: FONT,
    fontSize: 10,
  },
  waypointRowCoords: {
    fontFamily: FONT,
    fontSize: 9,
    opacity: 0.6,
  },
});
