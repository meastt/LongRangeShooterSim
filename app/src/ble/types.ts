/**
 * Shared BLE types for the supervisor + adapters.
 * Spec: docs/specs/ble-supervisor.md
 */

export type BleDeviceRole = 'chrono' | 'meter' | 'rangefinder';

export type BleConnectionState =
  | 'off'
  | 'unauthorized'
  | 'powered_off'
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export type BleDeviceStatus = {
  id: string;
  name: string;
  role: BleDeviceRole;
  adapterId: string;
  state: BleConnectionState;
  lastSeenAt: number | null;
  lastError: string | null;
  /** Short hunter-facing detail, e.g. "2910 fps". */
  detail: string | null;
};

export type ChronoReading = {
  kind: 'chrono';
  mvFps: number;
  capturedAt: number;
  deviceId: string;
};

export type MeterReading = {
  kind: 'meter';
  temperatureFahrenheit: number;
  pressureInHg: number;
  relativeHumidityPct: number;
  windSpeedMph?: number;
  capturedAt: number;
  deviceId: string;
};

export type RangefinderReading = {
  kind: 'rangefinder';
  rangeYards: number;
  capturedAt: number;
  deviceId: string;
};

export type BleReading = ChronoReading | MeterReading | RangefinderReading;

export type ScannedPeripheral = {
  id: string;
  name: string | null;
  rssi: number | null;
};

export type BleAdapterMatch = {
  adapterId: string;
  role: BleDeviceRole;
  /** Human label for status strip. */
  shortLabel: string;
};
