/**
 * Pure Kestrel / ESS atmosphere parsers.
 * Protocol: docs/protocols/kestrel-link.md
 */

export const ESS_SERVICE = '0000181a-0000-1000-8000-00805f9b34fb';
export const ESS_TEMPERATURE = '00002a6e-0000-1000-8000-00805f9b34fb';
export const ESS_HUMIDITY = '00002a6f-0000-1000-8000-00805f9b34fb';
export const ESS_PRESSURE = '00002a6d-0000-1000-8000-00805f9b34fb';

export type EssAtmosphere = {
  temperatureFahrenheit: number;
  pressureInHg: number;
  relativeHumidityPct: number;
};

/** ESS Temperature: sint16, 0.01 °C. */
export function parseEssTemperatureCelsius(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  const raw = bytes[0]! | (bytes[1]! << 8);
  const signed = raw > 0x7fff ? raw - 0x10000 : raw;
  return signed / 100;
}

/** ESS Humidity: uint16, 0.01 %RH. */
export function parseEssHumidityPct(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  const raw = bytes[0]! | (bytes[1]! << 8);
  return raw / 100;
}

/** ESS Pressure: uint32 LE, unit 0.1 Pa. */
export function parseEssPressurePa(bytes: Uint8Array): number | null {
  if (bytes.length < 4) return null;
  // Avoid JS << 24 sign-extension on the high byte.
  const raw =
    bytes[0]! +
    bytes[1]! * 256 +
    bytes[2]! * 65_536 +
    bytes[3]! * 16_777_216;
  return raw / 10;
}

const PA_PER_INHG = 3386.389;

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function paToInHg(pa: number): number {
  return pa / PA_PER_INHG;
}

/**
 * Combine ESS characteristic values into solver atmosphere units.
 * Missing any field → null (do not invent ICAO defaults from BLE).
 */
export function combineEssAtmosphere(parts: {
  tempC: number | null;
  humidityPct: number | null;
  pressurePa: number | null;
}): EssAtmosphere | null {
  if (parts.tempC == null || parts.humidityPct == null || parts.pressurePa == null) {
    return null;
  }
  return {
    temperatureFahrenheit: celsiusToFahrenheit(parts.tempC),
    pressureInHg: paToInHg(parts.pressurePa),
    relativeHumidityPct: Math.max(0, Math.min(100, parts.humidityPct)),
  };
}
