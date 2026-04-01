import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Trash2, MapPin, Calendar, ArrowRight, Loader, X } from 'lucide-react';

const SavedRoutes = ({ onLoadRoute, onBack }) => {
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-routes`);
      setRoutes(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching routes:", err);
      setError("Impossible de charger les itinéraires enregistrés.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cet itinéraire ?")) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/saved-routes/${id}`);
      setRoutes(routes.filter(r => r.id !== id));
    } catch (err) {
      console.error("Error deleting route:", err);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleLoad = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-routes/${id}`);
      onLoadRoute(response.data);
    } catch (err) {
      console.error("Error loading route:", err);
      alert("Erreur lors du chargement de l'itinéraire.");
    }
  };

  return (
    <div className="saved-routes-container glass-panel">
      <div className="saved-routes-header">
        <h2>Itinéraires enregistrés</h2>
        <button className="icon-btn" onClick={onBack}>
          <X size={24} />
        </button>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <Loader className="spin" size={32} />
          <p>Chargement des itinéraires...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
          <button className="btn primary" onClick={fetchRoutes}>Réessayer</button>
        </div>
      ) : routes.length === 0 ? (
        <div className="empty-state">
          <MapPin size={48} opacity={0.3} />
          <p>Aucun itinéraire enregistré pour le moment.</p>
          <button className="btn primary" onClick={onBack}>Créer un itinéraire</button>
        </div>
      ) : (
        <div className="routes-list">
          {routes.map(route => (
            <div 
              key={route.id} 
              className="route-card glass-panel" 
              onClick={() => handleLoad(route.id)}
            >
              <div className="route-card-content">
                <div className="route-card-main">
                  <h3>{route.name}</h3>
                  <div className="route-meta">
                    <span className="meta-item">
                      <Calendar size={14} />
                      {new Date(route.date).toLocaleDateString()}
                    </span>
                    <span className="meta-item">
                      <strong>{route.distance_km.toFixed(1)} km</strong>
                    </span>
                    <span className="meta-item">
                      <strong>+{route.elevation_gain_m} m</strong>
                    </span>
                  </div>
                </div>
                <div className="route-card-actions">
                  <button 
                    className="icon-btn delete" 
                    onClick={(e) => handleDelete(e, route.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="load-indicator">
                    <ArrowRight size={20} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedRoutes;
