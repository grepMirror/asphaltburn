import { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import Dashboard from './components/Dashboard';
import SearchBar from './components/SearchBar';
import './App.css';

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
      const response = await axios.post('http://localhost:8000/api/route', {
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
      const response = await axios.post('http://localhost:8000/api/export/gpx', routeInfo, {
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

  return (
    <div className="app-container">
      <SearchBar onCitySelect={handleCitySelect} />
      
      <MapComponent 
        waypoints={waypoints}
        routeCoordinates={routeInfo.coordinates}
        segments={routeInfo.segments}
        onMapClick={handleMapClick}
        onMarkerDrag={handleMarkerDrag}
        searchResult={searchResult}
      />

      <Dashboard 
        distance={routeInfo.distance_km}
        elevation={routeInfo.elevation_gain_m}
        elevationLoss={routeInfo.elevation_loss_m}
        roadTypeSummary={routeInfo.road_type_summary}
        segments={routeInfo.segments}
        waypointsCount={waypoints.length}
        onExport={handleExportGPX}
        onUndo={handleUndo}
        onReset={handleReset}
      />

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
