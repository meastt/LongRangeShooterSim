/**
 * DOPECard — full ballistic table for a rifle profile.
 *
 * Generates a DOPE (Data On Previous Engagements) table from the solver:
 *   Range | Dial (clicks) | Elev Hold | Wind Hold* | TOF | Velocity | Energy
 *
 * Features:
 *   - In-app scrollable table with colour-coded velocity (green→yellow→red as
 *     velocity drops toward species minimum).
 *   - Export to PDF via expo-print (generates HTML, prints to PDF, shares via
 *     expo-sharing). The PDF is formatted for printing and laminating as a
 *     turret cap data card or hat-band card.
 *   - Wind column uses the current wind speed from fieldStore; if wind=0 the
 *     column shows "—" and a note says "no wind set".
 *
 * Range steps: 0, 50, 100 ... 1000 yd (the solver computes in 25 yd steps;
 *   we sample every 50 yd for a clean table that fits on a card).
 *
 * * Wind hold is listed as "per 1 mph crosswind" when wind=0, so the card
 *   remains useful regardless of conditions. When wind>0 it shows the actual
 *   hold for the set speed.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { computeTrajectory } from '@aim/solver';
import type { TrajectoryRow, TrajectoryInputs } from '@aim/solver';
import type { FieldProfile } from '../db/queries';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';
const MIL_TO_MOA = 3.43775;

// Clock-position → fractional crosswind component (same as useSolverResult)
function clockToWindFraction(pos: number): number {
  const deg = ((pos - 12) / 12) * 360;
  return Math.sin((deg * Math.PI) / 180);
}

// ─── Types ───────────────────────────────────────────────────────────────────

type HoldUnit = 'MIL' | 'MOA';

type DOPERow = {
  targetRangeYards: number;   // the clean 50yd step (0, 50, 100 … 1000)
  rangeYards: number;         // actual solver row range (may differ at trajectory end)
  dialClicks: number;
  holdMils: number;
  windHoldMils: number;
  windHoldPerMph: number;
  velocityFps: number;
  energyFtLbs: number;
  timeOfFlightSeconds: number;
  mach: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtHold(mils: number, unit: HoldUnit, decimals?: number): string {
  if (unit === 'MOA') {
    return (mils * MIL_TO_MOA).toFixed(decimals ?? 1);
  }
  return mils.toFixed(decimals ?? 2);
}

function velocityColor(fps: number): string {
  if (fps >= 2200) return '#22C55E';  // green — supersonic, full terminal performance
  if (fps >= 1800) return '#F59E0B';  // amber — approaching trans-sonic, marginal
  return '#EF4444';                   // red — sub-sonic or very marginal
}

// ─── Build DOPE table ─────────────────────────────────────────────────────────

function buildDOPE(
  profile: FieldProfile,
  windSpeedMph: number,
  windClockPos: number,
): DOPERow[] {
  const inputs: TrajectoryInputs = {
    bullet: {
      weightGrains: profile.load.weightGrains as any,
      diameterInches: profile.load.diameterInches as any,
      bc: profile.load.bc as any,
      dragModel: profile.load.dragModel as 'G1' | 'G7',
    },
    muzzleVelocityFps: profile.load.muzzleVelocityFps as any,
    scopeHeightInches: profile.zero.scopeHeightInches as any,
    zeroRangeYards: profile.zero.zeroRangeYards as any,
    atmosphere: profile.atmosphericSnapshot,
  };

  const traj = computeTrajectory(inputs);
  const clicksPerMrad = profile.scope.clicksPerMrad;
  const crosswindFraction = clockToWindFraction(windClockPos);

  // Sample the trajectory at 50 yd steps from 0 to 1000 yd
  const TARGET_RANGES = Array.from({ length: 21 }, (_, i) => i * 50);

  return TARGET_RANGES.map((targetRange) => {
    const row: TrajectoryRow =
      traj.rows.find((r) => (r.rangeYards as number) >= targetRange) ??
      traj.rows[traj.rows.length - 1]!;

    const rangeYd = row.rangeYards as number;
    const tof = row.timeOfFlightSeconds;

    const crosswindMph = windSpeedMph * crosswindFraction;
    const windHoldMils =
      targetRange > 0 ? (crosswindMph * tof * 17.6) / (targetRange * 0.036) : 0;
    const windHoldPerMph =
      targetRange > 0 ? (1 * tof * 17.6) / (targetRange * 0.036) : 0;

    return {
      targetRangeYards: targetRange,   // always the clean 50yd step
      rangeYards: rangeYd,
      dialClicks: Math.round((row.holdMils as number) * clicksPerMrad),
      holdMils: row.holdMils as number,
      windHoldMils,
      windHoldPerMph,
      velocityFps: row.velocityFps as number,
      energyFtLbs: row.energyFtLbs,
      timeOfFlightSeconds: tof,
      mach: row.mach,
    };
  });
}

// ─── PDF HTML generation ──────────────────────────────────────────────────────

function buildPDFHtml(
  profile: FieldProfile,
  rows: DOPERow[],
  unit: HoldUnit,
  windSpeedMph: number,
  windClockPos: number,
): string {
  const windNote =
    windSpeedMph > 0
      ? `${windSpeedMph} mph @ ${windClockPos} o'clock`
      : 'Wind col = per 1 mph full-value';

  const unitLabel = unit;
  const windColLabel = windSpeedMph > 0 ? `WIND\n${unitLabel}` : `WIND/MPH\n${unitLabel}`;

  const tableRows = rows
    .map((r) => {
      const dialStr = `${r.dialClicks >= 0 ? '+' : ''}${r.dialClicks}`;
      const holdStr = fmtHold(r.holdMils, unit);
      const windVal = windSpeedMph > 0 ? r.windHoldMils : r.windHoldPerMph;
      const windStr = windVal === 0 ? '—' : `${windVal > 0 ? '+' : ''}${fmtHold(windVal, unit)}`;
      const vfps = Math.round(r.velocityFps);
      const energy = Math.round(r.energyFtLbs);
      const tof = r.timeOfFlightSeconds.toFixed(2);
      const vColor = velocityColor(r.velocityFps);

      return `
        <tr>
          <td class="rng">${r.rangeYards}</td>
          <td class="dial">${dialStr}</td>
          <td class="hold">${holdStr}</td>
          <td class="wind">${windStr}</td>
          <td class="tof">${tof}</td>
          <td class="vel" style="color:${vColor}">${vfps}</td>
          <td class="nrg">${energy}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Share Tech Mono', 'Courier New', monospace;
    background: #fff;
    color: #111;
    padding: 12px;
    font-size: 10px;
  }
  .header { margin-bottom: 8px; }
  .rifle { font-size: 13px; font-weight: bold; letter-spacing: 1px; }
  .sub { font-size: 9px; color: #555; margin-top: 2px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th {
    background: #111;
    color: #fff;
    padding: 4px 6px;
    font-size: 8px;
    letter-spacing: 1px;
    text-align: right;
    white-space: pre;
  }
  th:first-child, td:first-child { text-align: left; }
  td {
    padding: 3px 6px;
    border-bottom: 1px solid #e0e0e0;
    text-align: right;
    font-size: 10px;
  }
  tr:nth-child(even) td { background: #f8f8f8; }
  tr:nth-child(5n) td { border-bottom: 2px solid #bbb; }
  .rng  { width: 14%; font-weight: bold; color: #000; }
  .dial { width: 14%; }
  .hold { width: 14%; }
  .wind { width: 14%; }
  .tof  { width: 12%; }
  .vel  { width: 16%; }
  .nrg  { width: 16%; }
  .footer {
    margin-top: 8px;
    font-size: 8px;
    color: #888;
    border-top: 1px solid #ccc;
    padding-top: 4px;
  }
  .zero-box {
    display: inline-block;
    border: 1px solid #111;
    padding: 3px 8px;
    margin-top: 4px;
    font-size: 9px;
  }
</style>
</head>
<body>
<div class="header">
  <div class="rifle">${profile.rifle.name.toUpperCase()}</div>
  <div class="sub">${profile.rifle.caliber} · ${profile.load.bulletName} ${Math.round(profile.load.weightGrains)}gr · ${profile.load.dragModel} BC ${profile.load.bc}</div>
  <div class="sub">MV ${Math.round(profile.load.muzzleVelocityFps as number)} fps · Zero ${profile.zero.zeroRangeYards} yd · Scope ht ${profile.zero.scopeHeightInches}"</div>
  <div class="sub">Atmo: ${Math.round(profile.atmosphericSnapshot.temperatureFahrenheit as number)}°F · ${(profile.atmosphericSnapshot.pressureInHg as number).toFixed(2)} inHg · ${profile.atmosphericSnapshot.relativeHumidityPct}% RH</div>
  <div class="sub">Wind: ${windNote}</div>
  <div class="zero-box">ZERO: ${profile.zero.zeroRangeYards} YD · SCOPE: ${profile.zero.scopeHeightInches}" · CLICKS/MRAD: ${profile.scope.clicksPerMrad}</div>
</div>

<table>
  <thead>
    <tr>
      <th>YD</th>
      <th>DIAL\nCLICKS</th>
      <th>ELEV\n${unitLabel}</th>
      <th>${windColLabel}</th>
      <th>TOF\nSEC</th>
      <th>VEL\nFPS</th>
      <th>ENERGY\nFT·LB</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<div class="footer">
  Generated by Aim · ${new Date().toLocaleDateString()} · Solver: G1/G7 modified point-mass + RK4 · Not a substitute for verified range data
</div>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  profile: FieldProfile;
  theme: Theme;
  holdUnit: HoldUnit;
  windSpeedMph: number;
  windClockPos: number;
  /** Called when the user taps the close/back button. */
  onClose: () => void;
}

export function DOPECard({
  profile,
  theme,
  holdUnit,
  windSpeedMph,
  windClockPos,
  onClose,
}: Props) {
  const { width } = useWindowDimensions();
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(
    () => buildDOPE(profile, windSpeedMph, windClockPos),
    [profile, windSpeedMph, windClockPos],
  );

  const windActive = windSpeedMph > 0;

  async function exportPDF() {
    setExporting(true);
    try {
      const html = buildPDFHtml(profile, rows, holdUnit, windSpeedMph, windClockPos);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `DOPE — ${profile.rifle.name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Exported', `PDF saved to: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setExporting(false);
    }
  }

  const unitLabel = holdUnit;

  // Column header widths — compact for narrower phones
  const isCompact = width < 390;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.label} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.primary }]} numberOfLines={1}>
            DOPE
          </Text>
          <Text style={[styles.headerSub, { color: theme.dim }]} numberOfLines={1}>
            {profile.rifle.name} · {profile.zero.zeroRangeYards}yd zero
          </Text>
        </View>
        <Pressable
          onPress={exportPDF}
          disabled={exporting}
          hitSlop={12}
          accessibilityLabel="Export DOPE card as PDF"
          style={[styles.exportBtn, { borderColor: exporting ? theme.dim : theme.primary }]}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="share-outline" size={18} color={theme.primary} />
          )}
          <Text style={[styles.exportBtnText, { color: exporting ? theme.dim : theme.primary }]}>
            {exporting ? 'EXPORTING…' : 'PDF'}
          </Text>
        </Pressable>
      </View>

      {/* Profile summary strip */}
      <View style={[styles.profileStrip, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.profileText, { color: theme.dim }]} numberOfLines={1}>
          {profile.rifle.caliber} · {Math.round(profile.load.weightGrains)}gr {profile.load.bulletName} · {profile.load.dragModel} BC {profile.load.bc}
        </Text>
        <Text style={[styles.profileText, { color: theme.dim }]} numberOfLines={1}>
          MV {Math.round(profile.load.muzzleVelocityFps as number)} fps · {Math.round(profile.atmosphericSnapshot.temperatureFahrenheit as number)}°F · {(profile.atmosphericSnapshot.pressureInHg as number).toFixed(2)} inHg
        </Text>
        {windActive && (
          <Text style={[styles.profileText, { color: theme.primary }]} numberOfLines={1}>
            Wind: {windSpeedMph} mph @ {windClockPos} o'clock
          </Text>
        )}
      </View>

      {/* Table */}
      <ScrollView style={styles.tableScroll} contentContainerStyle={styles.tableContainer}>
        {/* Column headers */}
        <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: theme.surface }]}>
          <Text style={[styles.colYd, styles.colHeader, { color: theme.dim }]}>YD</Text>
          <Text style={[styles.colDial, styles.colHeader, { color: theme.dim }]}>DIAL</Text>
          <Text style={[styles.colHold, styles.colHeader, { color: theme.dim }]}>
            ELEV{'\n'}{unitLabel}
          </Text>
          <Text style={[styles.colWind, styles.colHeader, { color: windActive ? theme.primary : theme.dim }]}>
            {windActive ? 'WIND' : 'WIND/mph'}{'\n'}{unitLabel}
          </Text>
          <Text style={[styles.colTof, styles.colHeader, { color: theme.dim }]}>TOF{'\n'}S</Text>
          {!isCompact && (
            <Text style={[styles.colVel, styles.colHeader, { color: theme.dim }]}>VEL{'\n'}FPS</Text>
          )}
          <Text style={[styles.colNrg, styles.colHeader, { color: theme.dim }]}>
            {isCompact ? 'NRG' : 'ENERGY'}{'\n'}FT·LB
          </Text>
        </View>

        {rows.map((row, idx) => {
          const isZeroRow = Math.abs(row.holdMils) < 0.01 && row.dialClicks === 0;
          const dialStr = `${row.dialClicks >= 0 ? '+' : ''}${row.dialClicks}`;
          const elevStr = fmtHold(row.holdMils, holdUnit);
          const windVal = windActive ? row.windHoldMils : row.windHoldPerMph;
          const windStr = windVal === 0 ? '—' : `${windVal > 0 ? '+' : ''}${fmtHold(windVal, holdUnit)}`;
          const vColor = velocityColor(row.velocityFps);
          // Every 5 rows — thicker separator for readability (hat-band card convention)
          const isMajorRow = idx > 0 && idx % 5 === 0;

          return (
            <View
              key={idx}   // use index — rangeYards can duplicate at trajectory end
              style={[
                styles.tableRow,
                { backgroundColor: idx % 2 === 0 ? theme.bg : theme.surface },
                isMajorRow && { borderTopColor: theme.border, borderTopWidth: 1 },
                isZeroRow && { borderLeftWidth: 2, borderLeftColor: theme.primary },
              ]}
            >
              <Text style={[styles.colYd, styles.cellText, { color: isZeroRow ? theme.primary : theme.label }]}>
                {row.targetRangeYards}
              </Text>
              <Text style={[styles.colDial, styles.cellText, { color: theme.primary }]}>
                {dialStr}
              </Text>
              <Text style={[styles.colHold, styles.cellText, { color: theme.label }]}>
                {elevStr}
              </Text>
              <Text style={[styles.colWind, styles.cellText, { color: windActive ? theme.primary : theme.dim }]}>
                {windStr}
              </Text>
              <Text style={[styles.colTof, styles.cellText, { color: theme.dim }]}>
                {row.timeOfFlightSeconds.toFixed(2)}
              </Text>
              {!isCompact && (
                <Text style={[styles.colVel, styles.cellText, { color: vColor }]}>
                  {Math.round(row.velocityFps)}
                </Text>
              )}
              <Text style={[styles.colNrg, styles.cellText, { color: theme.label }]}>
                {Math.round(row.energyFtLbs).toLocaleString()}
              </Text>
            </View>
          );
        })}

        {/* Velocity legend */}
        <View style={[styles.legend, { borderTopColor: theme.border }]}>
          <Text style={[styles.legendTitle, { color: theme.dim }]}>VELOCITY</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
            <Text style={[styles.legendText, { color: theme.dim }]}>≥ 2200 fps — supersonic</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: theme.dim }]}>1800–2199 fps — marginal</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.legendText, { color: theme.dim }]}>&lt; 1800 fps — sub-sonic</Text>
          </View>
          {!windActive && (
            <Text style={[styles.legendNote, { color: theme.dim }]}>
              * Wind column shows hold per 1 mph full-value crosswind.{'\n'}
              Set wind speed on the Field tab to show actual hold.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  headerSub: { fontFamily: FONT, fontSize: 9, letterSpacing: 0.5 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    justifyContent: 'center',
  },
  exportBtnText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },

  profileStrip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 3,
  },
  profileText: { fontFamily: FONT, fontSize: 9, letterSpacing: 0.5 },

  tableScroll: { flex: 1 },
  tableContainer: { paddingBottom: 32 },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  tableHeader: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },

  // Column widths — designed for 375pt wide phone in portrait
  colYd:   { width: 44, paddingLeft: 8 },
  colDial: { width: 52, textAlign: 'right', paddingRight: 6 },
  colHold: { flex: 1, textAlign: 'right', paddingRight: 6 },
  colWind: { flex: 1, textAlign: 'right', paddingRight: 6 },
  colTof:  { width: 42, textAlign: 'right', paddingRight: 4 },
  colVel:  { width: 48, textAlign: 'right', paddingRight: 4 },
  colNrg:  { width: 52, textAlign: 'right', paddingRight: 8 },

  colHeader: {
    fontFamily: FONT,
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'right',
  },
  cellText: {
    fontFamily: FONT,
    fontSize: 12,
  },

  // Legend
  legend: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  legendTitle: { fontFamily: FONT, fontSize: 8, letterSpacing: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FONT, fontSize: 10 },
  legendNote: { fontFamily: FONT, fontSize: 9, lineHeight: 15, marginTop: 4 },
});
