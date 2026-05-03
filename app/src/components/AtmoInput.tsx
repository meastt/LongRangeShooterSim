/**
 * AtmoInput — atmospheric condition display and override entry.
 *
 * Shows current temp (override or zero-time standard).
 * Tap the chip to open a modal for overriding:
 *   • Temperature (°F)
 *   • Station pressure (inHg)
 *   • Relative humidity (%)
 *
 * "RESET TO STANDARD" clears the override and restores the solver to the
 * atmosphere recorded at zero time.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldStore } from '../store/fieldStore';
import { useSolverResult } from '../hooks/useSolverResult';
import { ICAO_STANDARD_ATMOSPHERE } from '@aim/solver';
import { fetchSurfaceWeather } from '../utils/weather';
import type { Theme } from '../theme';

interface Props {
  theme: Theme;
}

function NumericField({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  unit: string;
  theme: Theme;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.label }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={[
            styles.fieldInput,
            {
              color: theme.primary,
              backgroundColor: theme.bg,
              borderColor: theme.border,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.dim}
          keyboardType="decimal-pad"
          autoCorrect={false}
        />
        <Text style={[styles.fieldUnit, { color: theme.dim }]}>{unit}</Text>
      </View>
    </View>
  );
}

export function AtmoInput({ theme }: Props) {
  const result = useSolverResult();
  const override = useFieldStore((s) => s.atmosphericOverride);
  const setAtmosphericOverride = useFieldStore((s) => s.setAtmosphericOverride);

  const [visible, setVisible] = useState(false);
  const [draftTemp, setDraftTemp] = useState('');
  const [draftPressure, setDraftPressure] = useState('');
  const [draftHumidity, setDraftHumidity] = useState('');
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherAge, setWeatherAge] = useState<number | null>(null);

  // Use override if set, otherwise profile snapshot, otherwise ICAO standard.
  const current = override ?? result?.profile.atmosphericSnapshot ?? ICAO_STANDARD_ATMOSPHERE;

  const openModal = useCallback(() => {
    setDraftTemp(String(current.temperatureFahrenheit));
    setDraftPressure(String(current.pressureInHg));
    setDraftHumidity(String(current.relativeHumidityPct));
    setVisible(true);
  }, [current]);

  async function fetchLiveWeather() {
    setFetchingWeather(true);
    try {
      // Dynamic import avoids bundle-time resolution errors in environments
      // where expo-location isn't linked yet (e.g. CI, web).
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[AtmoInput] Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const wx = await fetchSurfaceWeather(loc.coords.latitude, loc.coords.longitude);
      setDraftTemp(String(Math.round(wx.conditions.temperatureFahrenheit as number)));
      setDraftPressure(String((wx.conditions.pressureInHg as number).toFixed(2)));
      setDraftHumidity(String(Math.round(wx.conditions.relativeHumidityPct)));
      setWeatherAge(Math.round(wx.ageMinutes));
    } catch (err) {
      console.warn('[AtmoInput] Weather fetch failed:', err);
    } finally {
      setFetchingWeather(false);
    }
  }

  function apply() {
    const temp = parseFloat(draftTemp);
    const pressure = parseFloat(draftPressure);
    const humidity = parseFloat(draftHumidity);

    if (isNaN(temp) || isNaN(pressure) || isNaN(humidity)) return;

    setAtmosphericOverride({
      temperatureFahrenheit: temp as any,
      pressureInHg: Math.max(25, Math.min(32, pressure)) as any,
      relativeHumidityPct: Math.max(0, Math.min(100, humidity)),
    });
    setVisible(false);
  }

  function reset() {
    setAtmosphericOverride(null);
    setWeatherAge(null);
    setVisible(false);
  }

  if (!result) return null;

  const isOverride = override !== null;

  return (
    <>
      {/* Compact chip shown on the Field screen */}
      <Pressable
        style={[
          styles.chip,
          {
            backgroundColor: theme.surface,
            borderColor: isOverride ? theme.primary : theme.border,
          },
        ]}
        onPress={openModal}
        accessibilityLabel={`Atmosphere: ${Math.round(current.temperatureFahrenheit)}°F, ${current.pressureInHg.toFixed(2)} inHg. Tap to adjust.`}
      >
        <View style={styles.chipContent}>
          <Ionicons name="thermometer-outline" size={16} color={theme.primary} />
          <Text style={[styles.chipValue, { color: theme.primary }]}>
            {Math.round(current.temperatureFahrenheit)}°
          </Text>
          <Text style={[styles.chipUnit, { color: theme.dim }]}>F</Text>
        </View>
        <Text style={[styles.chipLabel, { color: isOverride ? theme.primary : theme.label }]}>
          {isOverride ? 'OVERRIDE' : 'STANDARD'}
        </Text>
      </Pressable>

      {/* Atmospheric override modal */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={[styles.sheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.label} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.primary }]}>ATMOSPHERE</Text>
              <Pressable onPress={apply} hitSlop={12} accessibilityLabel="Apply atmospheric override">
                <Text style={[styles.applyBtn, { color: theme.primary }]}>APPLY</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">

              <Text style={[styles.hint, { color: theme.dim }]}>
                Override the atmospheric conditions for this solve. Useful when
                conditions have changed since your zero session.
              </Text>

              {/* Live weather fetch */}
              <Pressable
                onPress={fetchLiveWeather}
                disabled={fetchingWeather}
                style={[styles.weatherBtn, { borderColor: theme.primary }]}
                accessibilityLabel="Fetch live weather from Open-Meteo"
              >
                {fetchingWeather
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <Ionicons name="cloud-download-outline" size={16} color={theme.primary} />
                }
                <Text style={[styles.weatherBtnText, { color: fetchingWeather ? theme.dim : theme.primary }]}>
                  {fetchingWeather ? 'FETCHING…' : 'FETCH LIVE WEATHER'}
                </Text>
              </Pressable>
              {weatherAge !== null && (
                <Text style={[styles.weatherAge, { color: theme.dim }]}>
                  {weatherAge < 1 ? 'Data is fresh' : `Data is ${weatherAge} min old`} · Open-Meteo
                </Text>
              )}

              <NumericField
                label="Temperature"
                value={draftTemp}
                onChangeText={setDraftTemp}
                placeholder={String(ICAO_STANDARD_ATMOSPHERE.temperatureFahrenheit)}
                unit="°F"
                theme={theme}
              />
              <NumericField
                label="Station pressure"
                value={draftPressure}
                onChangeText={setDraftPressure}
                placeholder={String(ICAO_STANDARD_ATMOSPHERE.pressureInHg)}
                unit="inHg"
                theme={theme}
              />
              <NumericField
                label="Relative humidity"
                value={draftHumidity}
                onChangeText={setDraftHumidity}
                placeholder={String(ICAO_STANDARD_ATMOSPHERE.relativeHumidityPct)}
                unit="%"
                theme={theme}
              />

              {/* ICAO reference */}
              <View style={[styles.referenceCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.referenceTitle, { color: theme.dim }]}>ICAO STANDARD</Text>
                <Text style={[styles.referenceValue, { color: theme.dim }]}>
                  {ICAO_STANDARD_ATMOSPHERE.temperatureFahrenheit}°F ·{' '}
                  {ICAO_STANDARD_ATMOSPHERE.pressureInHg} inHg ·{' '}
                  {ICAO_STANDARD_ATMOSPHERE.relativeHumidityPct}% RH
                </Text>
              </View>

              {/* Reset button */}
              <Pressable
                onPress={reset}
                style={[styles.resetBtn, { borderColor: theme.dim }]}
                accessibilityLabel="Reset to zero-time atmosphere"
              >
                <Ionicons name="refresh-outline" size={16} color={theme.dim} />
                <Text style={[styles.resetText, { color: theme.dim }]}>
                  RESET TO ZERO-TIME STANDARD
                </Text>
              </Pressable>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  // Chip
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
    gap: 2,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipValue: { fontFamily: FONT, fontSize: 16 },
  chipUnit: { fontFamily: FONT, fontSize: 10 },
  chipLabel: { fontFamily: FONT, fontSize: 9, letterSpacing: 1 },

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
  hint: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 18,
  },

  // Weather fetch button
  weatherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
  },
  weatherBtnText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
  weatherAge: { fontFamily: FONT, fontSize: 9, textAlign: 'center', letterSpacing: 0.5 },

  // Numeric field
  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: FONT, fontSize: 10, letterSpacing: 1.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldInput: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 22,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldUnit: { fontFamily: FONT, fontSize: 13, width: 40 },

  // Reference card
  referenceCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  referenceTitle: { fontFamily: FONT, fontSize: 9, letterSpacing: 2 },
  referenceValue: { fontFamily: FONT, fontSize: 11 },

  // Reset button
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 4,
  },
  resetText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
});
