/**
 * Wind-risk envelope hook.
 *
 * Fetches winds-aloft from Open-Meteo at the specified location and altitude,
 * computes a standard deviation of wind speed across the next N hours, and
 * returns a risk band (low / moderate / high) with numerical σ_wind.
 *
 * The band is used by WindRiskBand.tsx to visually widen the WIND HOLD value
 * shown in the Field HUD.
 *
 * Wind-aloft data: Open-Meteo pressure-level endpoint, 850 hPa (~5000 ft MSL)
 * or 700 hPa (~10000 ft MSL) depending on elevation (from fieldStore).
 *
 * Cache: results are cached in-memory for 30 minutes to avoid hammering the API.
 */
import { useEffect, useState, useRef } from 'react';
import { useFieldStore } from '../store/fieldStore';

export type WindRiskLevel = 'low' | 'moderate' | 'high';

export type WindRiskResult = {
  level: WindRiskLevel;
  /** Standard deviation of wind speed (mph) over next 6 hours */
  sigmaWindMph: number;
  /** Raw forecast wind speeds at the requested pressure level */
  hourlyWindMph: number[];
  /** Whether the data is from cache (>0 min old) */
  fromCache: boolean;
  /** ISO timestamp of when data was fetched */
  fetchedAt: string | null;
  error: string | null;
};

// ─── Cache ────────────────────────────────────────────────────────────────────

type CacheEntry = {
  result: WindRiskResult;
  fetchedAt: number; // Date.now()
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

// ─── Open-Meteo fetch ─────────────────────────────────────────────────────────

type OpenMeteoWindsAloftResponse = {
  hourly?: {
    time: string[];
    windspeed_850hPa?: number[];
    windspeed_700hPa?: number[];
  };
};

async function fetchWindsAloft(lat: number, lon: number, elevationFt: number): Promise<number[]> {
  const pressureLevel = elevationFt > 7000 ? '700hPa' : '850hPa';
  const variable = `windspeed_${pressureLevel}`;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=${variable}&forecast_days=1&wind_speed_unit=mph&timezone=auto`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);

  const data = (await res.json()) as OpenMeteoWindsAloftResponse;

  const speeds = pressureLevel === '700hPa'
    ? data.hourly?.windspeed_700hPa
    : data.hourly?.windspeed_850hPa;

  if (!speeds || speeds.length === 0) throw new Error('No wind data returned');

  // Return next 6 hours from current hour
  const now = new Date();
  const currentHour = now.getHours();
  return speeds.slice(currentHour, currentHour + 6).filter((v): v is number => v != null);
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function riskLevel(sigma: number): WindRiskLevel {
  if (sigma < 4) return 'low';
  if (sigma < 9) return 'moderate';
  return 'high';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches winds-aloft for the given lat/lon and returns a WindRiskResult.
 * Pass null lat/lon to disable (returns null).
 */
export function useWindRisk(
  lat: number | null,
  lon: number | null,
  elevationFt = 5000,
): WindRiskResult | null {
  const [result, setResult] = useState<WindRiskResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (lat === null || lon === null) {
      setResult(null);
      return;
    }

    const key = cacheKey(lat, lon);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setResult({ ...cached.result, fromCache: true });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchWindsAloft(lat, lon, elevationFt)
      .then((hourlyMph) => {
        if (controller.signal.aborted) return;
        const sigma = std(hourlyMph);
        const level = riskLevel(sigma);
        const res: WindRiskResult = {
          level,
          sigmaWindMph: sigma,
          hourlyWindMph: hourlyMph,
          fromCache: false,
          fetchedAt: new Date().toISOString(),
          error: null,
        };
        cache.set(key, { result: res, fetchedAt: Date.now() });
        setResult(res);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          level: 'low',
          sigmaWindMph: 0,
          hourlyWindMph: [],
          fromCache: false,
          fetchedAt: null,
          error: String(err),
        });
      });

    return () => controller.abort();
  }, [lat, lon, elevationFt]);

  return result;
}
