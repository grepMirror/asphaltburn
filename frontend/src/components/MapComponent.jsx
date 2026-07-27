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

// A continuous, intuitive scale: blue downhill, green flat, red steep uphill.
const GRADE_COLOR_STOPS = [
  { grade: -8, color: [37, 99, 235] },
  { grade: -3, color: [14, 165, 233] },
  { grade: -0.5, color: [20, 184, 166] },
  { grade: 1, color: [34, 197, 94] },
  { grade: 4, color: [234, 179, 8] },
  { grade: 8, color: [249, 115, 22] },
  { grade: 12, color: [220, 38, 38] },
];

function gradeToColor(gradePercent) {
  const grade = Math.max(
    GRADE_COLOR_STOPS[0].grade,
    Math.min(GRADE_COLOR_STOPS[GRADE_COLOR_STOPS.length - 1].grade, gradePercent)
  );
  const upperIndex = GRADE_COLOR_STOPS.findIndex((stop) => grade <= stop.grade);
  if (upperIndex <= 0) {
    return `rgb(${GRADE_COLOR_STOPS[0].color.join(',')})`;
  }

  const lower = GRADE_COLOR_STOPS[upperIndex - 1];
  const upper = GRADE_COLOR_STOPS[upperIndex];
  const ratio = (grade - lower.grade) / (upper.grade - lower.grade);
  const rgb = lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * ratio)
  );
  return `rgb(${rgb.join(',')})`;
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

    // Measure over a wider window to suppress GPS/elevation noise. Coloring
    // every raw point makes an otherwise steady climb look like confetti.
    let beforeIndex = i - 1;
    let afterIndex = i;
    while (
      beforeIndex > 0
      && (Number(b.distance) - Number(profile[beforeIndex].distance)) < 0.075
    ) {
      beforeIndex -= 1;
    }
    while (
      afterIndex < profile.length - 1
      && (Number(profile[afterIndex].distance) - Number(a.distance)) < 0.075
    ) {
      afterIndex += 1;
    }

    const before = profile[beforeIndex];
    const after = profile[afterIndex];
    const distM = (Number(after.distance) - Number(before.distance)) * 1000;
    const riseM = Number(after.elevation) - Number(before.elevation);
    const rawGrade = distM > 1 ? (riseM / distM) * 100 : 0;
    const grade = Math.round(rawGrade * 2) / 2;
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

// Helper to find points at km intervals (step adapts to zoom: 1, 5, 10, …)
const getKmMarkers = (coords, step = 1) => {
  if (coords.length < 2 || step < 1) return [];
  const markers = [];
  let totalDist = 0;
  let nextKm = step;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = L.latLng(coords[i][0], coords[i][1]);
    const p2 = L.latLng(coords[i + 1][0], coords[i + 1][1]);
    const d = p1.distanceTo(p2) / 1000;

    while (totalDist + d >= nextKm) {
      const ratio = (nextKm - totalDist) / d;
      const lat = p1.lat + (p2.lat - p1.lat) * ratio;
      const lng = p1.lng + (p2.lng - p1.lng) * ratio;
      markers.push({ lat, lng, km: nextKm });
      nextKm += step;
    }
    totalDist += d;
  }
  return markers;
};

/** Zoomed in → every km; zoomed out → every 5 / 10 / 25 / 50 km. */
function kmStepForZoom(zoom) {
  if (zoom >= 13) return 1;
  if (zoom >= 11) return 5;
  if (zoom >= 9) return 10;
  if (zoom >= 7) return 25;
  return 50;
}

const KmMarkersLayer = ({ routeCoordinates }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  const step = kmStepForZoom(zoom);
  const markers = useMemo(
    () => getKmMarkers(routeCoordinates, step),
    [routeCoordinates, step]
  );

  return markers.map((m) => (
    <Marker
      key={`km-${step}-${m.km}`}
      position={[m.lat, m.lng]}
      icon={kmIcon(m.km)}
      zIndexOffset={500}
      interactive={false}
    />
  ));
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

        <KmMarkersLayer routeCoordinates={routeCoordinates} />

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
          <>
            <Polyline
              positions={routeCoordinates}
              color="#ffffff"
              weight={9}
              opacity={0.8}
              interactive={false}
            />
            {elevationSegments.map((seg, idx) => (
              <Polyline
                key={`elev-seg-${idx}`}
                positions={seg.coordinates}
                color={seg.color}
                weight={6}
                opacity={1}
              />
            ))}
          </>
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
