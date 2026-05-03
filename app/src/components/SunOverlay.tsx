/**
 * SunOverlay — sun position + glass-time advisor for ShotPlan.
 *
 * Uses SunCalc to compute sun azimuth and altitude for a given
 * lat/lon and time-of-day. Renders:
 *   - A cardinal direction indicator showing where the sun will be
 *   - A "sun angle" advisory: INTO EYES / ON TARGET / GOOD ANGLE / BELOW HORIZON
 *   - The planned glass time as a picker (hour steps)
 *
 * Inputs:
 *   lat, lon        — target / glassing position coordinates
 *   shooterBearing  — compass bearing from shooter to target (degrees, 0–360)
 *
 * The advisory compares sun azimuth vs shooter bearing to determine
 * whether the sun will be in the shooter's eyes, on the target face, or at
 * a favourable angle for ranging and shooting.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import SunCalc from 'suncalc';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';

// ─── Sun angle advisory ────────────────────────────────────────────────────────

type SunAdvisory = 'below_horizon' | 'into_eyes' | 'on_target' | 'good_angle';

function getSunAdvisory(
  sunAzDeg: number,
  shooterBearingDeg: number,
  altitudeDeg: number,
): SunAdvisory {
  if (altitudeDeg < 0) return 'below_horizon';

  // Angular difference between sun and shooter-to-target bearing
  const diff = ((sunAzDeg - shooterBearingDeg + 540) % 360) - 180; // -180 to +180

  if (Math.abs(diff) < 30) return 'into_eyes';     // sun within 30° of shooter's line of sight
  if (Math.abs(diff) > 150) return 'on_target';    // sun roughly behind shooter, illuminating target
  return 'good_angle';
}

const ADVISORY_COLORS: Record<SunAdvisory, string> = {
  below_horizon: '#6B7280',
  into_eyes: '#EF4444',
  on_target: '#22C55E',
  good_angle: '#F59E0B',
};

const ADVISORY_LABELS: Record<SunAdvisory, string> = {
  below_horizon: 'BELOW HORIZON',
  into_eyes: '⚠ SUN IN EYES',
  on_target: '✓ SUN ON TARGET',
  good_angle: 'GOOD ANGLE',
};

const ADVISORY_DETAIL: Record<SunAdvisory, string> = {
  below_horizon: 'Sun is below the horizon at this time.',
  into_eyes: 'Sun is roughly in your line of sight. Ranging and ranging will be impaired. Plan for a different time.',
  on_target: 'Sun is illuminating the target face. Excellent for spotting hits and ranging.',
  good_angle: 'Sun is at a favourable angle. Minimal impact on shooting or ranging.',
};

// ─── Cardinal bearing helper ──────────────────────────────────────────────────

function bearingToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8] ?? 'N';
}

// ─── Hour picker ──────────────────────────────────────────────────────────────

function HourPicker({
  selectedHour,
  onSelect,
  theme,
}: {
  selectedHour: number;
  onSelect: (h: number) => void;
  theme: Theme;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourScroll}>
      {hours.map((h) => {
        const isSelected = h === selectedHour;
        const label = `${h.toString().padStart(2, '0')}:00`;
        return (
          <Pressable
            key={h}
            onPress={() => onSelect(h)}
            style={[
              styles.hourChip,
              { borderColor: isSelected ? theme.primary : theme.border },
              isSelected && { backgroundColor: theme.primary },
            ]}
          >
            <Text style={[styles.hourChipText, { color: isSelected ? theme.bg : theme.dim }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  lat: number;
  lon: number;
  /** Bearing from shooter to target, in degrees. Used for advisory. */
  shooterBearing?: number;
  theme: Theme;
}

export function SunOverlay({ lat, lon, shooterBearing = 0, theme }: Props) {
  const now = new Date();
  const [glassHour, setGlassHour] = useState(now.getHours());
  const [showDetail, setShowDetail] = useState(false);

  const sunData = useMemo(() => {
    const glassDate = new Date();
    glassDate.setHours(glassHour, 0, 0, 0);
    const pos = SunCalc.getPosition(glassDate, lat, lon);
    const times = SunCalc.getTimes(glassDate, lat, lon);

    const altDeg = pos.altitude * (180 / Math.PI);
    const azDeg = (pos.azimuth * (180 / Math.PI) + 180) % 360; // SunCalc azimuths are S=0, convert to N=0

    return {
      altitudeDeg: altDeg,
      azimuthDeg: azDeg,
      cardinal: bearingToCardinal(azDeg),
      advisory: getSunAdvisory(azDeg, shooterBearing, altDeg),
      sunrise: times.sunrise,
      sunset: times.sunset,
      goldenHourEnd: times.goldenHourEnd,
      goldenHour: times.goldenHour,
    };
  }, [lat, lon, glassHour, shooterBearing]);

  const advisoryColor = ADVISORY_COLORS[sunData.advisory];

  const formatTime = (d: Date) =>
    d instanceof Date && !isNaN(d.getTime())
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Header */}
      <Pressable onPress={() => setShowDetail((p) => !p)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sunny-outline" size={16} color={advisoryColor} />
          <Text style={[styles.advisoryText, { color: advisoryColor }]}>
            {ADVISORY_LABELS[sunData.advisory]}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.sunPos, { color: theme.dim }]}>
            {bearingToCardinal(sunData.azimuthDeg)} · {Math.max(0, sunData.altitudeDeg).toFixed(0)}°
          </Text>
          <Ionicons
            name={showDetail ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.dim}
          />
        </View>
      </Pressable>

      {showDetail && (
        <View style={styles.detail}>
          <Text style={[styles.detailText, { color: theme.dim }]}>
            {ADVISORY_DETAIL[sunData.advisory]}
          </Text>

          {/* Time grid */}
          <View style={styles.timeGrid}>
            <View style={styles.timeCell}>
              <Text style={[styles.timeCellLabel, { color: theme.dim }]}>SUNRISE</Text>
              <Text style={[styles.timeCellValue, { color: theme.label }]}>{formatTime(sunData.sunrise)}</Text>
            </View>
            <View style={styles.timeCell}>
              <Text style={[styles.timeCellLabel, { color: theme.dim }]}>GOLDEN HOUR</Text>
              <Text style={[styles.timeCellValue, { color: '#F59E0B' }]}>{formatTime(sunData.goldenHour)}</Text>
            </View>
            <View style={styles.timeCell}>
              <Text style={[styles.timeCellLabel, { color: theme.dim }]}>SUNSET</Text>
              <Text style={[styles.timeCellValue, { color: theme.label }]}>{formatTime(sunData.sunset)}</Text>
            </View>
          </View>

          {/* Glass time picker */}
          <Text style={[styles.pickerLabel, { color: theme.dim }]}>GLASS TIME</Text>
          <HourPicker selectedHour={glassHour} onSelect={setGlassHour} theme={theme} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  advisoryText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
  sunPos: { fontFamily: FONT, fontSize: 10 },
  detail: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  detailText: { fontFamily: FONT, fontSize: 10, lineHeight: 16 },
  timeGrid: { flexDirection: 'row', gap: 0 },
  timeCell: { flex: 1, alignItems: 'center', gap: 2 },
  timeCellLabel: { fontFamily: FONT, fontSize: 8, letterSpacing: 1 },
  timeCellValue: { fontFamily: FONT, fontSize: 12 },
  pickerLabel: { fontFamily: FONT, fontSize: 8, letterSpacing: 2 },
  hourScroll: { gap: 6, paddingVertical: 2 },
  hourChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hourChipText: { fontFamily: FONT, fontSize: 10 },
});
