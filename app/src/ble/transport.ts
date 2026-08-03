/**
 * BLE transport abstraction — keeps supervisor testable without native modules.
 * Spec: docs/specs/ble-supervisor.md
 */
import type { ScannedPeripheral } from './types';

export type NotifyHandler = (deviceId: string, characteristicUuid: string, base64Value: string) => void;

export type BleTransport = {
  /** true when native BLE stack is available (dev client / EAS build). */
  readonly isNative: boolean;
  startScan: (onDevice: (p: ScannedPeripheral) => void) => Promise<void>;
  stopScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  discoverServices: (deviceId: string) => Promise<string[]>;
  write: (
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    base64Value: string,
  ) => Promise<void>;
  monitor: (
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    onNotify: NotifyHandler,
  ) => () => void;
  read: (
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
  ) => Promise<string | null>;
  destroy: () => void;
};

/** Used on web, Expo Go, and unit tests — never throws into Field Mode. */
export function createNullTransport(reason = 'BLE unavailable'): BleTransport {
  return {
    isNative: false,
    async startScan() {
      /* no-op */
    },
    async stopScan() {
      /* no-op */
    },
    async connect() {
      throw new Error(reason);
    },
    async disconnect() {
      /* no-op */
    },
    async discoverServices() {
      return [];
    },
    async write() {
      throw new Error(reason);
    },
    monitor() {
      return () => undefined;
    },
    async read() {
      return null;
    },
    destroy() {
      /* no-op */
    },
  };
}

/**
 * Lazy-load react-native-ble-plx so Metro/web/CI can import the supervisor
 * without resolving native bindings at module eval time.
 */
export async function createBlePlxTransport(): Promise<BleTransport> {
  try {
    // Dynamic require keeps web/Expo Go from hard-crashing at import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager, State } = require('react-native-ble-plx') as {
      BleManager: new () => {
        state: () => Promise<string>;
        startDeviceScan: (
          uuids: string[] | null,
          options: object | null,
          listener: (error: Error | null, device: {
            id: string;
            name: string | null;
            localName: string | null;
            rssi: number | null;
          } | null) => void,
        ) => void;
        stopDeviceScan: () => void;
        connectToDevice: (id: string) => Promise<{ id: string; discoverAllServicesAndCharacteristics: () => Promise<unknown> }>;
        cancelDeviceConnection: (id: string) => Promise<unknown>;
        servicesForDevice: (id: string) => Promise<Array<{ uuid: string }>>;
        writeCharacteristicWithResponseForDevice: (
          id: string,
          service: string,
          char: string,
          value: string,
        ) => Promise<unknown>;
        monitorCharacteristicForDevice: (
          id: string,
          service: string,
          char: string,
          listener: (error: Error | null, characteristic: { value: string | null } | null) => void,
        ) => { remove: () => void };
        readCharacteristicForDevice: (
          id: string,
          service: string,
          char: string,
        ) => Promise<{ value: string | null }>;
        destroy: () => void;
      };
      State: { PoweredOn: string; Unauthorized: string; PoweredOff: string };
    };

    const manager = new BleManager();
    const unsubs: Array<() => void> = [];

    return {
      isNative: true,
      async startScan(onDevice) {
        const state = await manager.state();
        if (state === State.Unauthorized) {
          throw new Error('Bluetooth permission denied');
        }
        if (state === State.PoweredOff) {
          throw new Error('Bluetooth is off');
        }
        manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
          if (error || !device) return;
          onDevice({
            id: device.id,
            name: device.name ?? device.localName,
            rssi: device.rssi,
          });
        });
      },
      async stopScan() {
        manager.stopDeviceScan();
      },
      async connect(deviceId) {
        const device = await manager.connectToDevice(deviceId);
        await device.discoverAllServicesAndCharacteristics();
      },
      async disconnect(deviceId) {
        await manager.cancelDeviceConnection(deviceId);
      },
      async discoverServices(deviceId) {
        const services = await manager.servicesForDevice(deviceId);
        return services.map((s) => s.uuid.toLowerCase());
      },
      async write(deviceId, serviceUuid, characteristicUuid, base64Value) {
        await manager.writeCharacteristicWithResponseForDevice(
          deviceId,
          serviceUuid,
          characteristicUuid,
          base64Value,
        );
      },
      monitor(deviceId, serviceUuid, characteristicUuid, onNotify) {
        const sub = manager.monitorCharacteristicForDevice(
          deviceId,
          serviceUuid,
          characteristicUuid,
          (error, characteristic) => {
            if (error || !characteristic?.value) return;
            onNotify(deviceId, characteristicUuid, characteristic.value);
          },
        );
        const stop = () => sub.remove();
        unsubs.push(stop);
        return stop;
      },
      async read(deviceId, serviceUuid, characteristicUuid) {
        const c = await manager.readCharacteristicForDevice(
          deviceId,
          serviceUuid,
          characteristicUuid,
        );
        return c.value;
      },
      destroy() {
        for (const u of unsubs) u();
        manager.destroy();
      },
    };
  } catch {
    return createNullTransport('react-native-ble-plx not linked (needs EAS / expo run)');
  }
}
