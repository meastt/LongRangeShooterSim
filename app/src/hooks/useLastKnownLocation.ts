/**
 * useLastKnownLocation — one-shot coarse position for weather/wind-risk fetches.
 *
 * Uses the same lazy expo-location import pattern as AtmoInput so the app
 * doesn't crash where the native module isn't linked (CI, web, Expo Go edge
 * cases). Last-known position is preferred over a fresh GPS fix: weather grids
 * are ~14 mi wide (see weather.ts CACHE_RADIUS_DEG), so a stale coarse fix is
 * fine and costs zero time-to-first-fix — Field Mode must not wait on GPS.
 *
 * Returns null until a position is available, or permanently null if the user
 * denied location permission (callers degrade gracefully — wind risk simply
 * stays hidden, matching the previous behavior).
 */
import { useEffect, useState } from 'react';

export type Coordinates = { lat: number; lon: number };

export function useLastKnownLocation(): Coordinates | null {
  const [coords, setCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function locate() {
      try {
        const Location = await import('expo-location');

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        const last = await Location.getLastKnownPositionAsync();
        const pos =
          last ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          }));

        if (!cancelled && pos) {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        }
      } catch {
        // No native module / permission dialog unavailable — degrade silently.
      }
    }

    locate();
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
