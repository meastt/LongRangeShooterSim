/**
 * Scan / connect panel for Field Mode BLE devices.
 * Spec: docs/specs/ble-supervisor.md
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useBleSupervisor } from '../ble/supervisor';
import type { Theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
}

export function BleDevicesPanel({ visible, onClose, theme }: Props) {
  const scanning = useBleSupervisor((s) => s.scanning);
  const scanned = useBleSupervisor((s) => s.scanned);
  const devices = useBleSupervisor((s) => s.devices);
  const nativeAvailable = useBleSupervisor((s) => s.nativeAvailable);
  const startScan = useBleSupervisor((s) => s.startScan);
  const stopScan = useBleSupervisor((s) => s.stopScan);
  const connect = useBleSupervisor((s) => s.connect);
  const disconnect = useBleSupervisor((s) => s.disconnect);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.label }]}>FIELD DEVICES</Text>
        <Text style={[styles.hint, { color: theme.dim }]}>
          Manual Wind / Atmo / Range always work. BLE is optional.
          {!nativeAvailable ? ' Native BLE needs an EAS / expo run build (not Expo Go).' : ''}
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: theme.primary, minHeight: 56 }]}
            onPress={() => void (scanning ? stopScan() : startScan())}
            accessibilityLabel={scanning ? 'Stop Bluetooth scan' : 'Start Bluetooth scan'}
          >
            {scanning ? (
              <ActivityIndicator color={theme.bg} />
            ) : (
              <Text style={[styles.btnText, { color: theme.bg }]}>
                {scanning ? 'STOP' : 'SCAN'}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, { borderColor: theme.border, borderWidth: 1, minHeight: 56 }]}
            onPress={onClose}
            accessibilityLabel="Close devices panel"
          >
            <Text style={[styles.btnText, { color: theme.label }]}>CLOSE</Text>
          </Pressable>
        </View>

        {devices.length > 0 && (
          <>
            <Text style={[styles.section, { color: theme.dim }]}>CONNECTED / TRACKED</Text>
            {devices.map((d) => (
              <View key={d.id} style={[styles.row, { borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: theme.label }]}>{d.name}</Text>
                  <Text style={[styles.meta, { color: theme.dim }]}>
                    {d.state}
                    {d.detail ? ` · ${d.detail}` : ''}
                    {d.lastError ? ` · ${d.lastError}` : ''}
                  </Text>
                </View>
                {d.state === 'connected' ? (
                  <Pressable
                    style={[styles.smallBtn, { borderColor: theme.border }]}
                    onPress={() => void disconnect(d.id)}
                    accessibilityLabel={`Disconnect ${d.name}`}
                  >
                    <Text style={{ color: theme.label, fontFamily: FONT, fontSize: 11 }}>DISC</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}

        <Text style={[styles.section, { color: theme.dim }]}>SCAN RESULTS</Text>
        <ScrollView style={{ maxHeight: 280 }}>
          {scanned.length === 0 ? (
            <Text style={[styles.meta, { color: theme.dim }]}>
              {scanning ? 'Looking for Xero / Kestrel / rangefinders…' : 'Tap SCAN to search.'}
            </Text>
          ) : (
            scanned.map((p) => (
              <View key={p.id} style={[styles.row, { borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: theme.label }]}>
                    {p.name ?? p.shortLabel}
                  </Text>
                  <Text style={[styles.meta, { color: theme.dim }]}>
                    {p.shortLabel} · {p.role}
                    {p.rssi != null ? ` · ${p.rssi} dBm` : ''}
                  </Text>
                </View>
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: theme.primary, minHeight: 56, minWidth: 56 }]}
                  onPress={() => void connect(p.id)}
                  accessibilityLabel={`Connect to ${p.name ?? p.shortLabel}`}
                >
                  <Text style={{ color: theme.bg, fontFamily: FONT, fontSize: 11, fontWeight: '700' }}>
                    LINK
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
    maxHeight: '85%',
  },
  title: {
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: 1.5,
  },
  hint: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '700',
  },
  section: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontFamily: FONT,
    fontSize: 13,
  },
  meta: {
    fontFamily: FONT,
    fontSize: 11,
    marginTop: 4,
  },
  smallBtn: {
    minHeight: 56,
    minWidth: 56,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
