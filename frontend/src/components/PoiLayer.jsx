import { useState, useEffect, useRef, useCallback } from 'react';
import { useMap, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Tent, Loader2, X } from 'lucide-react';
import { API_BASE_URL } from '../config';

const POI_TYPES = {
  camp_site:      { label: 'Camping / Refuge', color: '#10b981', emoji: '⛺' },
  drinking_water: { label: 'Eau potable',      color: '#3b82f6', emoji: '🚰' },
  viewpoint:      { label: 'Point de vue',     color: '#8b5cf6', emoji: '👀' },
  peak:           { label: 'Sommet',           color: '#ef4444', emoji: '⛰️' },
  ruins:          { label: 'Ruines',            color: '#78716c', emoji: '🏛️' },
  monument:       { label: 'Monument',          color: '#a16207', emoji: '🗿' },
};

const poiIconCache = {};
const createPoiIcon = (type) => {
  if (poiIconCache[type]) return poiIconCache[type];
  const config = POI_TYPES[type];
  if (!config) return null;
  const icon = L.divIcon({
    className: 'poi-icon-marker',
    html: `<span class="poi-icon-dot" style="background:${config.color}">${config.emoji}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
  poiIconCache[type] = icon;
  return icon;
};

const MIN_ZOOM = 12;

const PoiLayer = () => {
  const map = useMap();
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const buttonRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const mergePois = useCallback((incoming) => {
    setPois((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      for (const poi of incoming) {
        byId.set(poi.id, poi);
      }
      return Array.from(byId.values());
    });
  }, []);

  const fetchPois = useCallback(async () => {
    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM) {
      setError('Zoomez davantage pour rechercher des POI.');
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const bounds = map.getBounds();
      const params = new URLSearchParams({
        min_lat: String(bounds.getSouth()),
        min_lon: String(bounds.getWest()),
        max_lat: String(bounds.getNorth()),
        max_lon: String(bounds.getEast()),
      });

      const resp = await fetch(`${API_BASE_URL}/api/pois?${params}`, {
        signal: controller.signal,
      });

      let detail = null;
      if (!resp.ok) {
        try {
          const body = await resp.json();
          detail = typeof body?.detail === 'string' ? body.detail : null;
        } catch {
          /* ignore parse errors */
        }
        throw new Error(detail || `Erreur POI (${resp.status})`);
      }

      const data = await resp.json();
      const results = [];
      for (const el of data || []) {
        const type = el.type;
        if (!POI_TYPES[type]) continue;
        const name = (el.name || '').trim() || null;
        if ((type === 'viewpoint' || type === 'peak') && !name) continue;
        const lat = Number(el.lat);
        const lng = Number(el.lon ?? el.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        results.push({
          id: el.id,
          lat,
          lng,
          type,
          name,
          description: el.description || null,
          website: el.website || null,
        });
      }

      if (!controller.signal.aborted) {
        mergePois(results);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('POI query failed:', err);
      if (!controller.signal.aborted) {
        setError(err.message || "Impossible de charger les points d'intérêt.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [map, mergePois]);

  const handleClick = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (loading) return;
    fetchPois();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="poi-search-btn glass-panel"
        onClick={handleClick}
        disabled={loading}
        title="Rechercher les points d'intérêt dans la zone visible"
      >
        {loading ? (
          <Loader2 size={18} className="spinner" />
        ) : (
          <Tent size={18} />
        )}
        <span className="poi-btn-label">
          {loading
            ? 'Recherche…'
            : pois.length > 0
              ? `POI (${pois.length})`
              : 'POI'}
        </span>
      </button>

      {error && (
        <div className="poi-error-toast" role="alert">
          <span className="poi-error-toast__text">{error}</span>
          <button
            type="button"
            className="poi-error-toast__close"
            onClick={() => setError(null)}
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {pois.map((poi) => {
        const config = POI_TYPES[poi.type];
        if (!config) return null;
        return (
          <Marker
            key={`poi-${poi.id}`}
            position={[poi.lat, poi.lng]}
            icon={createPoiIcon(poi.type)}
          >
            <Tooltip direction="top" offset={[0, -14]} className="poi-tooltip">
              <div className="poi-tooltip-content">
                <strong>{config.emoji} {poi.name || 'Sans nom'}</strong>
                <span className="poi-type-tag">{config.label}</span>
                {poi.description && (
                  <span className="poi-description">{poi.description}</span>
                )}
                {(poi.type === 'camp_site') && poi.website && (
                  <a
                    href={poi.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="poi-website-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {poi.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                )}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
};

export default PoiLayer;
