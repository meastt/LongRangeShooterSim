/**
 * Open-Meteo weather client — direct API call, no backend.
 *
 * Primary: Open-Meteo. Fallback: api.weather.gov (US). Last resort: ICAO standard.
 *
 * Results are cached in-memory with a timestamp; callers check `ageMinutes`
 * before deciding whether to show a "data is stale" warning.
 */
import type { AtmosphericConditions } from '@aim/solver';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WeatherSource = 'open-meteo' | 'weather-gov' | 'fallback-icao';

export type WeatherResult = {
  conditions: AtmosphericConditions;
  /** UTC ISO timestamp of when the data was fetched. */
  fetchedAt: string;
  /** How old the data is in minutes at time of reading. */
  readonly ageMinutes: number;
  source: WeatherSource;
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
export const WEATHER_STALE_MINUTES = 60;

function ageMinutes(fetchedAt: string): number {
  return (Date.now() - new Date(fetchedAt).getTime()) / 60_000;
}

function locationMatch(cache: { lat: number; lng: number }, lat: number, lng: number): boolean {
  return Math.abs(cache.lat - lat) < CACHE_RADIUS_DEG &&
         Math.abs(cache.lng - lng) < CACHE_RADIUS_DEG;
}

function icaoFallback(): WeatherResult {
  const fetchedAt = new Date().toISOString();
  return {
    conditions: {
      temperatureFahrenheit: 59 as AtmosphericConditions['temperatureFahrenheit'],
      pressureInHg: 29.921 as AtmosphericConditions['pressureInHg'],
      relativeHumidityPct: 50,
    },
    fetchedAt,
    get ageMinutes() { return ageMinutes(fetchedAt); },
    source: 'fallback-icao',
  };
}

// ─── NOAA api.weather.gov surface fallback ───────────────────────────────────

/**
 * US-only observation from the nearest NWS station.
 * Requires a descriptive User-Agent per weather.gov API policy.
 */
async function fetchWeatherGovSurface(
  lat: number,
  lng: number,
): Promise<WeatherResult> {
  const headers = {
    Accept: 'application/geo+json',
    'User-Agent': 'RangeDOPE/1.0 (https://getrangedope.com; ballistics@getrangedope.com)',
  };

  const pointsRes = await fetch(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
    { headers },
  );
  if (!pointsRes.ok) throw new Error(`weather.gov points HTTP ${pointsRes.status}`);

  const pointsJson = await pointsRes.json() as {
    properties?: { observationStations?: string };
  };
  const stationsUrl = pointsJson.properties?.observationStations;
  if (!stationsUrl) throw new Error('weather.gov: no observationStations');

  const stationsRes = await fetch(stationsUrl, { headers });
  if (!stationsRes.ok) throw new Error(`weather.gov stations HTTP ${stationsRes.status}`);

  const stationsJson = await stationsRes.json() as {
    features?: Array<{ id?: string; properties?: { stationIdentifier?: string } }>;
  };
  const stationId =
    stationsJson.features?.[0]?.properties?.stationIdentifier ??
    stationsJson.features?.[0]?.id?.split('/').pop();
  if (!stationId) throw new Error('weather.gov: empty station list');

  const obsRes = await fetch(
    `https://api.weather.gov/stations/${stationId}/observations/latest`,
    { headers },
  );
  if (!obsRes.ok) throw new Error(`weather.gov obs HTTP ${obsRes.status}`);

  const obs = await obsRes.json() as {
    properties?: {
      temperature?: { value: number | null; unitCode?: string };
      barometricPressure?: { value: number | null };
      seaLevelPressure?: { value: number | null };
      relativeHumidity?: { value: number | null };
      timestamp?: string;
    };
  };
  const p = obs.properties;
  if (!p) throw new Error('weather.gov: empty observation');

  // temperature.value is °C when unitCode is wmoUnit:degC
  const tempC = p.temperature?.value;
  if (tempC == null) throw new Error('weather.gov: missing temperature');
  const temperatureFahrenheit = (tempC * 9) / 5 + 32;

  // Pressure in Pa → inHg
  const pressurePa = p.barometricPressure?.value ?? p.seaLevelPressure?.value;
  if (pressurePa == null) throw new Error('weather.gov: missing pressure');
  const pressureInHg = pressurePa / 3386.39;

  const relativeHumidityPct = Math.round(p.relativeHumidity?.value ?? 50);

  const fetchedAt = p.timestamp ?? new Date().toISOString();
  return {
    conditions: {
      temperatureFahrenheit: temperatureFahrenheit as AtmosphericConditions['temperatureFahrenheit'],
      pressureInHg: pressureInHg as AtmosphericConditions['pressureInHg'],
      relativeHumidityPct,
    },
    fetchedAt,
    get ageMinutes() { return ageMinutes(fetchedAt); },
    source: 'weather-gov',
  };
}

// ─── Open-Meteo surface fetch ─────────────────────────────────────────────────

/**
 * Fetch surface atmospheric conditions.
 * Order: cache → Open-Meteo → weather.gov → ICAO standard.
 */
export async function fetchSurfaceWeather(
  lat: number,
  lng: number,
): Promise<WeatherResult> {
  if (
    surfaceCache &&
    locationMatch(surfaceCache, lat, lng) &&
    ageMinutes(surfaceCache.fetchedAt) < WEATHER_STALE_MINUTES
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
        surface_pressure: number;
        relative_humidity_2m: number;
      };
    };

    const c = json.current;
    const pressureInHg = c.surface_pressure * 0.02953;

    const conditions: AtmosphericConditions = {
      temperatureFahrenheit: c.temperature_2m as AtmosphericConditions['temperatureFahrenheit'],
      pressureInHg: pressureInHg as AtmosphericConditions['pressureInHg'],
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
  } catch (primaryErr) {
    console.warn('[weather] Open-Meteo failed, trying weather.gov:', primaryErr);
    try {
      const gov = await fetchWeatherGovSurface(lat, lng);
      surfaceCache = { ...gov, lat, lng };
      return gov;
    } catch (govErr) {
      console.warn('[weather] weather.gov failed, ICAO standard:', govErr);
      return icaoFallback();
    }
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
    ageMinutes(aloftCache.fetchedAt) < WEATHER_STALE_MINUTES
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
