/**
 * MVTruingWizard — muzzle velocity truing from observed drop.
 *
 * The shooter fires a group at a known range, measures the actual impact
 * point (inches above/below the predicted point of impact), and this wizard
 * back-solves the MV that would produce the observed drop.
 *
 * Algorithm: binary bisection on MV over [MVmin=500, MVmax=5000] fps.
 * Converges to <0.1 fps in ~45 iterations.
 *
 * After truing: updates the load's muzzleVelocityFps in the database.
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

interface Props {
  profile: FieldProfile;
  theme: Theme;
  onComplete: () => void;
  onClose: () => void;
}

const FONT = 'SpaceMono-Regular';

/**
 * Binary search: find the MV that produces the target drop at the given range.
 * Returns the trued MV in fps.
 */
function bisectMV(
  inputs: TrajectoryInputs,
  observedPathInches: number,
  rangeYards: number,
): number {
  let lo = 500;
  let hi = 5000;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const traj = computeTrajectory({
      ...inputs,
      muzzleVelocityFps: mid as TrajectoryInputs['muzzleVelocityFps'],
    });
    const row = traj.rows.find((r) => (r.rangeYards as number) >= rangeYards) ??
                traj.rows[traj.rows.length - 1];
    if (!row) break;

    // pathInches: negative = below LOS. Solver produces negative values below zero.
    if ((row.pathInches as number) > observedPathInches) {
      hi = mid;   // computed too high → reduce MV
    } else {
      lo = mid;   // computed too low → increase MV
    }

    if (hi - lo < 0.1) break;
  }

  return (lo + hi) / 2;
}

export function MVTruingWizard({ profile, theme, onComplete, onClose }: Props) {
  const [rangeYd, setRangeYd] = useState('');
  const [observedDrop, setObservedDrop] = useState('');
  const [result, setResult] = useState<{ truedMV: number; deltaFps: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const currentMV = profile.load.muzzleVelocityFps as number;

  function compute() {
    const range = parseFloat(rangeYd);
    const drop = parseFloat(observedDrop);
    if (isNaN(range) || range < 50 || range > 1760) {
      Alert.alert('Invalid range', 'Enter a range between 50 and 1760 yards.');
      return;
    }
    if (isNaN(drop)) {
      Alert.alert('Invalid drop', 'Enter the observed path in inches (negative = below LOS).');
      return;
    }

    const inputs: TrajectoryInputs = {
      bullet: {
        weightGrains: profile.load.weightGrains as any,
        diameterInches: profile.load.diameterInches as any,
        bc: profile.load.bc as any,
        dragModel: profile.load.dragModel as 'G1' | 'G7',
      },
      muzzleVelocityFps: currentMV as any,
      scopeHeightInches: profile.zero.scopeHeightInches as any,
      zeroRangeYards: profile.zero.zeroRangeYards as any,
      atmosphere: profile.atmosphericSnapshot,
    };

    const truedMV = bisectMV(inputs, drop, range);
    setResult({ truedMV, deltaFps: truedMV - currentMV });
  }

  async function applyTruing() {
    if (!result) return;
    setSaving(true);
    try {
      await upsertLoad({
        ...profile.load,
        muzzleVelocityFps: Math.round(result.truedMV) as any,
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
            <Text style={[styles.title, { color: theme.primary }]}>MV TRUING</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.hint, { color: theme.dim }]}>
              Fire a confirmed group at a known range. Enter the range and the
              observed impact path (+ above LOS, − below) in inches.
              The wizard back-solves your true muzzle velocity.
            </Text>

            <Text style={[styles.currentMV, { color: theme.dim }]}>
              Current MV: {currentMV} fps
            </Text>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.label }]}>Firing range (yd)</Text>
              <TextInput
                style={[styles.input, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={rangeYd}
                onChangeText={setRangeYd}
                placeholder="e.g. 500"
                placeholderTextColor={theme.dim}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.label }]}>
                Observed path at that range (inches)
              </Text>
              <Text style={[styles.fieldHint, { color: theme.dim }]}>
                Negative = bullet hit below predicted impact. Use a ruler on your
                target or a spotting scope.
              </Text>
              <TextInput
                style={[styles.input, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={observedDrop}
                onChangeText={setObservedDrop}
                placeholder="e.g. -52.1"
                placeholderTextColor={theme.dim}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <Pressable
              onPress={compute}
              style={[styles.computeBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.computeBtnText, { color: theme.bg }]}>COMPUTE</Text>
            </Pressable>

            {result && (
              <View style={[styles.resultCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.resultTitle, { color: theme.label }]}>TRUING RESULT</Text>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Trued MV</Text>
                  <Text style={[styles.resultValue, { color: theme.primary }]}>
                    {Math.round(result.truedMV)} fps
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Delta from current</Text>
                  <Text style={[styles.resultValue, { color: Math.abs(result.deltaFps) > 50 ? '#F59E0B' : theme.label }]}>
                    {result.deltaFps >= 0 ? '+' : ''}{Math.round(result.deltaFps)} fps
                  </Text>
                </View>
                {Math.abs(result.deltaFps) > 100 && (
                  <Text style={[styles.warning, { color: '#F59E0B' }]}>
                    ⚠ Large MV delta — verify your observed drop measurement before applying.
                  </Text>
                )}
                <Pressable
                  onPress={applyTruing}
                  disabled={saving}
                  style={[styles.applyBtn, { borderColor: theme.primary }]}
                >
                  <Text style={[styles.applyBtnText, { color: saving ? theme.dim : theme.primary }]}>
                    {saving ? 'APPLYING…' : `APPLY — UPDATE TO ${Math.round(result.truedMV)} FPS`}
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
  sheet: { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  body: { paddingHorizontal: 20, gap: 16, paddingBottom: 24 },
  hint: { fontFamily: FONT, fontSize: 11, lineHeight: 18 },
  currentMV: { fontFamily: FONT, fontSize: 11, letterSpacing: 0.5 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FONT, fontSize: 10, letterSpacing: 1.5 },
  fieldHint: { fontFamily: FONT, fontSize: 10, lineHeight: 16, marginBottom: 2 },
  input: { fontFamily: FONT, fontSize: 22, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  computeBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  computeBtnText: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  resultCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  resultTitle: { fontFamily: FONT, fontSize: 9, letterSpacing: 2 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontFamily: FONT, fontSize: 11 },
  resultValue: { fontFamily: FONT, fontSize: 20 },
  warning: { fontFamily: FONT, fontSize: 10, lineHeight: 16 },
  applyBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  applyBtnText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
});
