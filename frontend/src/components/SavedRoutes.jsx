import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Trash2, MapPin, Calendar, ArrowRight, Loader, X, Folder, ChevronRight, ChevronDown, Plus } from 'lucide-react';

const SavedRoutes = ({ onLoadRoute, onCreateTrekStep, onBack }) => {
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTreks, setExpandedTreks] = useState({});

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

  const toggleTrek = (trekId) => {
    setExpandedTreks(prev => ({
      ...prev,
      [trekId]: !prev[trekId]
    }));
  };

  // Group routes by trek
  const groupedRoutes = routes.reduce((acc, route) => {
    if (route.trek_id) {
      if (!acc.treks[route.trek_id]) {
        acc.treks[route.trek_id] = {
          id: route.trek_id,
          name: route.trek_name,
          routes: []
        };
      }
      acc.treks[route.trek_id].routes.push(route);
    } else {
      acc.standalone.push(route);
    }
    return acc;
  }, { treks: {}, standalone: [] });

  // Sort trek routes by date (earliest first, as steps)
  Object.values(groupedRoutes.treks).forEach(trek => {
    trek.routes.sort((a, b) => new Date(a.date) - new Date(b.date));
  });

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
          {/* Render Treks */}
          {Object.values(groupedRoutes.treks).map(trek => (
            <div key={trek.id} className="trek-group">
              <div 
                className={`trek-folder glass-panel ${expandedTreks[trek.id] ? 'expanded' : ''}`}
                onClick={() => toggleTrek(trek.id)}
              >
                <div className="folder-content">
                  <Folder size={20} className="folder-icon" />
                  <div className="folder-info">
                    <h3>{trek.name}</h3>
                    <span className="folder-meta">{trek.routes.length} étapes</span>
                  </div>
                </div>
                <div className="folder-actions">
                  <button 
                    className="btn primary small create-step-btn" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onCreateTrekStep(trek.id, trek.name); 
                    }}
                  >
                    <Plus size={16} /> Étape
                  </button>
                  {expandedTreks[trek.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </div>
              
              {expandedTreks[trek.id] && (
                <div className="trek-steps">
                  {trek.routes.map((route, idx) => (
                    <div 
                      key={route.id} 
                      className="route-card trek-step glass-panel" 
                      onClick={() => handleLoad(route.id)}
                    >
                      <div className="route-card-content">
                        <div className="route-card-main">
                          <div className="step-badge">Étape {idx + 1}</div>
                          <h3>{route.name}</h3>
                          <div className="route-meta">
                            <span className="meta-item">
                              {route.distance_km.toFixed(1)} km
                            </span>
                            <span className="meta-item">
                              +{route.elevation_gain_m} m
                            </span>
                          </div>
                        </div>
                        <div className="route-card-actions">
                          <button 
                            className="icon-btn delete" 
                            onClick={(e) => handleDelete(e, route.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Render Standalone Routes */}
          {groupedRoutes.standalone.map(route => (
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
