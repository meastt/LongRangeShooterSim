/**
 * TurretTapeExportModal — Custom scope turret tape generator modal.
 *
 * Uses `expo-print` to generate print-ready PDFs containing 1:1 scale
 * printable turret wraps, and `expo-sharing` to export or print.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateTurretTapeHtml } from '../utils/turretTape';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';

interface Props {
  visible: boolean;
  theme: Theme;
  rifleName: string;
  caliber: string;
  bulletName: string;
  weightGrains: number;
  muzzleVelocityFps: number;
  zeroRangeYards: number;
  clicksPerMrad: number;
  trajectoryRows: Array<{ rangeYards: number; elevHoldMils: number }>;
  onClose: () => void;
}

export function TurretTapeExportModal({
  visible,
  theme,
  rifleName,
  caliber,
  bulletName,
  weightGrains,
  muzzleVelocityFps,
  zeroRangeYards,
  clicksPerMrad,
  trajectoryRows,
  onClose,
}: Props) {
  const [turretDiameter, setTurretDiameter] = useState('30');
  const [tapeHeight, setTapeHeight] = useState('12');
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportPdf() {
    try {
      setIsExporting(true);
      const diamMm = parseFloat(turretDiameter) || 30;
      const heightMm = parseFloat(tapeHeight) || 12;

      const html = generateTurretTapeHtml({
        rifleName,
        caliber,
        bulletName,
        weightGrains,
        muzzleVelocityFps,
        zeroRangeYards,
        clicksPerMrad,
        turretDiameterMm: diamMm,
        tapeHeightMm: heightMm,
        trajectoryRows,
      });

      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Export Turret Tape — ${rifleName}`,
        });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate PDF';
      Alert.alert('Export Failed', msg);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.primary }]}>CUSTOM TURRET TAPE PDF</Text>

          <Text style={[styles.desc, { color: theme.label }]}>
            Generate a 1:1 scale printable scope turret tape wrap customized for {rifleName} ({caliber}).
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.label }]}>Turret Outer Diameter (mm)</Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border },
              ]}
              value={turretDiameter}
              onChangeText={setTurretDiameter}
              keyboardType="decimal-pad"
              placeholder="30"
              placeholderTextColor={theme.dim}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.label }]}>Tape Band Height (mm)</Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.primary, backgroundColor: theme.bg, borderColor: theme.border },
              ]}
              value={tapeHeight}
              onChangeText={setTapeHeight}
              keyboardType="decimal-pad"
              placeholder="12"
              placeholderTextColor={theme.dim}
            />
          </View>

          <View style={styles.btnRow}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, styles.cancelBtn, { borderColor: theme.border }]}
              disabled={isExporting}
            >
              <Text style={[styles.btnText, { color: theme.dim }]}>CANCEL</Text>
            </Pressable>

            <Pressable
              onPress={handleExportPdf}
              style={[styles.btn, styles.exportBtn, { backgroundColor: theme.primary }]}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={[styles.btnText, { color: '#000', fontWeight: 'bold' }]}>GENERATE PDF</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  title: {
    fontFamily: FONT,
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  desc: {
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: FONT,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  exportBtn: {},
  btnText: {
    fontFamily: FONT,
    fontSize: 12,
    letterSpacing: 1,
  },
});
