import React, { useEffect } from 'react';
import { LayersControl, WMSTileLayer, MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMapEvents, useMap, Tooltip, Popup } from 'react-leaflet';
import { Tent, Droplets, Home, Info } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LocationButton from './LocationButton';
import CompassButton from './CompassButton';

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
const createNumberedIcon = (number) => {
  return L.divIcon({
    className: 'numbered-marker',
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

// POI Icons using Lucide
const getPoiIcon = (type) => {
  let color = "#3b82f6";
  let Icon = Info;
  
  if (type === "camping") { color = "#10b981"; Icon = Tent; }
  if (type === "water") { color = "#3b82f6"; Icon = Droplets; }
  if (type === "shelter") { color = "#f59e0b"; Icon = Home; }

  const iconHtml = renderToStaticMarkup(
    <div style={{
      backgroundColor: color,
      borderRadius: '50%',
      padding: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    }}>
      <Icon color="white" size={16} />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'poi-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const MapComponent = ({ waypoints, trekRoutes, routeCoordinates, segments, onMapClick, onMarkerDrag, searchResult, isMobile, pois, onBoundsChange }) => {
  const kmMarkers = getKmMarkers(routeCoordinates);

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

        {waypoints.map((wp, idx) => (
          <Marker
            key={idx}
            position={[wp.lat, wp.lng]}
            icon={createNumberedIcon(idx + 1)}
            draggable={true}
            zIndexOffset={1000}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                onMarkerDrag(idx, position);
              },
            }}
          />
        ))}

        {kmMarkers.map((m, idx) => (
          <Marker
            key={`km-${idx}`}
            position={[m.lat, m.lng]}
            icon={kmIcon(m.km)}
            zIndexOffset={500}
          />
        ))}

        {/* Outdoor POIs from API */}
        {pois && pois.map((poi) => (
          <Marker 
            key={`poi-${poi.id}`} 
            position={[poi.lat, poi.lon]} 
            icon={getPoiIcon(poi.type)}
          >
            <Popup className="poi-popup">
              <div className="poi-popup-content">
                <h3>{poi.name}</h3>
                <span className="poi-badge">{poi.type}</span>
                <div className="poi-tags">
                  {Object.entries(poi.tags).map(([k, v]) => (
                    k !== 'name' && k !== 'tourism' && k !== 'amenity' && (
                      <div key={k} className="poi-tag">
                        <strong>{k}:</strong> {v}
                      </div>
                    )
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

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

        {/* Color-coded segments */}
        {segments && segments.length > 0 ? (
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
          // Fallback if no segments yet
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
