/**
 * DSFTruingWizard — Drop-Scale-Factor muzzle truing from 2–3 observed impacts.
 *
 * The user fires groups at 2–3 known distances, measures the observed path in
 * inches at each range, and this wizard back-solves a drag scale factor (DSF)
 * that minimises the sum of squared errors between computed and observed drops.
 *
 * Algorithm:
 *   DSF is a multiplier on BC: effective_bc = bc × DSF.
 *   Golden-section search over DSF ∈ [0.5, 1.5] minimises ΣΔ².
 *   Converges in ~50 evaluations.
 *
 * After truing: writes the updated BC back to the database via upsertLoad.
 *
 * Reference: Litz, Applied Ballistics Vol I §5 (drag scale factor correction).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { computeTrajectory } from '@aim/solver';
import type { TrajectoryInputs } from '@aim/solver';
import { upsertLoad } from '../../db/queries';
import type { Theme } from '../../theme';
import type { FieldProfile } from '../../db/queries';

const FONT = 'SpaceMono-Regular';

interface ObservedPoint {
  rangeYd: string;
  pathIn: string;
}

interface Props {
  profile: FieldProfile;
  theme: Theme;
  onComplete: () => void;
  onClose: () => void;
}

/**
 * Golden-section search for DSF that minimises ΣΔ² between predicted and
 * observed path-inches across all provided data points.
 */
function bisectDSF(
  inputs: TrajectoryInputs,
  points: { rangeYd: number; pathIn: number }[],
): number {
  const gr = 0.6180339887; // golden ratio conjugate

  let lo = 0.5;
  let hi = 1.5;

  function cost(dsf: number): number {
    const scaledInputs: TrajectoryInputs = {
      ...inputs,
      bullet: {
        ...inputs.bullet,
        bc: (inputs.bullet.bc as number * dsf) as typeof inputs.bullet.bc,
      },
    };
    const traj = computeTrajectory(scaledInputs);
    return points.reduce((sum, p) => {
      const row =
        traj.rows.find((r) => (r.rangeYards as number) >= p.rangeYd) ??
        traj.rows[traj.rows.length - 1]!;
      const diff = (row.pathInches as number) - p.pathIn;
      return sum + diff * diff;
    }, 0);
  }

  let c = hi - gr * (hi - lo);
  let d = lo + gr * (hi - lo);

  for (let i = 0; i < 60; i++) {
    if (cost(c) < cost(d)) {
      hi = d;
    } else {
      lo = c;
    }
    c = hi - gr * (hi - lo);
    d = lo + gr * (hi - lo);
    if (hi - lo < 0.0001) break;
  }

  return (lo + hi) / 2;
}

function PointInput({
  idx,
  point,
  onChange,
  theme,
}: {
  idx: number;
  point: ObservedPoint;
  onChange: (p: ObservedPoint) => void;
  theme: Theme;
}) {
  return (
    <View style={styles.pointCard}>
      <Text style={[styles.pointLabel, { color: theme.dim }]}>
        DATA POINT {idx + 1}
      </Text>
      <View style={styles.pointRow}>
        <View style={styles.pointField}>
          <Text style={[styles.fieldLabel, { color: theme.label }]}>Range (yd)</Text>
          <TextInput
            style={[styles.input, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
            value={point.rangeYd}
            onChangeText={(v) => onChange({ ...point, rangeYd: v })}
            placeholder="e.g. 500"
            placeholderTextColor={theme.dim}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.pointField}>
          <Text style={[styles.fieldLabel, { color: theme.label }]}>Path (in)</Text>
          <TextInput
            style={[styles.input, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
            value={point.pathIn}
            onChangeText={(v) => onChange({ ...point, pathIn: v })}
            placeholder="e.g. -45.2"
            placeholderTextColor={theme.dim}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
    </View>
  );
}

export function DSFTruingWizard({ profile, theme, onComplete, onClose }: Props) {
  const [points, setPoints] = useState<ObservedPoint[]>([
    { rangeYd: '', pathIn: '' },
    { rangeYd: '', pathIn: '' },
    { rangeYd: '', pathIn: '' },
  ]);
  const [result, setResult] = useState<{
    dsf: number;
    newBC: number;
    oldBC: number;
    residuals: number[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  function updatePoint(idx: number, p: ObservedPoint) {
    setPoints((prev) => prev.map((old, i) => (i === idx ? p : old)));
  }

  function compute() {
    const validPoints = points
      .map((p) => ({
        rangeYd: parseFloat(p.rangeYd),
        pathIn: parseFloat(p.pathIn),
      }))
      .filter((p) => !isNaN(p.rangeYd) && !isNaN(p.pathIn) && p.rangeYd >= 50);

    if (validPoints.length < 2) {
      Alert.alert('Need at least 2 valid data points', 'Enter range and observed path for at least 2 distances.');
      return;
    }

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

    const dsf = bisectDSF(inputs, validPoints);
    const newBC = (profile.load.bc as number) * dsf;

    // Compute residuals with the trued DSF
    const scaledInputs: TrajectoryInputs = {
      ...inputs,
      bullet: { ...inputs.bullet, bc: newBC as any },
    };
    const traj = computeTrajectory(scaledInputs);
    const residuals = validPoints.map((p) => {
      const row =
        traj.rows.find((r) => (r.rangeYards as number) >= p.rangeYd) ??
        traj.rows[traj.rows.length - 1]!;
      return Math.abs((row.pathInches as number) - p.pathIn);
    });

    setResult({ dsf, newBC, oldBC: profile.load.bc as number, residuals });
  }

  async function apply() {
    if (!result) return;
    setSaving(true);
    try {
      await upsertLoad({
        ...profile.load,
        bc: parseFloat(result.newBC.toFixed(4)) as any,
      });
      onComplete();
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
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.label} />
            </Pressable>
            <Text style={[styles.title, { color: theme.primary }]}>DSF TRUING</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.hint, { color: theme.dim }]}>
              Fire groups at 2–3 known distances. Enter the range and the observed
              path (+ above LOS, − below) in inches at each distance.
              The wizard finds the drag scale factor that fits your observed drops.
            </Text>

            <Text style={[styles.currentBC, { color: theme.dim }]}>
              Current BC: {profile.load.bc} ({profile.load.dragModel})
            </Text>

            {points.map((p, i) => (
              <PointInput
                key={i}
                idx={i}
                point={p}
                onChange={(updated) => updatePoint(i, updated)}
                theme={theme}
              />
            ))}

            <Pressable
              onPress={compute}
              style={[styles.computeBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.computeBtnText, { color: theme.bg }]}>COMPUTE DSF</Text>
            </Pressable>

            {result && (
              <View style={[styles.resultCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.resultTitle, { color: theme.label }]}>TRUING RESULT</Text>

                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Drag scale factor</Text>
                  <Text style={[styles.resultValue, { color: theme.primary }]}>
                    {result.dsf.toFixed(4)}×
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Original BC</Text>
                  <Text style={[styles.resultValue, { color: theme.dim }]}>
                    {result.oldBC.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Trued BC</Text>
                  <Text style={[styles.resultValue, { color: theme.primary }]}>
                    {result.newBC.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Max residual</Text>
                  <Text style={[styles.resultValue, {
                    color: Math.max(...result.residuals) > 2 ? '#F59E0B' : '#22C55E',
                  }]}>
                    {Math.max(...result.residuals).toFixed(2)}"
                  </Text>
                </View>

                {Math.abs(result.dsf - 1) > 0.15 && (
                  <Text style={[styles.warning, { color: '#F59E0B' }]}>
                    ⚠ Large DSF delta — verify your drop measurements before applying.
                  </Text>
                )}

                <Pressable
                  onPress={apply}
                  disabled={saving}
                  style={[styles.applyBtn, { borderColor: theme.primary }]}
                >
                  <Text style={[styles.applyBtnText, { color: saving ? theme.dim : theme.primary }]}>
                    {saving ? 'APPLYING…' : `APPLY — BC → ${result.newBC.toFixed(4)}`}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  body: { paddingHorizontal: 20, gap: 16, paddingBottom: 24 },
  hint: { fontFamily: FONT, fontSize: 11, lineHeight: 18 },
  currentBC: { fontFamily: FONT, fontSize: 11, letterSpacing: 0.5 },
  pointCard: { gap: 6 },
  pointLabel: { fontFamily: FONT, fontSize: 8, letterSpacing: 2 },
  pointRow: { flexDirection: 'row', gap: 12 },
  pointField: { flex: 1, gap: 4 },
  fieldLabel: { fontFamily: FONT, fontSize: 10, letterSpacing: 1 },
  input: {
    fontFamily: FONT,
    fontSize: 18,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  computeBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  computeBtnText: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  resultCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  resultTitle: { fontFamily: FONT, fontSize: 9, letterSpacing: 2 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontFamily: FONT, fontSize: 11 },
  resultValue: { fontFamily: FONT, fontSize: 18 },
  warning: { fontFamily: FONT, fontSize: 10, lineHeight: 16 },
  applyBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  applyBtnText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
});
