import { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Dashboard from './components/Dashboard';
import TopRightMenu from './components/TopRightMenu';
import TrainingPlanner from './components/TrainingPlanner';
import SavedRoutes from './components/SavedRoutes';
import './App.css';
import L from 'leaflet';
import { API_BASE_URL } from './config';
import { BarChart2, Search, Loader2 } from 'lucide-react';

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
    elevation_profile: [],
    road_type_summary: {}
  });
  const [trekRoutes, setTrekRoutes] = useState([]);
  const [activeTrek, setActiveTrek] = useState(null); // { id: string, name: string }
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState('map'); // 'map', 'training', or 'saved'
  const [dashboardOpen, setDashboardOpen] = useState(false); // mobile dashboard toggle
  const [pois, setPois] = useState([]);
  const [mapBounds, setMapBounds] = useState(null);
  const [isSearchingPOIs, setIsSearchingPOIs] = useState(false);

  const isMobile = useIsMobile();

  // When waypoints change, calculate the route
  useEffect(() => {
    const controller = new AbortController();
    
    if (waypoints.length >= 2) {
      calculateRoute(controller.signal);
    } else {
      setRouteInfo({ coordinates: [], segments: [], distance_km: 0, elevation_gain_m: 0, elevation_loss_m: 0, elevation_profile: [], road_type_summary: {} });
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
    setTrekRoutes([]);
    setActiveTrek(null);
  };

  const handleExportGPX = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/export/gpx`, routeInfo, {
        responseType: 'blob'
      });
      // Explicitly set the type to application/gpx+xml to prevent mobile browsers from defaulting to .txt
      const blob = new Blob([response.data], { type: 'application/gpx+xml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'route.gpx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
  
  const handleSaveRoute = async () => {
    if (waypoints.length < 2) return;
    
    const defaultName = `Itinéraire ${routeInfo.distance_km.toFixed(1)}km - ${new Date().toLocaleDateString('fr-FR')}`;
    const name = window.prompt("Nom de l'itinéraire :", defaultName);
    if (!name) return;

    const savedRoute = {
      id: "new",
      name: name,
      date: new Date().toISOString(),
      waypoints: waypoints,
      route_data: routeInfo,
      trek_id: activeTrek?.id || null,
      trek_name: activeTrek?.name || null
    };

    if (!activeTrek) {
      const trekNameInput = window.prompt("Nom du Trek (optionnel - pour grouper plusieurs étapes) :");
      if (trekNameInput) {
        savedRoute.trek_name = trekNameInput;
        savedRoute.trek_id = btoa(trekNameInput).substring(0, 8);
      }
    } else {
      // Confirm saving within active trek
      if (!window.confirm(`Enregistrer ce segment comme nouvelle étape du trek "${activeTrek.name}" ?`)) return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/saved-routes`, savedRoute);
      alert("Itinéraire enregistré !");
    } catch (error) {
      console.error("Error saving route:", error);
      alert("Erreur lors de l'enregistrement de l'itinéraire.");
    }
  };

  const handleLoadRoute = async (savedRoute) => {
    // We set waypoints, which will trigger the calculateRoute useEffect.
    setWaypoints(savedRoute.waypoints);
    setRouteInfo(savedRoute.route_data);
    
    // Fetch trek companions if needed
    if (savedRoute.trek_id) {
      setActiveTrek({ id: savedRoute.trek_id, name: savedRoute.trek_name });
      try {
        const response = await axios.get(`${API_BASE_URL}/api/saved-routes/trek/${savedRoute.trek_id}`);
        // Filter out the current route
        setTrekRoutes(response.data.filter(r => r.id !== savedRoute.id));
      } catch (error) {
        console.error("Error fetching trek routes:", error);
      }
    } else {
      setTrekRoutes([]);
      setActiveTrek(null);
    }
    
    setView('map');
  };

  const handleCreateTrekStep = async (trekId, trekName) => {
    setWaypoints([]);
    setRouteInfo({ coordinates: [], segments: [], distance_km: 0, elevation_gain_m: 0, elevation_loss_m: 0, elevation_profile: [], road_type_summary: {} });
    setActiveTrek({ id: trekId, name: trekName });
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-routes/trek/${trekId}`);
      setTrekRoutes(response.data);
    } catch (error) {
      console.error("Error fetching trek routes:", error);
    }
    
    setView('map');
  };

  const handleSearchPOIs = async () => {
    if (!mapBounds) return;
    setIsSearchingPOIs(true);
    try {
      const { _southWest, _northEast } = mapBounds;
      const response = await axios.get(`${API_BASE_URL}/api/pois`, {
        params: {
          min_lat: _southWest.lat,
          min_lon: _southWest.lng,
          max_lat: _northEast.lat,
          max_lon: _northEast.lng
        }
      });
      setPois(response.data);
      if (response.data.length === 0) {
        alert("Aucun point d'intérêt trouvé dans cette zone.");
      }
    } catch (error) {
      console.error("Error searching POIs:", error);
      alert("Erreur lors de la recherche des points d'intérêt.");
    } finally {
      setIsSearchingPOIs(false);
    }
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
            trekRoutes={trekRoutes}
            routeCoordinates={routeInfo.coordinates}
            segments={routeInfo.segments}
            onMapClick={handleMapClick}
            onMarkerDrag={handleMarkerDrag}
            searchResult={searchResult}
            isMobile={isMobile}
            pois={pois}
            onBoundsChange={setMapBounds}
          />

          <button 
            className={`poi-search-btn ${isSearchingPOIs ? 'loading' : ''}`}
            onClick={handleSearchPOIs}
            disabled={isSearchingPOIs}
            title="Chercher Camping, Bivouac, Eau, Toilettes, Magasins..."
          >
            {isSearchingPOIs ? <Loader2 className="spinner" size={20} /> : <Search size={20} />}
            <span>{isSearchingPOIs ? 'Recherche...' : 'Services & Bivouac'}</span>
          </button>

          <Dashboard 
            distance={routeInfo.distance_km}
            elevation={routeInfo.elevation_gain_m}
            elevationLoss={routeInfo.elevation_loss_m}
            elevationProfile={routeInfo.elevation_profile}
            roadTypeSummary={routeInfo.road_type_summary}
            segments={routeInfo.segments}
            waypointsCount={waypoints.length}
            onUndo={handleUndo}
            onReset={handleReset}
            isMobile={isMobile}
            isOpen={dashboardOpen}
            onOpen={() => setDashboardOpen(true)}
            onClose={() => setDashboardOpen(false)}
            onSave={handleSaveRoute}
            activeTrek={activeTrek}
          />
        </>
      ) : view === 'training' ? (
        <TrainingPlanner />
      ) : (
        <SavedRoutes 
          onLoadRoute={handleLoadRoute}
          onCreateTrekStep={handleCreateTrekStep}
          onBack={() => setView('map')} 
        />
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
