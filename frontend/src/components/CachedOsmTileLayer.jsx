import L from 'leaflet';
import { createLayerComponent } from '@react-leaflet/core';
import { TILE_CACHE_NAME, OSM_TILE_URL, isOfflineStorageAvailable } from '../utils/offlinePack';

/**
 * OSM tiles via img URL so the PWA service worker can CacheFirst-serve
 * entries written by offlinePack (including opaque no-cors responses).
 * Also tries Cache API blob URLs when the stored response is readable.
 */
const CachedOsmLeafletLayer = L.TileLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('img');
    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    L.DomEvent.on(tile, 'load', this._tileOnLoad.bind(this, done, tile));
    L.DomEvent.on(tile, 'error', this._tileOnError.bind(this, done, tile));

    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }

    const url = this.getTileUrl(coords);

    const setSrc = (src, revokeUrl) => {
      if (revokeUrl) {
        tile.addEventListener('load', () => URL.revokeObjectURL(revokeUrl), { once: true });
        tile.addEventListener('error', () => URL.revokeObjectURL(revokeUrl), { once: true });
      }
      tile.src = src;
    };

    // Default path: let the SW / network handle the URL (works with opaque cache).
    const useNetworkOrSw = () => setSrc(url);

    if (!isOfflineStorageAvailable()) {
      useNetworkOrSw();
      return tile;
    }

    caches
      .open(TILE_CACHE_NAME)
      .then(async (cache) => {
        const hit = await cache.match(url);
        if (hit && hit.type !== 'opaque' && hit.ok) {
          try {
            const blob = await hit.blob();
            if (blob && blob.size > 0) {
              const objectUrl = URL.createObjectURL(blob);
              setSrc(objectUrl, objectUrl);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        useNetworkOrSw();
      })
      .catch(useNetworkOrSw);

    return tile;
  },
});

export const CachedOsmTileLayer = createLayerComponent(
  function createCachedOsmTileLayer({ url = OSM_TILE_URL, ...options }, context) {
    const instance = new CachedOsmLeafletLayer(url, options);
    return {
      instance,
      context: { ...context, overlayContainer: instance },
    };
  },
  function updateCachedOsmTileLayer(instance, props, prevProps) {
    const { url, opacity, zIndex } = props;
    if (url != null && url !== prevProps.url) {
      instance.setUrl(url);
    }
    if (opacity != null && opacity !== prevProps.opacity) {
      instance.setOpacity(opacity);
    }
    if (zIndex != null && zIndex !== prevProps.zIndex) {
      instance.setZIndex(zIndex);
    }
  }
);

export default CachedOsmTileLayer;
