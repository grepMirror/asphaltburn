import { MapContainer, TileLayer, Polyline, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

// Color map for road types (synced with Dashboard.jsx)
const ROAD_TYPE_COLORS = {
  "Route": "#3b82f6",          // Blue
  "Chemin / Sentier": "#10b981", // Green
  "Chemin empierré": "#059669",  // Dark Green
  "Piste Cyclable": "#8b5cf6",   // Violet
  "Escaliers": "#f43f5e",        // Rose
  "Autoroute": "#ef4444",        // Red
  "Autre": "#94a3b8",           // Slate
  "Default": "#6366f1"          // Indigo
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

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
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
    const p2 = L.latLng(coords[i+1][0], coords[i+1][1]);
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

const MapComponent = ({ waypoints, routeCoordinates, segments, onMapClick, onMarkerDrag, searchResult }) => {
  const kmMarkers = getKmMarkers(routeCoordinates);

  return (
    <div className="map-container">
      <MapContainer 
        center={[46.603354, 1.888334]} 
        zoom={6} 
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapEvents onMapClick={onMapClick} />
        <ChangeView center={searchResult} />

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
