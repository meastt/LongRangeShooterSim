/**
 * Single BLE supervisor — all device state lives here.
 * Spec: docs/specs/ble-supervisor.md
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import type {
  BleConnectionState,
  BleDeviceStatus,
  BleReading,
  ChronoReading,
  MeterReading,
  RangefinderReading,
  ScannedPeripheral,
} from './types';
import type { BleTransport } from './transport';
import { createBlePlxTransport, createNullTransport } from './transport';
import { getAdapter, matchAdapter } from './adapters/registry';

type ScannedRow = ScannedPeripheral & {
  adapterId: string;
  role: BleDeviceStatus['role'];
  shortLabel: string;
};

type BleSupervisorState = {
  radioState: BleConnectionState;
  scanning: boolean;
  nativeAvailable: boolean;
  scanned: ScannedRow[];
  devices: BleDeviceStatus[];
  pendingChrono: ChronoReading | null;
  lastMeter: MeterReading | null;
  lastRange: RangefinderReading | null;
  init: () => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  clearPendingChrono: () => void;
  /** Inject a reading (tests / mock). */
  ingestReading: (reading: BleReading) => void;
};

let transport: BleTransport = createNullTransport();
const cleanups = new Map<string, () => void>();

function upsertDevice(
  devices: BleDeviceStatus[],
  patch: Partial<BleDeviceStatus> & Pick<BleDeviceStatus, 'id'>,
): BleDeviceStatus[] {
  const idx = devices.findIndex((d) => d.id === patch.id);
  if (idx < 0) {
    const created: BleDeviceStatus = {
      id: patch.id,
      name: patch.name ?? 'Device',
      role: patch.role ?? 'chrono',
      adapterId: patch.adapterId ?? 'unknown',
      state: patch.state ?? 'idle',
      lastSeenAt: patch.lastSeenAt ?? null,
      lastError: patch.lastError ?? null,
      detail: patch.detail ?? null,
    };
    return [...devices, created];
  }
  const next = [...devices];
  next[idx] = { ...next[idx]!, ...patch };
  return next;
}

export const useBleSupervisor = create<BleSupervisorState>((set, get) => ({
  radioState: 'off',
  scanning: false,
  nativeAvailable: false,
  scanned: [],
  devices: [],
  pendingChrono: null,
  lastMeter: null,
  lastRange: null,

  async init() {
    if (Platform.OS === 'web') {
      transport = createNullTransport('BLE not available on web');
      set({ radioState: 'off', nativeAvailable: false });
      return;
    }
    transport = await createBlePlxTransport();
    set({
      nativeAvailable: transport.isNative,
      radioState: transport.isNative ? 'idle' : 'off',
    });
  },

  async startScan() {
    const { init } = get();
    if (!transport.isNative) await init();
    set({ scanning: true, scanned: [], radioState: 'scanning' });
    try {
      await transport.startScan((p) => {
        const match = matchAdapter(p);
        if (!match) return;
        set((s) => {
          if (s.scanned.some((r) => r.id === p.id)) return s;
          return {
            scanned: [
              ...s.scanned,
              {
                ...p,
                adapterId: match.adapterId,
                role: match.role,
                shortLabel: match.shortLabel,
              },
            ],
          };
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      const unauthorized = /permission|unauthorized/i.test(msg);
      const poweredOff = /off/i.test(msg);
      set({
        scanning: false,
        radioState: unauthorized ? 'unauthorized' : poweredOff ? 'powered_off' : 'error',
      });
    }
  },

  async stopScan() {
    await transport.stopScan();
    set({ scanning: false, radioState: transport.isNative ? 'idle' : 'off' });
  },

  async connect(deviceId) {
    const row = get().scanned.find((r) => r.id === deviceId);
    const adapter = getAdapter(row?.adapterId ?? '');
    if (!row || !adapter) {
      set((s) => ({
        devices: upsertDevice(s.devices, {
          id: deviceId,
          state: 'error',
          lastError: 'Unknown device — scan again',
        }),
      }));
      return;
    }

    await get().stopScan();

    set((s) => ({
      devices: upsertDevice(s.devices, {
        id: deviceId,
        name: row.name ?? row.shortLabel,
        role: row.role,
        adapterId: row.adapterId,
        state: 'connecting',
        lastError: null,
        detail: null,
      }),
    }));

    try {
      await transport.connect(deviceId);
      const cleanup = await adapter.onConnected(
        transport,
        deviceId,
        (reading) => get().ingestReading(reading),
        (detail) =>
          set((s) => ({
            devices: upsertDevice(s.devices, {
              id: deviceId,
              detail,
              lastSeenAt: Date.now(),
            }),
          })),
      );
      cleanups.get(deviceId)?.();
      cleanups.set(deviceId, cleanup);
      set((s) => ({
        devices: upsertDevice(s.devices, {
          id: deviceId,
          state: 'connected',
          lastSeenAt: Date.now(),
          lastError: null,
        }),
      }));
    } catch (err) {
      set((s) => ({
        devices: upsertDevice(s.devices, {
          id: deviceId,
          state: 'error',
          lastError: err instanceof Error ? err.message : 'Connect failed',
        }),
      }));
    }
  },

  async disconnect(deviceId) {
    cleanups.get(deviceId)?.();
    cleanups.delete(deviceId);
    try {
      await transport.disconnect(deviceId);
    } catch {
      /* ignore */
    }
    set((s) => ({
      devices: upsertDevice(s.devices, {
        id: deviceId,
        state: 'idle',
        detail: null,
      }),
    }));
  },

  clearPendingChrono() {
    set({ pendingChrono: null });
  },

  ingestReading(reading) {
    const now = Date.now();
    if (reading.kind === 'chrono') {
      set((s) => ({
        pendingChrono: reading,
        devices: upsertDevice(s.devices, {
          id: reading.deviceId,
          detail: `${Math.round(reading.mvFps)} fps`,
          lastSeenAt: now,
          state: 'connected',
        }),
      }));
      return;
    }
    if (reading.kind === 'meter') {
      set((s) => ({
        lastMeter: reading,
        devices: upsertDevice(s.devices, {
          id: reading.deviceId,
          detail: `${Math.round(reading.temperatureFahrenheit)}°F`,
          lastSeenAt: now,
          state: 'connected',
        }),
      }));
      return;
    }
    set((s) => ({
      lastRange: reading,
      devices: upsertDevice(s.devices, {
        id: reading.deviceId,
        detail: `${Math.round(reading.rangeYards)} yd`,
        lastSeenAt: now,
        state: 'connected',
      }),
    }));
  },
}));
