import { useState, useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Tent, Loader2 } from 'lucide-react';

const POI_TYPES = {
  camp_site:      { label: 'Camping',       color: '#10b981', emoji: '⛺' },
  alpine_hut:     { label: 'Refuge gardé',  color: '#d97706', emoji: '🏔️' },
  drinking_water: { label: 'Eau potable',   color: '#3b82f6', emoji: '🚰' },
  spring:         { label: 'Source',         color: '#06b6d4', emoji: '💧' },
  water_point:    { label: 'Point d\'eau',   color: '#3b82f6', emoji: '🚰' },
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

const MIN_ZOOM = 11;
const DEBOUNCE_MS = 800;

const buildOverpassQuery = (bounds) => {
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  return `[out:json][timeout:15];(node["tourism"="camp_site"](${bbox});node["tourism"="alpine_hut"](${bbox});node["amenity"="drinking_water"](${bbox});node["natural"="spring"](${bbox});node["amenity"="water_point"](${bbox});way["tourism"="camp_site"](${bbox});way["tourism"="alpine_hut"](${bbox}););out center;`;
};

const classifyElement = (el) => {
  const tags = el.tags || {};
  if (tags.tourism === 'camp_site') return 'camp_site';
  if (tags.tourism === 'alpine_hut') return 'alpine_hut';
  if (tags.amenity === 'drinking_water') return 'drinking_water';
  if (tags.natural === 'spring') return 'spring';
  if (tags.amenity === 'water_point') return 'water_point';
  return null;
};

const PoiLayer = () => {
  const map = useMap();
  const [active, setActive] = useState(false);
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  const fetchPois = useCallback(async () => {
    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM) {
      setPois([]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const query = buildOverpassQuery(map.getBounds());
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
      const data = await resp.json();

      const results = [];
      for (const el of data.elements || []) {
        const type = classifyElement(el);
        if (!type) continue;
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (lat == null || lng == null) continue;
        results.push({ id: el.id, lat, lng, type, name: el.tags?.name || null, website: el.tags?.website || el.tags?.['contact:website'] || null });
      }
      if (!controller.signal.aborted) setPois(results);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Overpass query failed:', err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [map]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPois, DEBOUNCE_MS);
  }, [fetchPois]);

  useMapEvents({
    moveend() { if (active) debouncedFetch(); },
  });

  const toggle = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (active) {
      setPois([]);
      setActive(false);
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    } else {
      setActive(true);
      fetchPois();
    }
  };

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const zoomTooLow = active && map.getZoom() < MIN_ZOOM;

  return (
    <>
      <button
        ref={buttonRef}
        className="poi-search-btn glass-panel"
        onClick={toggle}
        disabled={loading}
        style={active ? { borderColor: 'var(--primary)', background: 'var(--primary-container)' } : undefined}
      >
        {loading ? (
          <Loader2 size={18} className="spinner" />
        ) : (
          <Tent size={18} style={{ color: active ? 'var(--primary)' : 'inherit' }} />
        )}
        <span className="poi-btn-label">
          {active
            ? loading ? 'Recherche…' : `POI (${pois.length})`
            : 'POI'}
        </span>
      </button>

      {active && zoomTooLow && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1001,
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '1rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          Zoomez davantage pour voir les POI
        </div>
      )}

      {active && pois.map((poi) => {
        const config = POI_TYPES[poi.type];
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
                {(poi.type === 'camp_site' || poi.type === 'alpine_hut') && poi.website && (
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
