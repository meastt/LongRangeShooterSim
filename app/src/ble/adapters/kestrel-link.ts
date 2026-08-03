/**
 * Kestrel LiNK / ESS atmosphere adapter.
 * Protocol: docs/protocols/kestrel-link.md
 */
import type { BleAdapter } from './types';
import { base64ToBytes } from '../parsers/garmin';
import {
  ESS_HUMIDITY,
  ESS_PRESSURE,
  ESS_SERVICE,
  ESS_TEMPERATURE,
  combineEssAtmosphere,
  parseEssHumidityPct,
  parseEssPressurePa,
  parseEssTemperatureCelsius,
} from '../parsers/kestrel';

function nameLooksLikeKestrel(name: string | null): boolean {
  if (!name) return false;
  return name.toLowerCase().includes('kestrel');
}

export const kestrelLinkAdapter: BleAdapter = {
  id: 'kestrel-link',
  shortLabel: 'KESTREL',

  match(peripheral) {
    if (!nameLooksLikeKestrel(peripheral.name)) return null;
    return {
      adapterId: this.id,
      role: 'meter',
      shortLabel: this.shortLabel,
    };
  },

  async onConnected(transport, deviceId, onReading, onDetail) {
    const services = await transport.discoverServices(deviceId);
    const hasEss = services.some((u) => u.includes('181a'));

    if (!hasEss) {
      onDetail('connected · LiNK parse pending');
      return () => undefined;
    }

    onDetail('reading ESS…');

    let tempC: number | null = null;
    let humidityPct: number | null = null;
    let pressurePa: number | null = null;

    const publish = () => {
      const atmo = combineEssAtmosphere({ tempC, humidityPct, pressurePa });
      if (!atmo) return;
      onDetail(
        `${Math.round(atmo.temperatureFahrenheit)}°F · ${atmo.pressureInHg.toFixed(2)}"`,
      );
      onReading({
        kind: 'meter',
        temperatureFahrenheit: atmo.temperatureFahrenheit,
        pressureInHg: atmo.pressureInHg,
        relativeHumidityPct: atmo.relativeHumidityPct,
        capturedAt: Date.now(),
        deviceId,
      });
    };

    const readEss = async () => {
      const tB64 = await transport.read(deviceId, ESS_SERVICE, ESS_TEMPERATURE);
      const hB64 = await transport.read(deviceId, ESS_SERVICE, ESS_HUMIDITY);
      const pB64 = await transport.read(deviceId, ESS_SERVICE, ESS_PRESSURE);
      if (tB64) tempC = parseEssTemperatureCelsius(base64ToBytes(tB64));
      if (hB64) humidityPct = parseEssHumidityPct(base64ToBytes(hB64));
      if (pB64) pressurePa = parseEssPressurePa(base64ToBytes(pB64));
      publish();
    };

    try {
      await readEss();
      if (!combineEssAtmosphere({ tempC, humidityPct, pressurePa })) {
        onDetail('ESS incomplete');
      }
    } catch (err) {
      onDetail(`ESS read failed: ${err instanceof Error ? err.message : 'error'}`);
    }

    const timer = setInterval(() => {
      void readEss().catch(() => undefined);
    }, 15_000);

    return () => clearInterval(timer);
  },
};
