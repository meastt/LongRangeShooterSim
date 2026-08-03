import { describe, expect, it } from 'vitest';
import {
  buildMultilinkRegister,
  parseMultilinkRegisterReply,
  parseProvisionalVelocityFrame,
  stripHandlePrefix,
} from '../parsers/garmin';
import {
  celsiusToFahrenheit,
  combineEssAtmosphere,
  paToInHg,
  parseEssHumidityPct,
  parseEssPressurePa,
  parseEssTemperatureCelsius,
} from '../parsers/kestrel';
import { parseProvisionalRangeFrame } from '../parsers/rangefinder';
import { matchAdapter } from '../adapters/registry';

describe('Garmin MultiLink helpers', () => {
  it('builds a 13-byte REGISTER command', () => {
    const uuid = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const cmd = buildMultilinkRegister(uuid, 0x0001);
    expect(cmd).toHaveLength(13);
    expect(cmd[0]).toBe(0x00);
    expect(cmd[1]).toBe(0x01);
    expect(cmd[10]).toBe(0x01);
    expect(cmd[11]).toBe(0x00);
  });

  it('parses REGISTER success handle', () => {
    expect(parseMultilinkRegisterReply(new Uint8Array([0x00, 0x07]))).toBe(7);
    expect(parseMultilinkRegisterReply(new Uint8Array([0x01, 0x07]))).toBeNull();
  });

  it('strips handle prefix', () => {
    // 2910 fps = 0x0B5E LE
    const r = stripHandlePrefix(new Uint8Array([0x07, 0x56, 0x45, 0x5e, 0x0b]));
    expect(r?.handle).toBe(7);
    expect(parseProvisionalVelocityFrame(r!.payload)).toBe(2910);
  });

  it('parses provisional velocity frame', () => {
    // 2910 = 0x0B5E LE
    expect(parseProvisionalVelocityFrame(new Uint8Array([0x56, 0x45, 0x5e, 0x0b]))).toBe(2910);
    expect(parseProvisionalVelocityFrame(new Uint8Array([0x00, 0x00, 0x5e, 0x0b]))).toBeNull();
  });
});

describe('Kestrel ESS parsers', () => {
  it('parses temperature humidity pressure into solver units', () => {
    // 20.00 °C → sint16 2000 = 0x07D0 LE
    const tempC = parseEssTemperatureCelsius(new Uint8Array([0xd0, 0x07]));
    expect(tempC).toBeCloseTo(20, 2);
    expect(celsiusToFahrenheit(tempC!)).toBeCloseTo(68, 1);

    // 45.00 % → 4500
    const rh = parseEssHumidityPct(new Uint8Array([0x94, 0x11]));
    expect(rh).toBeCloseTo(45, 1);

    // 101325 Pa → 1_013_250 × 0.1 Pa units = 0x000F7602 LE
    const pa = parseEssPressurePa(new Uint8Array([0x02, 0x76, 0x0f, 0x00]));
    expect(pa).toBeCloseTo(101325, 0);
    expect(paToInHg(pa!)).toBeCloseTo(29.92, 1);

    const atmo = combineEssAtmosphere({
      tempC: tempC!,
      humidityPct: rh!,
      pressurePa: pa!,
    });
    expect(atmo?.relativeHumidityPct).toBeCloseTo(45, 0);
    expect(atmo?.temperatureFahrenheit).toBeCloseTo(68, 0);
  });

  it('refuses incomplete ESS', () => {
    expect(combineEssAtmosphere({ tempC: 20, humidityPct: null, pressurePa: 101325 })).toBeNull();
  });
});

describe('Rangefinder provisional frame', () => {
  it('parses yards', () => {
    // 547 yd = 0x0223 LE
    expect(parseProvisionalRangeFrame(new Uint8Array([0x52, 0x47, 0x23, 0x02]))).toBe(547);
  });
});

describe('adapter matching', () => {
  it('matches Xero / Kestrel / rangefinder names', () => {
    expect(matchAdapter({ id: '1', name: 'Xero C1 Pro', rssi: -50 })?.adapterId).toBe(
      'garmin-xero-c1',
    );
    expect(matchAdapter({ id: '2', name: 'Kestrel 5700', rssi: -60 })?.adapterId).toBe(
      'kestrel-link',
    );
    expect(matchAdapter({ id: '3', name: 'SIG BDX', rssi: -70 })?.role).toBe('rangefinder');
    expect(matchAdapter({ id: '4', name: 'AirPods', rssi: -40 })).toBeNull();
  });
});
