/**
 * Offline pack: itinerary in localStorage + OSM tiles in Cache API.
 * One pack at a time — clear before every save.
 */

export const OFFLINE_PACK_KEY = 'openrun_offline_pack';
export const TILE_CACHE_NAME = 'openrun-tiles-v1';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ZOOM_MIN = 12;
export const ZOOM_MAX = 15;
/** Refuse packs larger than this to protect phone storage. */
export const MAX_TILES = 8000;
/** Pad route bbox by this many km so the corridor is usable on trail. */
export const CORRIDOR_PAD_KM = 1.5;
const DOWNLOAD_CONCURRENCY = 6;

// --- geo helpers ---

function latLngToTile(lat, lng, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  const max = n - 1;
  return {
    x: Math.min(max, Math.max(0, x)),
    y: Math.min(max, Math.max(0, y)),
  };
}

/** Expand lat/lng bounds by ~padKm on each side. */
export function padBounds(bounds, padKm = CORRIDOR_PAD_KM) {
  const { minLat, minLng, maxLat, maxLng } = bounds;
  const midLat = (minLat + maxLat) / 2;
  const latPad = padKm / 111.32;
  const lngPad = padKm / (111.32 * Math.cos((midLat * Math.PI) / 180) || 1);
  return {
    minLat: Math.max(-85, minLat - latPad),
    maxLat: Math.min(85, maxLat + latPad),
    minLng: Math.max(-180, minLng - lngPad),
    maxLng: Math.min(180, maxLng + lngPad),
  };
}

/** Bounds from route coordinates [[lat,lng], ...]. */
export function boundsFromCoordinates(coordinates) {
  if (!coordinates?.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of coordinates) {
    const lat = Number(c[0]);
    const lng = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (!Number.isFinite(minLat)) return null;
  return { minLat, minLng, maxLat, maxLng };
}

export function enumerateTiles(bounds, zMin = ZOOM_MIN, zMax = ZOOM_MAX) {
  const urls = [];
  for (let z = zMin; z <= zMax; z++) {
    const nw = latLngToTile(bounds.maxLat, bounds.minLng, z);
    const se = latLngToTile(bounds.minLat, bounds.maxLng, z);
    const x0 = Math.min(nw.x, se.x);
    const x1 = Math.max(nw.x, se.x);
    const y0 = Math.min(nw.y, se.y);
    const y1 = Math.max(nw.y, se.y);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(OSM_TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }
  return urls;
}

export function estimateTileCount(bounds, zMin = ZOOM_MIN, zMax = ZOOM_MAX) {
  return enumerateTiles(bounds, zMin, zMax).length;
}

export function tileUrl(z, x, y) {
  return OSM_TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

// --- pack persistence ---

/**
 * Cache API only exists in a secure context: https, or http on localhost.
 * On a plain LAN IP (http://192.168.x.x) the browser hides `caches`.
 */
export function isOfflineStorageAvailable() {
  return typeof caches !== 'undefined' && typeof window !== 'undefined' && window.isSecureContext;
}

export const OFFLINE_UNAVAILABLE_MESSAGE =
  'Stockage hors-ligne indisponible : ouvrez l\'app en HTTPS ou sur localhost.';

export function readOfflinePack() {
  try {
    const raw = localStorage.getItem(OFFLINE_PACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasOfflinePack() {
  const pack = readOfflinePack();
  return !!(pack?.coordinates?.length > 1);
}

export async function clearOfflinePack() {
  try {
    localStorage.removeItem(OFFLINE_PACK_KEY);
  } catch { /* ignore */ }
  if (typeof caches !== 'undefined') {
    await caches.delete(TILE_CACHE_NAME);
  }
}

function writeOfflinePack(pack) {
  localStorage.setItem(OFFLINE_PACK_KEY, JSON.stringify(pack));
}

async function fetchAndCacheTile(cache, url) {
  const existing = await cache.match(url);
  if (existing) return true;

  // Prefer CORS (readable) when the CDN allows it; fall back to opaque
  // no-cors so the Service Worker can still CacheFirst-serve img tiles.
  try {
    const corsResponse = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (corsResponse.ok) {
      await cache.put(url, corsResponse.clone());
      return true;
    }
  } catch {
    /* try no-cors below */
  }

  const opaque = await fetch(url, { mode: 'no-cors', credentials: 'omit' });
  await cache.put(url, opaque);
  return true;
}

/**
 * Download tiles into Cache API with limited concurrency.
 * @returns {{ tileCount: number }}
 */
export async function downloadTiles({ urls, onProgress, signal }) {
  if (!isOfflineStorageAvailable()) {
    throw new Error(OFFLINE_UNAVAILABLE_MESSAGE);
  }
  const cache = await caches.open(TILE_CACHE_NAME);
  let done = 0;
  const total = urls.length;
  let cursor = 0;
  let firstError = null;

  async function worker() {
    while (cursor < urls.length) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const i = cursor++;
      const url = urls[i];
      try {
        await fetchAndCacheTile(cache, url);
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        if (!firstError) firstError = e;
        // Continue: a few missing tiles are OK for "see the trace"
      }
      done += 1;
      onProgress?.(done, total);
    }
  }

  const workers = Array.from(
    { length: Math.min(DOWNLOAD_CONCURRENCY, urls.length) },
    () => worker()
  );
  await Promise.all(workers);

  if (done === 0 && firstError) {
    throw firstError;
  }
  return { tileCount: done, failedHint: firstError ? String(firstError.message || firstError) : null };
}

/**
 * Clear previous pack, then save route + download corridor tiles.
 */
export async function saveOfflinePack({
  waypoints,
  routeInfo,
  onProgress,
  signal,
}) {
  if (!isOfflineStorageAvailable()) {
    throw new Error(OFFLINE_UNAVAILABLE_MESSAGE);
  }

  const coordinates = routeInfo?.coordinates || [];
  if (coordinates.length < 2) {
    throw new Error('Aucun itinéraire à enregistrer hors-ligne.');
  }

  const rawBounds = boundsFromCoordinates(coordinates);
  if (!rawBounds) {
    throw new Error('Coordonnées d\'itinéraire invalides.');
  }
  const bounds = padBounds(rawBounds);
  const urls = enumerateTiles(bounds);
  if (urls.length > MAX_TILES) {
    throw new Error(
      `Zone trop grande (${urls.length} tuiles, max ${MAX_TILES}). Raccourcissez l'itinéraire.`
    );
  }

  // One pack only — drop previous tiles/pack before writing the new one.
  await clearOfflinePack();

  onProgress?.(0, urls.length);
  const { tileCount, failedHint } = await downloadTiles({ urls, onProgress, signal });

  const pack = {
    waypoints: (waypoints || []).map((w) => ({ lat: w.lat, lng: w.lng })),
    coordinates,
    segments: routeInfo.segments || [],
    distance_km: routeInfo.distance_km || 0,
    elevation_gain_m: routeInfo.elevation_gain_m || 0,
    elevation_loss_m: routeInfo.elevation_loss_m || 0,
    elevation_profile: routeInfo.elevation_profile || [],
    road_type_summary: routeInfo.road_type_summary || {},
    savedAt: new Date().toISOString(),
    tileBounds: bounds,
    zooms: [ZOOM_MIN, ZOOM_MAX],
    tileCount,
  };
  writeOfflinePack(pack);

  return { pack, failedHint };
}

/** Resolve a tile from cache (for Leaflet createTile). */
export async function matchCachedTile(url) {
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open(TILE_CACHE_NAME);
  return cache.match(url);
}
