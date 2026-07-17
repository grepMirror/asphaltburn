import React, { useEffect, useMemo, useState } from 'react';
import { LayersControl, WMSTileLayer, MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMapEvents, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LocationButton from './LocationButton';
import CompassButton from './CompassButton';
import PoiLayer from './PoiLayer';
import TraceStyleToggle from './TraceStyleToggle';

// Color map for road types (synced with Dashboard.jsx)
const ROAD_TYPE_COLORS = {
  "Route": "#0040a1",          // Premium Blue
  "Chemin / Sentier": "#10b981", // Emerald
  "Chemin empierré": "#059669",  // Dark Emerald
  "Piste Cyclable": "#8b5cf6",   // Violet
  "Escaliers": "#f43f5e",        // Rose
  "Autoroute": "#ef4444",        // Red
  "Autre": "#64748b",           // Slate
  "Default": "#0040a1"          // Premium Blue
};

/** Flat/downhill → green; climbs → lime → yellow → orange → red by grade %. */
function gradeToColor(gradePercent) {
  if (gradePercent <= 0.5) return '#10b981'; // flat / downhill
  if (gradePercent < 3) return '#84cc16';    // gentle climb
  if (gradePercent < 6) return '#eab308';    // moderate
  if (gradePercent < 10) return '#f97316';   // steep
  return '#ef4444';                         // very steep
}

function buildElevationSegments(profile) {
  if (!profile || profile.length < 2) return [];

  const segments = [];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    const lat1 = Number(a.lat);
    const lng1 = Number(a.lng);
    const lat2 = Number(b.lat);
    const lng2 = Number(b.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) continue;

    const distM = (Number(b.distance) - Number(a.distance)) * 1000;
    const riseM = Number(b.elevation) - Number(a.elevation);
    const grade = distM > 1 ? (riseM / distM) * 100 : 0;
    const color = gradeToColor(grade);

    const last = segments[segments.length - 1];
    if (last && last.color === color) {
      last.coordinates.push([lat2, lng2]);
    } else {
      segments.push({
        color,
        coordinates: [[lat1, lng1], [lat2, lng2]],
      });
    }
  }
  return segments;
}

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom icon logic for numbered markers
const createNumberedIcon = (number, active = false) => {
  const cls = active ? 'numbered-marker insert-active' : 'numbered-marker';
  return L.divIcon({
    className: cls,
    html: `<div class="marker-pin"></div><span>${number}</span>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });
};

const kmIcon = (km) => {
  return L.divIcon({
    className: 'km-label',
    html: `<span>${km}km</span>`,
    iconSize: [40, 20],
    iconAnchor: [20, 10]
  });
};

const elevationHoverIcon = (distance, elevation) => {
  const km = Number(distance).toFixed(1);
  const alt = Math.round(Number(elevation) || 0);
  return L.divIcon({
    className: 'elevation-hover-marker',
    html: `<div class="elevation-hover-pulse"></div><div class="elevation-hover-dot"></div><div class="elevation-hover-label">${km} km · ${alt} m</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

const MapEvents = ({ onMapClick, onBoundsChange }) => {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
    moveend() {
      if (onBoundsChange) {
        onBoundsChange(map.getBounds());
      }
    }
  });

  // Initial bounds set
  useEffect(() => {
    if (onBoundsChange) {
      onBoundsChange(map.getBounds());
    }
  }, []);

  return null;
};

const ChangeView = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 13);
    }
  }, [center, map]);
  return null;
};

// Helper to find points at km intervals
const getKmMarkers = (coords) => {
  if (coords.length < 2) return [];
  const markers = [];
  let totalDist = 0;
  let nextKm = 1;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = L.latLng(coords[i][0], coords[i][1]);
    const p2 = L.latLng(coords[i + 1][0], coords[i + 1][1]);
    const d = p1.distanceTo(p2) / 1000;

    while (totalDist + d >= nextKm) {
      const ratio = (nextKm - totalDist) / d;
      const lat = p1.lat + (p2.lat - p1.lat) * ratio;
      const lng = p1.lng + (p2.lng - p1.lng) * ratio;
      markers.push({ lat, lng, km: nextKm });
      nextKm++;
    }
    totalDist += d;
  }
  return markers;
};


const MapComponent = ({
  waypoints,
  trekRoutes,
  routeCoordinates,
  segments,
  elevationProfile,
  onMapClick,
  onMarkerDrag,
  onMarkerClick,
  searchResult,
  isMobile,
  onBoundsChange,
  insertMode,
  elevationHoverPoint,
}) => {
  const [colorMode, setColorMode] = useState('surface'); // 'surface' | 'elevation'
  const kmMarkers = getKmMarkers(routeCoordinates);
  const elevationSegments = useMemo(
    () => buildElevationSegments(elevationProfile),
    [elevationProfile]
  );
  const hasElevation = elevationSegments.length > 0;

  useEffect(() => {
    if (colorMode === 'elevation' && !hasElevation) {
      setColorMode('surface');
    }
  }, [colorMode, hasElevation]);

  return (
    <div className="map-container">
      <MapContainer
        center={[46.603354, 1.888334]}
        zoom={6}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <LayersControl position="topleft">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          {/* <LayersControl.BaseLayer name="OpenTopoMap (Topographie & D+)">
            <TileLayer
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
            />
          </LayersControl.BaseLayer> */}

          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="IGN Plan V2 (France)">
            <TileLayer
              attribution='&copy; <a href="https://www.ign.fr/">IGN</a>'
              url="https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay name="Itinéraires Pédestres (Waymarked Trails)">
            <TileLayer
              attribution='&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
              url="https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png"
            />
          </LayersControl.Overlay>
        </LayersControl>




        <MapEvents onMapClick={onMapClick} onBoundsChange={onBoundsChange} />
        <ChangeView center={searchResult} />


        {/* Mobile-only floating action buttons */}
        {isMobile && (
          <>
            <LocationButton />
            <CompassButton />
          </>
        )}

        <PoiLayer />
        <TraceStyleToggle
          colorMode={colorMode}
          disabled={!hasElevation}
          onToggle={() =>
            setColorMode((mode) => (mode === 'surface' ? 'elevation' : 'surface'))
          }
        />

        {waypoints.map((wp, idx) => {
          const isActive = insertMode !== null && insertMode.afterIndex === idx;
          return (
            <Marker
              key={idx}
              position={[wp.lat, wp.lng]}
              icon={createNumberedIcon(idx + 1, isActive)}
              draggable={true}
              zIndexOffset={1000}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onMarkerClick?.(idx);
                },
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  onMarkerDrag(idx, position);
                },
              }}
            />
          );
        })}

        {kmMarkers.map((m, idx) => (
          <Marker
            key={`km-${idx}`}
            position={[m.lat, m.lng]}
            icon={kmIcon(m.km)}
            zIndexOffset={500}
          />
        ))}

        {elevationHoverPoint && Number.isFinite(Number(elevationHoverPoint.lat)) && Number.isFinite(Number(elevationHoverPoint.lng)) && (
          <>
            <CircleMarker
              center={[Number(elevationHoverPoint.lat), Number(elevationHoverPoint.lng)]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#10b981',
                fillOpacity: 1,
              }}
              interactive={false}
            />
            <Marker
              position={[Number(elevationHoverPoint.lat), Number(elevationHoverPoint.lng)]}
              icon={elevationHoverIcon(elevationHoverPoint.distance, elevationHoverPoint.elevation)}
              zIndexOffset={2000}
              interactive={false}
            />
          </>
        )}


        {/* Companion Trek Routes (Low Opacity) */}
        {trekRoutes && trekRoutes.map((trekRoute, tIdx) => {
          const coords = trekRoute.route_data.coordinates;
          if (coords.length < 2) return null;

          return (
            <React.Fragment key={`trek-companion-${trekRoute.id}`}>
              <Polyline
                positions={coords}
                color="#475569" // Slate 600 - Bolder than before
                weight={5}
                opacity={0.4}
                dashArray="10, 10"
              >
                <Tooltip sticky direction="top">
                  Espace Trek: {trekRoute.name} {tIdx + 1}
                </Tooltip>
              </Polyline>
              {/* Only Start and End Markers for companions */}
              <CircleMarker
                center={coords[0]}
                radius={6}
                fillColor="#10b981"
                fillOpacity={0.7}
                color="white"
                weight={2}
              />
              <CircleMarker
                center={coords[coords.length - 1]}
                radius={6}
                fillColor="#ef4444"
                fillOpacity={0.7}
                color="white"
                weight={2}
              >
                <Tooltip permanent direction="right" offset={[10, 0]} className="step-label">
                  Étape {tIdx + 1}
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* Trace coloring: surface (road type) or elevation grade */}
        {colorMode === 'elevation' && hasElevation ? (
          elevationSegments.map((seg, idx) => (
            <Polyline
              key={`elev-seg-${idx}`}
              positions={seg.coordinates}
              color={seg.color}
              weight={6}
              opacity={0.95}
            />
          ))
        ) : segments && segments.length > 0 ? (
          segments.map((seg, idx) => (
            <Polyline
              key={`seg-${idx}-${seg.coordinates.length}-${seg.nature}`}
              positions={seg.coordinates}
              color={ROAD_TYPE_COLORS[seg.nature] || ROAD_TYPE_COLORS.Default}
              weight={6}
              opacity={0.9}
            />
          ))
        ) : (
          routeCoordinates.length > 0 && (
            <Polyline
              key="fallback-polyline"
              positions={routeCoordinates}
              color="#3b82f6"
              weight={5}
              opacity={0.8}
            />
          )
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
