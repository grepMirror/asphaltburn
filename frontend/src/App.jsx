import { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Dashboard from './components/Dashboard';
import TopRightMenu from './components/TopRightMenu';
import TrainingPlanner from './components/TrainingPlanner';
import './App.css';
import L from 'leaflet';
import { API_BASE_URL } from './config';
import { BarChart2 } from 'lucide-react';

// Custom hook: detect mobile viewport
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

function App() {
  const [waypoints, setWaypoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState({
    coordinates: [],
    segments: [],
    distance_km: 0,
    elevation_gain_m: 0,
    elevation_loss_m: 0,
    road_type_summary: {}
  });
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState('map'); // 'map' or 'training'
  const [dashboardOpen, setDashboardOpen] = useState(false); // mobile dashboard toggle

  const isMobile = useIsMobile();

  // When waypoints change, calculate the route
  useEffect(() => {
    const controller = new AbortController();
    
    if (waypoints.length >= 2) {
      calculateRoute(controller.signal);
    } else {
      setRouteInfo({ coordinates: [], segments: [], distance_km: 0, elevation_gain_m: 0, elevation_loss_m: 0, road_type_summary: {} });
    }

    return () => controller.abort();
  }, [waypoints]);

  const calculateRoute = async (signal) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/route`, {
        waypoints: waypoints
      }, { signal });
      setRouteInfo(response.data);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request cancelled:", error.message);
      } else {
        console.error("Error calculating route:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClick = (latlng) => {
    setWaypoints([...waypoints, { lat: latlng.lat, lng: latlng.lng }]);
    setSearchResult(null);
  };

  const handleMarkerDrag = (index, newLatlng) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = { lat: newLatlng.lat, lng: newLatlng.lng };
    setWaypoints(newWaypoints);
  };

  const handleCitySelect = (city) => {
    setSearchResult([city.lat, city.lng]);
  };

  const handleUndo = () => {
    setWaypoints(waypoints.slice(0, -1));
  };

  const handleReset = () => {
    setWaypoints([]);
  };

  const handleExportGPX = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/export/gpx`, routeInfo, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'route.gpx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error exporting GPX:", error);
    }
  };

  const handleImportGPX = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const gpxText = e.target.result;
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(gpxText, "text/xml");
      const trkpts = Array.from(gpxDoc.querySelectorAll('trkpt'));
      
      if (trkpts.length === 0) {
        alert("Ce fichier GPX ne contient pas de traces (trkpt).");
        return;
      }

      const coords = trkpts.map(pt => ({
        lat: parseFloat(pt.getAttribute('lat')),
        lng: parseFloat(pt.getAttribute('lon'))
      }));

      // Interpolate waypoints every 1km
      const newWaypoints = [];
      newWaypoints.push(coords[0]); // Start point

      let totalDist = 0;
      let nextKmThreshold = 1.0;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = L.latLng(coords[i].lat, coords[i].lng);
        const p2 = L.latLng(coords[i+1].lat, coords[i+1].lng);
        const segmentDist = p1.distanceTo(p2) / 1000; // in km

        while (totalDist + segmentDist >= nextKmThreshold) {
          const ratio = (nextKmThreshold - totalDist) / segmentDist;
          const lat = coords[i].lat + (coords[i+1].lat - coords[i].lat) * ratio;
          const lng = coords[i].lng + (coords[i+1].lng - coords[i].lng) * ratio;
          newWaypoints.push({ lat, lng });
          nextKmThreshold += 1.0;
        }
        totalDist += segmentDist;
      }

      // Final point if not already added
      const lastPoint = coords[coords.length - 1];
      const distanceToLast = L.latLng(newWaypoints[newWaypoints.length - 1].lat, newWaypoints[newWaypoints.length - 1].lng)
                             .distanceTo(L.latLng(lastPoint.lat, lastPoint.lng));
      
      if (distanceToLast > 50) {
        newWaypoints.push(lastPoint);
      }

      setWaypoints(newWaypoints);
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      <TopRightMenu 
        onCitySelect={handleCitySelect} 
        onExport={handleExportGPX} 
        onImport={handleImportGPX}
        onUndo={handleUndo}
        waypointsCount={waypoints.length}
        currentView={view}
        onViewChange={setView}
      />
      
      {view === 'map' ? (
        <>
          <MapComponent 
            waypoints={waypoints}
            routeCoordinates={routeInfo.coordinates}
            segments={routeInfo.segments}
            onMapClick={handleMapClick}
            onMarkerDrag={handleMarkerDrag}
            searchResult={searchResult}
            isMobile={isMobile}
          />

          <Dashboard 
            distance={routeInfo.distance_km}
            elevation={routeInfo.elevation_gain_m}
            elevationLoss={routeInfo.elevation_loss_m}
            roadTypeSummary={routeInfo.road_type_summary}
            segments={routeInfo.segments}
            waypointsCount={waypoints.length}
            onUndo={handleUndo}
            onReset={handleReset}
            isMobile={isMobile}
            isOpen={dashboardOpen}
            onOpen={() => setDashboardOpen(true)}
            onClose={() => setDashboardOpen(false)}
          />
        </>
      ) : (
        <TrainingPlanner />
      )}

      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          background: 'rgba(0,0,0,0.5)',
          padding: '0.5rem 1rem',
          borderRadius: '1rem',
          zIndex: 1001,
          backdropFilter: 'blur(4px)',
          color: 'white',
          fontSize: '0.9rem'
        }}>
          Calcul de l'itinéraire...
        </div>
      )}
    </div>
  );
}

export default App;
