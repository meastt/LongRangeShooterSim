/**
 * Bridges BLE supervisor readings into Field Mode stores.
 * Chrono MV requires explicit APPLY (never silent overwrite).
 * Meter / rangefinder update field inputs with strip feedback.
 */
import { useEffect } from 'react';
import type { AtmosphericConditions } from '@aim/solver';
import { useBleSupervisor } from '../ble/supervisor';
import { useFieldStore } from '../store/fieldStore';

export function useBleBridge(): void {
  const lastMeter = useBleSupervisor((s) => s.lastMeter);
  const lastRange = useBleSupervisor((s) => s.lastRange);
  const setAtmosphericOverride = useFieldStore((s) => s.setAtmosphericOverride);
  const setRange = useFieldStore((s) => s.setRange);

  useEffect(() => {
    if (!lastMeter) return;
    const atmo: AtmosphericConditions = {
      temperatureFahrenheit: lastMeter.temperatureFahrenheit as AtmosphericConditions['temperatureFahrenheit'],
      pressureInHg: lastMeter.pressureInHg as AtmosphericConditions['pressureInHg'],
      relativeHumidityPct: lastMeter.relativeHumidityPct,
    };
    setAtmosphericOverride(atmo);
  }, [lastMeter, setAtmosphericOverride]);

  useEffect(() => {
    if (!lastRange) return;
    setRange(lastRange.rangeYards);
  }, [lastRange, setRange]);
}
