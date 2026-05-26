import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Dashboard from './components/Dashboard';
import TopRightMenu from './components/TopRightMenu';
import TrainingPlanner from './components/TrainingPlanner';
import AcwrChartsPage from './components/AcwrChartsPage';
import SavedRoutes from './components/SavedRoutes';
import PinPrompt, { getStoredPin } from './components/PinPrompt';
import './App.css';
import L from 'leaflet';
import { API_BASE_URL } from './config';

import { X } from 'lucide-react';

const ROUTE_DEBOUNCE_MS = 350;

const emptyRouteInfo = () => ({
  coordinates: [],
  segments: [],
  distance_km: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  elevation_profile: [],
  road_type_summary: {},
});

const isRouteRequestCancelled = (error) =>
  axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

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

const STORAGE_KEY = 'openrun_track';

function loadPersistedTrack() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function persistTrack(waypoints, activeTrek) {
  try {
    if (!waypoints || waypoints.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ waypoints, activeTrek }));
    }
  } catch { /* quota exceeded or private browsing */ }
}

function App() {
  const persisted = loadPersistedTrack();
  const [waypoints, setWaypoints] = useState(persisted?.waypoints || []);
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
  const [activeTrek, setActiveTrek] = useState(persisted?.activeTrek || null);
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isElevationLoading, setIsElevationLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [view, setView] = useState('map'); // 'map', 'training', 'saved', or 'acwr'
  const [dashboardOpen, setDashboardOpen] = useState(false); // mobile dashboard toggle
  const [mapBounds, setMapBounds] = useState(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingSaveAfterPin, setPendingSaveAfterPin] = useState(false);
  const [insertMode, setInsertMode] = useState(null); // null or { afterIndex: number }

  const isMobile = useIsMobile();

  const handleViewChange = (nextView) => {
    setView(nextView);
    if (nextView === 'map') {
      setDashboardOpen(false);
    }
  };

  useEffect(() => {
    persistTrack(waypoints, activeTrek);
  }, [waypoints, activeTrek]);

  // Debounced route (IGN) with skip_elevation; D+/profile filled via POST /api/route/elevation in the same turn.
  useEffect(() => {
    if (waypoints.length < 2) {
      setRouteInfo(emptyRouteInfo());
      setRouteError(null);
      setIsLoading(false);
      setIsElevationLoading(false);
      return undefined;
    }

    const routeController = new AbortController();
    const elevController = new AbortController();
    const debounceTimer = setTimeout(() => {
      (async () => {
        setIsLoading(true);
        setIsElevationLoading(false);
        setRouteError(null);
        let routeData = null;
        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/route`,
            { waypoints, skip_elevation: true },
            { signal: routeController.signal }
          );
          if (routeController.signal.aborted) {
            return;
          }
          routeData = response.data;
          setRouteInfo(routeData);
        } catch (error) {
          if (isRouteRequestCancelled(error)) {
            return;
          }
          const detail = error.response?.data?.detail;
          const message =
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? detail.map((d) => d.msg || JSON.stringify(d)).join(' — ')
                : error.message || 'Erreur réseau';
          setRouteError(message);
          setRouteInfo(emptyRouteInfo());
          console.error('Error calculating route:', error);
          return;
        } finally {
          setIsLoading(false);
        }

        const coords = routeData?.coordinates;
        if (!coords || coords.length < 2 || routeController.signal.aborted) {
          return;
        }

        setIsElevationLoading(true);
        try {
          const elev = await axios.post(
            `${API_BASE_URL}/api/route/elevation`,
            { coordinates: coords },
            { signal: elevController.signal }
          );
          if (elevController.signal.aborted) {
            return;
          }
          setRouteInfo((prev) => ({
            ...prev,
            elevation_gain_m: elev.data.elevation_gain_m,
            elevation_loss_m: elev.data.elevation_loss_m,
            elevation_profile: elev.data.elevation_profile,
          }));
        } catch (err) {
          if (!isRouteRequestCancelled(err)) {
            console.error('Error fetching elevation:', err);
          }
        } finally {
          setIsElevationLoading(false);
        }
      })();
    }, ROUTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      routeController.abort();
      elevController.abort();
    };
  }, [waypoints]);

  const handleMapClick = (latlng) => {
    setRouteError(null);
    setSearchResult(null);
    if (insertMode !== null) {
      const newWaypoints = [...waypoints];
      const insertAt = insertMode.afterIndex + 1;
      newWaypoints.splice(insertAt, 0, { lat: latlng.lat, lng: latlng.lng });
      setWaypoints(newWaypoints);
      setInsertMode({ afterIndex: insertAt, originIndex: insertMode.originIndex });
    } else {
      setWaypoints([...waypoints, { lat: latlng.lat, lng: latlng.lng }]);
    }
  };

  const handleMarkerClick = (index) => {
    setInsertMode({ afterIndex: index, originIndex: index });
  };

  const handleExitInsertMode = () => {
    setInsertMode(null);
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
    if (waypoints.length === 0) return;

    if (insertMode !== null && insertMode.afterIndex !== insertMode.originIndex) {
      const newWaypoints = [...waypoints];
      newWaypoints.splice(insertMode.afterIndex, 1);
      setWaypoints(newWaypoints);
      setInsertMode({ afterIndex: insertMode.afterIndex - 1, originIndex: insertMode.originIndex });
    } else {
      setWaypoints(waypoints.slice(0, -1));
      setInsertMode(null);
    }
  };

  const handleReset = () => {
    setWaypoints([]);
    setTrekRoutes([]);
    setActiveTrek(null);
    setRouteError(null);
    setInsertMode(null);
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
  
  const doSaveRoute = useCallback(async (pin) => {
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
      if (!window.confirm(`Enregistrer ce segment comme nouvelle étape du trek "${activeTrek.name}" ?`)) return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/saved-routes`, savedRoute, { params: { pin } });
      alert("Itinéraire enregistré !");
    } catch (error) {
      console.error("Error saving route:", error);
      alert("Erreur lors de l'enregistrement de l'itinéraire.");
    }
  }, [waypoints, routeInfo, activeTrek]);

  const handleSaveRoute = () => {
    if (waypoints.length < 2) return;
    const pin = getStoredPin();
    if (!pin) {
      setPendingSaveAfterPin(true);
      setShowPinPrompt(true);
      return;
    }
    doSaveRoute(pin);
  };

  const handlePinAuthenticated = (pin) => {
    setShowPinPrompt(false);
    if (pendingSaveAfterPin) {
      setPendingSaveAfterPin(false);
      doSaveRoute(pin);
    }
  };

  const handleLoadRoute = async (savedRoute) => {
    setRouteError(null);
    setWaypoints(savedRoute.waypoints);
    setRouteInfo(savedRoute.route_data);

    if (savedRoute.trek_id) {
      setActiveTrek({ id: savedRoute.trek_id, name: savedRoute.trek_name });
      const pin = getStoredPin();
      try {
        const response = await axios.get(`${API_BASE_URL}/api/saved-routes/trek/${savedRoute.trek_id}`, { params: { pin } });
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
    setRouteInfo(emptyRouteInfo());
    setRouteError(null);
    setActiveTrek({ id: trekId, name: trekName });

    const pin = getStoredPin();
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-routes/trek/${trekId}`, { params: { pin } });
      setTrekRoutes(response.data);
    } catch (error) {
      console.error("Error fetching trek routes:", error);
    }

    setView('map');
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
        onViewChange={handleViewChange}
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
            onMarkerClick={handleMarkerClick}
            searchResult={searchResult}
            isMobile={isMobile}
            onBoundsChange={setMapBounds}
            insertMode={insertMode}
          />

          {insertMode !== null && (
            <div className="insert-mode-badge glass-panel" onClick={handleExitInsertMode}>
              <span>Mode insertion</span>
              <X size={16} />
            </div>
          )}

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
            elevationLoading={isElevationLoading}
          />
        </>
      ) : (
        <div className="app-page">
          {view === 'training' ? (
            <TrainingPlanner onOpenAcwrCharts={() => setView('acwr')} />
          ) : view === 'acwr' ? (
            <AcwrChartsPage onBack={() => setView('training')} />
          ) : (
            <SavedRoutes 
              onLoadRoute={handleLoadRoute}
              onCreateTrekStep={handleCreateTrekStep}
              onBack={() => setView('map')} 
            />
          )}
        </div>
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

      {routeError && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            top: isLoading ? '5.25rem' : '2rem',
            right: '2rem',
            maxWidth: 'min(420px, calc(100vw - 2rem))',
            background: 'rgba(127, 29, 29, 0.92)',
            padding: '0.65rem 0.85rem',
            borderRadius: '1rem',
            zIndex: 1002,
            backdropFilter: 'blur(4px)',
            color: 'white',
            fontSize: '0.85rem',
            lineHeight: 1.35,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          }}
        >
          <span style={{ flex: 1 }}>{routeError}</span>
          <button
            type="button"
            onClick={() => setRouteError(null)}
            aria-label="Fermer"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              lineHeight: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {showPinPrompt && (
        <PinPrompt onAuthenticated={handlePinAuthenticated} />
      )}
    </div>
  );
}

export default App;
