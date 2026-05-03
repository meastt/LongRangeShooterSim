/**
 * TallTargetWizard — scope tracking verification from a tall-target test.
 *
 * Protocol:
 *   1. Set up a target at a known range with a vertical reference of known height
 *      (e.g. an 18" grid paper pinned vertically).
 *   2. Zero the scope. Fire at the bottom of the target, then dial up N clicks,
 *      fire again. Measure the actual vertical distance between impacts.
 *   3. Enter range, known impact delta (inches), and clicks dialed.
 *
 * Expected inches per click = (rangeYards × 0.036) / clicksPerMrad
 * Measured inches per click = measuredDeltaIn / clicksDialed
 * Tracking error % = (measured - expected) / expected × 100
 *
 * A perfect scope tracks 0% error. ±5% is acceptable. >±10% warrants concern.
 *
 * Reference: Litz, Applied Ballistics for Long Range Shooting, 3rd ed., §13.
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
import type { Theme } from '../../theme';
import type { FieldProfile } from '../../db/queries';

const FONT = 'SpaceMono-Regular';

interface Props {
  profile: FieldProfile;
  theme: Theme;
  onClose: () => void;
}

export function TallTargetWizard({ profile, theme, onClose }: Props) {
  const [rangeYd, setRangeYd] = useState('');
  const [clicksDialed, setClicksDialed] = useState('');
  const [measuredDeltaIn, setMeasuredDeltaIn] = useState('');
  const [result, setResult] = useState<{
    expectedPerClick: number;
    measuredPerClick: number;
    trackingErrorPct: number;
    verdict: 'pass' | 'marginal' | 'fail';
  } | null>(null);

  const clicksPerMrad = profile.scope.clicksPerMrad;

  function compute() {
    const range = parseFloat(rangeYd);
    const clicks = parseFloat(clicksDialed);
    const delta = parseFloat(measuredDeltaIn);

    if (isNaN(range) || range < 50 || range > 1760) {
      Alert.alert('Invalid range', 'Enter a range between 50 and 1760 yards.');
      return;
    }
    if (isNaN(clicks) || clicks <= 0) {
      Alert.alert('Invalid clicks', 'Enter a positive number of clicks dialed.');
      return;
    }
    if (isNaN(delta) || delta <= 0) {
      Alert.alert('Invalid delta', 'Enter the measured vertical distance between impacts in inches.');
      return;
    }

    // Expected: 1 MRAD at range = rangeYards × 0.036 inches
    // Expected per click = (range × 0.036) / clicksPerMrad
    const expectedPerClick = (range * 0.036) / clicksPerMrad;
    const measuredPerClick = delta / clicks;
    const trackingErrorPct = ((measuredPerClick - expectedPerClick) / expectedPerClick) * 100;

    const absErr = Math.abs(trackingErrorPct);
    const verdict = absErr <= 5 ? 'pass' : absErr <= 10 ? 'marginal' : 'fail';

    setResult({ expectedPerClick, measuredPerClick, trackingErrorPct, verdict });
  }

  const verdictColor = result
    ? result.verdict === 'pass'
      ? '#22C55E'
      : result.verdict === 'marginal'
        ? '#F59E0B'
        : '#EF4444'
    : theme.primary;

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
            <Text style={[styles.title, { color: theme.primary }]}>TALL-TARGET TEST</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.hint, { color: theme.dim }]}>
              Protocol: fire a shot at the bottom of a tall target. Dial N clicks up.
              Fire again. Measure the vertical distance between impacts in inches.
              This verifies scope tracking accuracy.
            </Text>

            <Text style={[styles.scopeInfo, { color: theme.dim }]}>
              Scope: {profile.scope.name} · {clicksPerMrad} clicks/mrad
            </Text>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.label }]}>Range to target (yd)</Text>
              <TextInput
                style={[styles.input, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={rangeYd}
                onChangeText={setRangeYd}
                placeholder="e.g. 100"
                placeholderTextColor={theme.dim}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.label }]}>Clicks dialed up</Text>
              <TextInput
                style={[styles.input, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={clicksDialed}
                onChangeText={setClicksDialed}
                placeholder="e.g. 20"
                placeholderTextColor={theme.dim}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.label }]}>
                Measured distance between impacts (inches)
              </Text>
              <TextInput
                style={[styles.input, { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border }]}
                value={measuredDeltaIn}
                onChangeText={setMeasuredDeltaIn}
                placeholder="e.g. 7.2"
                placeholderTextColor={theme.dim}
                keyboardType="decimal-pad"
              />
            </View>

            <Pressable
              onPress={compute}
              style={[styles.computeBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.computeBtnText, { color: theme.bg }]}>COMPUTE</Text>
            </Pressable>

            {result && (
              <View style={[styles.resultCard, { backgroundColor: theme.bg, borderColor: verdictColor }]}>
                <View style={styles.verdictRow}>
                  <Text style={[styles.verdictLabel, { color: verdictColor }]}>
                    {result.verdict === 'pass'
                      ? '✓ SCOPE TRACKING CONFIRMED'
                      : result.verdict === 'marginal'
                        ? '⚠ MARGINAL TRACKING'
                        : '✕ TRACKING ERROR — VERIFY SCOPE'}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Tracking error</Text>
                  <Text style={[styles.resultValue, { color: verdictColor }]}>
                    {result.trackingErrorPct >= 0 ? '+' : ''}{result.trackingErrorPct.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Expected per click</Text>
                  <Text style={[styles.resultValue, { color: theme.label }]}>
                    {result.expectedPerClick.toFixed(3)}"
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.dim }]}>Measured per click</Text>
                  <Text style={[styles.resultValue, { color: theme.label }]}>
                    {result.measuredPerClick.toFixed(3)}"
                  </Text>
                </View>

                {result.verdict !== 'pass' && (
                  <Text style={[styles.advice, { color: theme.dim }]}>
                    {result.verdict === 'marginal'
                      ? 'Re-test at the same range with more clicks to confirm. Check for loose scope rings.'
                      : 'Return scope to factory settings and re-zero. Have scope serviced if error persists.'}
                  </Text>
                )}
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
    maxHeight: '90%',
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
  scopeInfo: { fontFamily: FONT, fontSize: 10, letterSpacing: 0.5 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FONT, fontSize: 10, letterSpacing: 1.5 },
  input: {
    fontFamily: FONT,
    fontSize: 22,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  computeBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  computeBtnText: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  resultCard: { borderWidth: 2, borderRadius: 10, padding: 14, gap: 10 },
  verdictRow: { alignItems: 'center', paddingBottom: 4 },
  verdictLabel: { fontFamily: FONT, fontSize: 11, letterSpacing: 1, textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontFamily: FONT, fontSize: 11 },
  resultValue: { fontFamily: FONT, fontSize: 20 },
  advice: { fontFamily: FONT, fontSize: 10, lineHeight: 16, marginTop: 4 },
});
