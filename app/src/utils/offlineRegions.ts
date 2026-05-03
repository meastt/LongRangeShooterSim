/**
 * offlineRegions.ts — Offline map tile manager for Aim.
 *
 * Strategy: Download and cache XYZ raster tiles for a user-defined
 * bounding box at zoom levels 10–14 to expo-file-system's document
 * directory. Tile metadata (region name, bounds, downloaded count,
 * byte size) is tracked in SQLite via a simple JSON-in-column approach
 * so we don't need a new migration.
 *
 * Tile sources:
 *   USGS National Map topo (free, public domain) — primary for hunting
 *   ESRI World Imagery (fair-use, attribution required) — satellite layer
 *
 * For each zoom level z, iterates over all (x, y) tiles that intersect
 * the bounding box. Tiles are stored at:
 *   <documentDirectory>/tiles/<source>/<z>/<x>/<y>.png
 *
 * This is compatible with MapLibre's OfflineManager on native builds.
 *
 * Disclaimer text to show users per build plan:
 *   "Tiles downloaded for personal hunting use only, per OSM/USGS terms."
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BoundingBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type TileSource = 'usgs_topo' | 'esri_satellite';

export type OfflineRegion = {
  id: string;
  name: string;
  bounds: BoundingBox;
  sources: TileSource[];
  minZoom: number;
  maxZoom: number;
  /** Total tiles downloaded successfully */
  tilesDownloaded: number;
  /** Total bytes on disk (approximate) */
  bytesOnDisk: number;
  /** ISO timestamp */
  downloadedAt: string | null;
  /** Whether a download is in progress */
  downloading: boolean;
};

export type DownloadProgress = {
  downloaded: number;
  total: number;
  bytesDownloaded: number;
};

// ─── Tile math ────────────────────────────────────────────────────────────────

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, z),
  );
}

function tileCount(bounds: BoundingBox, minZ: number, maxZ: number): number {
  let total = 0;
  for (let z = minZ; z <= maxZ; z++) {
    const x0 = lngToTileX(bounds.minLng, z);
    const x1 = lngToTileX(bounds.maxLng, z);
    const y0 = latToTileY(bounds.maxLat, z); // note: y is flipped
    const y1 = latToTileY(bounds.minLat, z);
    total += (x1 - x0 + 1) * (y1 - y0 + 1);
  }
  return total;
}

export function estimateTileCount(bounds: BoundingBox, minZ = 10, maxZ = 14): number {
  return tileCount(bounds, minZ, maxZ);
}

/** Rough estimate: each tile is ~30 KB compressed */
export function estimateMegabytes(bounds: BoundingBox, minZ = 10, maxZ = 14): number {
  return Math.round((tileCount(bounds, minZ, maxZ) * 30_000) / 1_000_000);
}

// ─── Tile URL builders ────────────────────────────────────────────────────────

const TILE_URLS: Record<TileSource, (z: number, x: number, y: number) => string> = {
  usgs_topo: (z, x, y) =>
    `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/${z}/${y}/${x}`,
  esri_satellite: (z, x, y) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
};

// ─── Region storage (SQLite via AsyncStorage-style JSON key) ──────────────────
// We store the region index as a JSON string in AsyncStorage-compatible
// storage. This avoids a new Drizzle migration while keeping data local.

async function getAsyncStorage(): Promise<{ getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage').default;
}

const STORAGE_KEY = 'aim:offline_regions_v1';

export async function loadRegions(): Promise<OfflineRegion[]> {
  try {
    const AS = await getAsyncStorage();
    const raw = await AS.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineRegion[];
  } catch {
    return [];
  }
}

async function saveRegions(regions: OfflineRegion[]): Promise<void> {
  const AS = await getAsyncStorage();
  await AS.setItem(STORAGE_KEY, JSON.stringify(regions));
}

export async function deleteRegion(id: string): Promise<void> {
  const regions = await loadRegions();
  // Try to delete tile files (best-effort)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FS = require('expo-file-system') as Record<string, unknown>;
    const docDir = (FS.documentDirectory as string | undefined) ?? 'file:///';
    const tileDir = `${docDir}tiles/${id}/`;
    const deleteAsync = FS.deleteAsync as (uri: string, opts?: unknown) => Promise<void>;
    await deleteAsync(tileDir, { idempotent: true });
  } catch { /* best-effort */ }

  await saveRegions(regions.filter((r) => r.id !== id));
}

// ─── Download engine ──────────────────────────────────────────────────────────

/**
 * Downloads all tiles for a region. Calls onProgress frequently.
 * Can be cancelled via the AbortSignal.
 */
export async function downloadRegion(
  region: Omit<OfflineRegion, 'tilesDownloaded' | 'bytesOnDisk' | 'downloadedAt' | 'downloading'>,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<OfflineRegion> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FS = require('expo-file-system') as Record<string, unknown>;
  const docDir = (FS.documentDirectory as string | undefined) ?? 'file:///';
  const downloadAsync = FS.downloadAsync as (
    uri: string,
    dest: string,
    opts?: unknown,
  ) => Promise<{ status: number; headers: Record<string, string> }>;
  const makeDir = FS.makeDirectoryAsync as (uri: string, opts?: unknown) => Promise<void>;
  const getInfo = FS.getInfoAsync as (uri: string) => Promise<{ size?: number; exists: boolean }>;

  const { minZoom = 10, maxZoom = 14, bounds, sources, id } = region;
  const total = tileCount(bounds, minZoom, maxZoom) * sources.length;
  let downloaded = 0;
  let bytesDownloaded = 0;

  for (const source of sources) {
    for (let z = minZoom; z <= maxZoom; z++) {
      const x0 = lngToTileX(bounds.minLng, z);
      const x1 = lngToTileX(bounds.maxLng, z);
      const y0 = latToTileY(bounds.maxLat, z);
      const y1 = latToTileY(bounds.minLat, z);

      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

          const dir = `${docDir}tiles/${id}/${source}/${z}/${x}/`;
          const dest = `${dir}${y}.png`;

          try {
            await makeDir(dir, { intermediates: true });
            const info = await getInfo(dest);
            if (!info.exists) {
              const url = TILE_URLS[source](z, x, y);
              const res = await downloadAsync(url, dest);
              if (res.status === 200) {
                const fileInfo = await getInfo(dest);
                bytesDownloaded += fileInfo.size ?? 30_000;
              }
            } else {
              bytesDownloaded += info.size ?? 30_000;
            }
          } catch {
            // Non-fatal: tile download failure (network, 404, etc.)
          }

          downloaded++;
          if (downloaded % 5 === 0 || downloaded === total) {
            onProgress({ downloaded, total, bytesDownloaded });
          }
        }
      }
    }
  }

  const completed: OfflineRegion = {
    ...region,
    minZoom,
    maxZoom,
    tilesDownloaded: downloaded,
    bytesOnDisk: bytesDownloaded,
    downloadedAt: new Date().toISOString(),
    downloading: false,
  };

  // Persist to storage
  const existing = await loadRegions();
  const updated = existing.filter((r) => r.id !== id);
  updated.push(completed);
  await saveRegions(updated);

  return completed;
}
