/**
 * ProfileShare — signed QR code generator and scanner for rifle profile handoff.
 *
 * Architecture (v1 — no server):
 *   Export: serialize the full FieldProfile to JSON, compute a SHA-256 digest
 *   of the payload as a lightweight integrity check, embed both in a QR code.
 *   The QR payload is a base64-encoded JSON envelope:
 *     { v: 1, sig: sha256hex, data: FieldProfile }
 *
 *   Import: scan a QR code with expo-camera, verify the sig matches the data,
 *   then offer to import the profile into the local DB.
 *
 * Note: SHA-256 via expo-crypto is a tamper-detection check, not an
 * authentication signature. Full Ed25519 signing deferred to v2 when we have
 * a server-side key registry.
 *
 * Tabs:
 *   SHARE  — shows generated QR + copy-to-clipboard button
 *   IMPORT — opens camera scanner, parses and imports on successful read
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { upsertRifle, upsertLoad, upsertScope, upsertZero } from '../db/queries';
import type { FieldProfile } from '../db/queries';
import type { Theme } from '../theme';

const FONT = 'SpaceMono-Regular';
const PAYLOAD_VERSION = 1;

// ─── Payload helpers ──────────────────────────────────────────────────────────

async function buildQRPayload(profile: FieldProfile): Promise<string> {
  const data = JSON.stringify(profile);
  const sig = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data,
  );
  const envelope = { v: PAYLOAD_VERSION, sig, data };
  return btoa(unescape(encodeURIComponent(JSON.stringify(envelope))));
}

type ParseResult =
  | { ok: true; profile: FieldProfile }
  | { ok: false; error: string };

async function parseQRPayload(raw: string): Promise<ParseResult> {
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const envelope = JSON.parse(json) as { v: number; sig: string; data: string };
    if (envelope.v !== PAYLOAD_VERSION) {
      return { ok: false, error: `Unsupported payload version: ${envelope.v}` };
    }
    const expectedSig = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      envelope.data,
    );
    if (expectedSig !== envelope.sig) {
      return { ok: false, error: 'Signature mismatch — payload may be corrupted.' };
    }
    const profile = JSON.parse(envelope.data) as FieldProfile;
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, error: `Parse error: ${String(e)}` };
  }
}

async function importProfile(profile: FieldProfile): Promise<void> {
  // Generate fresh IDs so the import never conflicts with existing records.
  const rifleId = Crypto.randomUUID();
  const loadId = Crypto.randomUUID();
  const scopeId = Crypto.randomUUID();
  const zeroId = Crypto.randomUUID();

  await upsertRifle({ ...profile.rifle, id: rifleId });
  await upsertLoad({ ...profile.load, id: loadId, rifleId });
  await upsertScope({ ...profile.scope, id: scopeId, rifleId });
  await upsertZero({
    ...profile.zero,
    id: zeroId,
    loadId,
    scopeId,
  });
}

// ─── Share tab ────────────────────────────────────────────────────────────────

function ShareTab({ profile, theme }: { profile: FieldProfile; theme: Theme }) {
  const [payload, setPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const p = await buildQRPayload(profile);
      setPayload(p);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  async function shareText() {
    if (!payload) return;
    await Share.share({
      message: `Aim profile: ${payload}`,
      title: `${profile.rifle.name} — ${profile.rifle.caliber}`,
    });
  }

  return (
    <View style={styles.tabContent}>
      <Text style={[styles.hint, { color: theme.dim }]}>
        Generate a QR code your hunting partner can scan to import your rifle
        profile instantly. No internet required.
      </Text>

      <View style={[styles.profileSummary, { borderColor: theme.border }]}>
        <Text style={[styles.profileName, { color: theme.primary }]}>{profile.rifle.name}</Text>
        <Text style={[styles.profileSub, { color: theme.dim }]}>
          {profile.rifle.caliber} · {Math.round(profile.load.weightGrains)}gr {profile.load.bulletName}
        </Text>
        <Text style={[styles.profileSub, { color: theme.dim }]}>
          MV {Math.round(profile.load.muzzleVelocityFps as number)} fps · {profile.load.dragModel} BC {profile.load.bc}
        </Text>
        <Text style={[styles.profileSub, { color: theme.dim }]}>
          Zero: {profile.zero.zeroRangeYards}yd · Scope ht: {profile.zero.scopeHeightInches}"
        </Text>
      </View>

      {!payload ? (
        <Pressable
          onPress={generate}
          disabled={loading}
          style={[styles.generateBtn, { backgroundColor: theme.primary }]}
        >
          {loading
            ? <ActivityIndicator color={theme.bg} />
            : <Text style={[styles.generateBtnText, { color: theme.bg }]}>GENERATE QR CODE</Text>
          }
        </Pressable>
      ) : (
        <>
          <View style={[styles.qrContainer, { backgroundColor: '#fff' }]}>
            <QRCode
              value={payload}
              size={220}
              color="#000"
              backgroundColor="#fff"
            />
          </View>
          <Text style={[styles.qrHint, { color: theme.dim }]}>
            Have your partner open Aim → Settings → Import Profile, then scan this code.
          </Text>
          <Pressable
            onPress={shareText}
            style={[styles.shareTextBtn, { borderColor: theme.primary }]}
          >
            <Ionicons name="share-outline" size={16} color={theme.primary} />
            <Text style={[styles.shareTextBtnText, { color: theme.primary }]}>
              SHARE AS TEXT (if QR unavailable)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPayload(null)}
            style={[styles.regenerateBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.regenerateBtnText, { color: theme.dim }]}>REGENERATE</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ─── Import tab ───────────────────────────────────────────────────────────────

function ImportTab({ theme, onImported }: { theme: Theme; onImported: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<FieldProfile | null>(null);
  const hasScanned = useRef(false);

  async function handleBarcode(data: string) {
    if (hasScanned.current || importing) return;
    hasScanned.current = true;
    setScanning(false);

    const result = await parseQRPayload(data);
    if (!result.ok) {
      Alert.alert('Invalid QR', result.error, [
        { text: 'Try again', onPress: () => { hasScanned.current = false; setScanning(true); } },
        { text: 'Cancel' },
      ]);
      return;
    }
    setPreview(result.profile);
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      await importProfile(preview);
      Alert.alert('Imported!', `${preview.rifle.name} has been added to your profiles.`);
      setPreview(null);
      onImported();
    } catch (e) {
      Alert.alert('Import failed', String(e));
    } finally {
      setImporting(false);
    }
  }

  if (!permission) {
    return <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.tabContent}>
        <Text style={[styles.hint, { color: theme.dim }]}>
          Camera access is required to scan profile QR codes.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={[styles.generateBtn, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.generateBtnText, { color: theme.bg }]}>ALLOW CAMERA</Text>
        </Pressable>
      </View>
    );
  }

  if (preview) {
    return (
      <View style={styles.tabContent}>
        <Text style={[styles.importTitle, { color: theme.label }]}>IMPORT PROFILE?</Text>
        <View style={[styles.profileSummary, { borderColor: theme.border }]}>
          <Text style={[styles.profileName, { color: theme.primary }]}>{preview.rifle.name}</Text>
          <Text style={[styles.profileSub, { color: theme.dim }]}>
            {preview.rifle.caliber} · {Math.round(preview.load.weightGrains)}gr {preview.load.bulletName}
          </Text>
          <Text style={[styles.profileSub, { color: theme.dim }]}>
            MV {Math.round(preview.load.muzzleVelocityFps as number)} fps · {preview.load.dragModel} BC {preview.load.bc}
          </Text>
          <Text style={[styles.profileSub, { color: theme.dim }]}>
            Zero: {preview.zero.zeroRangeYards}yd
          </Text>
        </View>
        <Pressable
          onPress={confirmImport}
          disabled={importing}
          style={[styles.generateBtn, { backgroundColor: theme.primary }]}
        >
          {importing
            ? <ActivityIndicator color={theme.bg} />
            : <Text style={[styles.generateBtnText, { color: theme.bg }]}>IMPORT</Text>
          }
        </Pressable>
        <Pressable
          onPress={() => { setPreview(null); hasScanned.current = false; }}
          style={[styles.regenerateBtn, { borderColor: theme.border }]}
        >
          <Text style={[styles.regenerateBtnText, { color: theme.dim }]}>CANCEL</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={[styles.hint, { color: theme.dim }]}>
        Point your camera at a profile QR code generated from another Aim device.
      </Text>

      {scanning ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(e) => handleBarcode(e.data)}
          />
          <View style={styles.scanOverlay}>
            <View style={[styles.scanCornerTL, { borderColor: theme.primary }]} />
            <View style={[styles.scanCornerTR, { borderColor: theme.primary }]} />
            <View style={[styles.scanCornerBL, { borderColor: theme.primary }]} />
            <View style={[styles.scanCornerBR, { borderColor: theme.primary }]} />
          </View>
          <Pressable
            onPress={() => setScanning(false)}
            style={[styles.cancelScanBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
          >
            <Text style={[styles.cancelScanText, { color: '#fff' }]}>CANCEL</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { hasScanned.current = false; setScanning(true); }}
          style={[styles.generateBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="qr-code-outline" size={18} color={theme.bg} />
          <Text style={[styles.generateBtnText, { color: theme.bg }]}>SCAN QR CODE</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Root modal ───────────────────────────────────────────────────────────────

interface Props {
  profile: FieldProfile;
  theme: Theme;
  onClose: () => void;
  onImported: () => void;
}

export function ProfileShare({ profile, theme, onClose, onImported }: Props) {
  const [tab, setTab] = useState<'share' | 'import'>('share');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.label} />
            </Pressable>
            <Text style={[styles.title, { color: theme.primary }]}>PROFILE SHARE</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Tab bar */}
          <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            {(['share', 'import'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[
                  styles.tabBarBtn,
                  tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
                ]}
              >
                <Text style={[
                  styles.tabBarBtnText,
                  { color: tab === t ? theme.primary : theme.dim },
                ]}>
                  {t === 'share' ? 'SHARE' : 'IMPORT'}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {tab === 'share'
              ? <ShareTab profile={profile} theme={theme} />
              : <ImportTab theme={theme} onImported={() => { onImported(); onClose(); }} />
            }
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBarBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBarBtnText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1.5 },
  scroll: { paddingBottom: 8 },
  tabContent: { padding: 20, gap: 16 },
  hint: { fontFamily: FONT, fontSize: 11, lineHeight: 18 },
  importTitle: { fontFamily: FONT, fontSize: 13, letterSpacing: 2, textAlign: 'center' },
  profileSummary: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  profileName: { fontFamily: FONT, fontSize: 15, letterSpacing: 0.3 },
  profileSub: { fontFamily: FONT, fontSize: 10, letterSpacing: 0.3 },
  generateBtn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  generateBtnText: { fontFamily: FONT, fontSize: 13, letterSpacing: 2 },
  qrContainer: {
    alignSelf: 'center',
    padding: 16,
    borderRadius: 12,
  },
  qrHint: { fontFamily: FONT, fontSize: 10, textAlign: 'center', lineHeight: 16 },
  shareTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
  },
  shareTextBtnText: { fontFamily: FONT, fontSize: 10, letterSpacing: 1 },
  regenerateBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  regenerateBtnText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
  // Camera scanner
  cameraContainer: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCornerTL: { position: 'absolute', top: 40, left: 40, width: 32, height: 32, borderTopWidth: 3, borderLeftWidth: 3, borderRadius: 2 },
  scanCornerTR: { position: 'absolute', top: 40, right: 40, width: 32, height: 32, borderTopWidth: 3, borderRightWidth: 3, borderRadius: 2 },
  scanCornerBL: { position: 'absolute', bottom: 40, left: 40, width: 32, height: 32, borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: 2 },
  scanCornerBR: { position: 'absolute', bottom: 40, right: 40, width: 32, height: 32, borderBottomWidth: 3, borderRightWidth: 3, borderRadius: 2 },
  cancelScanBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelScanText: { fontFamily: FONT, fontSize: 11, letterSpacing: 1 },
});
