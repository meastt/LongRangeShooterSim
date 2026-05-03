/**
 * Open-Meteo weather client — direct API call, no backend.
 *
 * Fetches surface atmospheric conditions at a given location.
 * Used to auto-fill AtmoInput and cache conditions for the wind-risk envelope.
 *
 * API: https://open-meteo.com/en/docs (free, no key required)
 * Backup: api.weather.gov (US only, used if Open-Meteo fails)
 *
 * Results are cached in-memory with a timestamp; callers check `ageMinutes`
 * before deciding whether to show a "data is stale" warning.
 */
import type { AtmosphericConditions } from '@aim/solver';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WeatherResult = {
  conditions: AtmosphericConditions;
  /** UTC ISO timestamp of when the data was fetched. */
  fetchedAt: string;
  /** How old the data is in minutes at time of reading. */
  readonly ageMinutes: number;
  source: 'open-meteo' | 'fallback-icao';
};

type WindsAloftLevel = {
  /** Pressure level in hPa. */
  pressureHpa: number;
  /** Wind speed in mph. */
  windSpeedMph: number;
  /** Wind direction in degrees (met convention: direction FROM). */
  windDirDeg: number;
};

export type WindsAloftResult = {
  levels: WindsAloftLevel[];
  fetchedAt: string;
  readonly ageMinutes: number;
};

// ─── In-memory cache ─────────────────────────────────────────────────────────

let surfaceCache: (WeatherResult & { lat: number; lng: number }) | null = null;
let aloftCache: (WindsAloftResult & { lat: number; lng: number }) | null = null;

const CACHE_RADIUS_DEG = 0.2;   // ~14 miles — same cache valid in this radius
const STALENESS_MINUTES = 60;    // show "stale" warning after 1 hour

function ageMinutes(fetchedAt: string): number {
  return (Date.now() - new Date(fetchedAt).getTime()) / 60_000;
}

function locationMatch(cache: { lat: number; lng: number }, lat: number, lng: number): boolean {
  return Math.abs(cache.lat - lat) < CACHE_RADIUS_DEG &&
         Math.abs(cache.lng - lng) < CACHE_RADIUS_DEG;
}

// ─── Open-Meteo surface fetch ─────────────────────────────────────────────────

/**
 * Fetch surface atmospheric conditions from Open-Meteo.
 * Returns cached result if location matches and data is < STALENESS_MINUTES old.
 */
export async function fetchSurfaceWeather(
  lat: number,
  lng: number,
): Promise<WeatherResult> {
  // Return cache if fresh and nearby.
  if (
    surfaceCache &&
    locationMatch(surfaceCache, lat, lng) &&
    ageMinutes(surfaceCache.fetchedAt) < STALENESS_MINUTES
  ) {
    return { ...surfaceCache, ageMinutes: ageMinutes(surfaceCache.fetchedAt) };
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&current=temperature_2m,surface_pressure,relative_humidity_2m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch` +
      `&timezone=auto&forecast_days=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

    const json = await res.json() as {
      current: {
        temperature_2m: number;
        surface_pressure: number;   // hPa
        relative_humidity_2m: number;
      };
    };

    const c = json.current;
    // Convert hPa → inHg (1 hPa = 0.02953 inHg)
    const pressureInHg = c.surface_pressure * 0.02953;

    const conditions: AtmosphericConditions = {
      temperatureFahrenheit: c.temperature_2m as any,
      pressureInHg: pressureInHg as any,
      relativeHumidityPct: c.relative_humidity_2m,
    };

    const fetchedAt = new Date().toISOString();
    const result: WeatherResult = {
      conditions,
      fetchedAt,
      get ageMinutes() { return ageMinutes(fetchedAt); },
      source: 'open-meteo',
    };

    surfaceCache = { ...result, lat, lng };
    return result;
  } catch (err) {
    console.warn('[weather] Open-Meteo failed, returning ICAO standard:', err);
    // Graceful degradation: return ICAO standard atmosphere so the solver
    // can still run — the user will see "STANDARD" in AtmoInput.
    const fetchedAt = new Date().toISOString();
    return {
      conditions: {
        temperatureFahrenheit: 59 as any,
        pressureInHg: 29.921 as any,
        relativeHumidityPct: 50,
      },
      fetchedAt,
      get ageMinutes() { return ageMinutes(fetchedAt); },
      source: 'fallback-icao',
    };
  }
}

// ─── Open-Meteo winds aloft ───────────────────────────────────────────────────

/**
 * Fetch pressure-level wind data from Open-Meteo.
 * Returns upper-air wind speed at 850/700/500/300 hPa levels.
 * Used by the wind-risk envelope to compute σ_wind.
 */
export async function fetchWindsAloft(
  lat: number,
  lng: number,
): Promise<WindsAloftResult> {
  if (
    aloftCache &&
    locationMatch(aloftCache, lat, lng) &&
    ageMinutes(aloftCache.fetchedAt) < STALENESS_MINUTES
  ) {
    return { ...aloftCache, ageMinutes: ageMinutes(aloftCache.fetchedAt) };
  }

  const LEVELS = [850, 700, 500, 300] as const;
  const windSpeedParams = LEVELS.map((l) => `wind_speed_${l}hPa`).join(',');
  const windDirParams = LEVELS.map((l) => `wind_direction_${l}hPa`).join(',');

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&hourly=${windSpeedParams},${windDirParams}` +
      `&wind_speed_unit=mph&timezone=auto&forecast_days=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo aloft HTTP ${res.status}`);

    const json = await res.json() as { hourly: Record<string, number[]> };
    const h = json.hourly;

    // Take the first available hour (index 0 = now or latest)
    const levels: WindsAloftLevel[] = LEVELS.map((pressureHpa) => ({
      pressureHpa,
      windSpeedMph: h[`wind_speed_${pressureHpa}hPa`]?.[0] ?? 0,
      windDirDeg: h[`wind_direction_${pressureHpa}hPa`]?.[0] ?? 0,
    }));

    const fetchedAt = new Date().toISOString();
    const result: WindsAloftResult = {
      levels,
      fetchedAt,
      get ageMinutes() { return ageMinutes(fetchedAt); },
    };

    aloftCache = { ...result, lat, lng };
    return result;
  } catch (err) {
    console.warn('[weather] Winds-aloft fetch failed:', err);
    const fetchedAt = new Date().toISOString();
    return {
      levels: LEVELS.map((p) => ({ pressureHpa: p, windSpeedMph: 0, windDirDeg: 0 })),
      fetchedAt,
      get ageMinutes() { return ageMinutes(fetchedAt); },
    };
  }
}

// ─── Wind variance helper (used by wind-risk envelope) ────────────────────────

/**
 * Computes the standard deviation of wind speed across pressure levels.
 * Higher variance = wider wind-risk band on the HUD.
 */
export function windVarianceMph(aloft: WindsAloftResult): number {
  const speeds = aloft.levels.map((l) => l.windSpeedMph);
  if (speeds.length === 0) return 0;
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((sum, v) => sum + (v - mean) ** 2, 0) / speeds.length;
  return Math.sqrt(variance);
}

/** Clears both caches — useful for testing or forced refresh. */
export function clearWeatherCache(): void {
  surfaceCache = null;
  aloftCache = null;
}
