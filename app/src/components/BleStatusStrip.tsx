/**
 * Field Mode BLE health strip — top of every field screen (Claude.md rule 7).
 * Tap opens the devices panel. Manual entry remains available regardless of BLE.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useBleSupervisor } from '../ble/supervisor';
import type { BleConnectionState, BleDeviceStatus } from '../ble/types';
import type { Theme } from '../theme';
import { BleDevicesPanel } from './BleDevicesPanel';

interface Props {
  theme: Theme;
}

function stateColor(state: BleConnectionState, theme: Theme): string {
  switch (state) {
    case 'connected':
      return '#22C55E';
    case 'scanning':
    case 'connecting':
      return '#F59E0B';
    case 'error':
    case 'unauthorized':
    case 'powered_off':
      return '#EF4444';
    default:
      return theme.dim;
  }
}

function DeviceChip({ device, theme }: { device: BleDeviceStatus; theme: Theme }) {
  const label = device.adapterId === 'garmin-xero-c1'
    ? 'XERO'
    : device.adapterId === 'kestrel-link'
      ? 'KESTREL'
      : device.role === 'rangefinder'
        ? 'RF'
        : 'BLE';
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: stateColor(device.state, theme) }]} />
      <Text style={[styles.chipText, { color: theme.label }]} numberOfLines={1}>
        {label}
        {device.detail ? ` · ${device.detail}` : ` · ${device.state.toUpperCase()}`}
      </Text>
    </View>
  );
}

export function BleStatusStrip({ theme }: Props) {
  const init = useBleSupervisor((s) => s.init);
  const devices = useBleSupervisor((s) => s.devices);
  const scanning = useBleSupervisor((s) => s.scanning);
  const radioState = useBleSupervisor((s) => s.radioState);
  const nativeAvailable = useBleSupervisor((s) => s.nativeAvailable);
  const pendingChrono = useBleSupervisor((s) => s.pendingChrono);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  const connected = devices.filter((d) => d.state === 'connected');
  const summary =
    connected.length > 0
      ? null
      : scanning
        ? 'SCANNING…'
        : !nativeAvailable
          ? 'BLE · DEV BUILD'
          : radioState === 'unauthorized'
            ? 'BLE · PERMISSION'
            : radioState === 'powered_off'
              ? 'BLE · OFF'
              : 'BLE · TAP TO PAIR';

  return (
    <>
      <Pressable
        style={[styles.strip, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
        onPress={() => setPanelOpen(true)}
        accessibilityLabel="Bluetooth devices status. Tap to manage connections."
      >
        {connected.length === 0 ? (
          <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: stateColor(radioState, theme) }]} />
            <Text style={[styles.chipText, { color: theme.dim }]}>{summary}</Text>
          </View>
        ) : (
          <View style={styles.row}>
            {connected.map((d) => (
              <DeviceChip key={d.id} device={d} theme={theme} />
            ))}
            {pendingChrono && (
              <Text style={[styles.pending, { color: theme.primary }]}>MV READY</Text>
            )}
          </View>
        )}
      </Pressable>
      <BleDevicesPanel visible={panelOpen} onClose={() => setPanelOpen(false)} theme={theme} />
    </>
  );
}

const FONT = 'SpaceMono-Regular';

const styles = StyleSheet.create({
  strip: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipText: {
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: 0.8,
    maxWidth: 280,
  },
  pending: {
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
});
