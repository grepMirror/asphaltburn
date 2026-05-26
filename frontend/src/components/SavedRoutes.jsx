import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Trash2, MapPin, Calendar, ArrowRight, Loader, X, Folder, ChevronRight, ChevronDown, Plus, Archive, LogOut } from 'lucide-react';
import { downloadBlob } from '../utils/shareExport';
import PinPrompt, { getStoredPin, clearStoredPin } from './PinPrompt';

const SavedRoutes = ({ onLoadRoute, onCreateTrekStep, onBack }) => {
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTreks, setExpandedTreks] = useState({});
  const [trekZipBusyId, setTrekZipBusyId] = useState(null);
  const [pin, setPin] = useState(getStoredPin());

  useEffect(() => {
    if (pin) fetchRoutes();
  }, [pin]);

  const fetchRoutes = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-routes`, { params: { pin } });
      setRoutes(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching routes:", err);
      if (err.response?.status === 401) {
        clearStoredPin();
        setPin(null);
      } else {
        setError("Impossible de charger les itinéraires enregistrés.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cet itinéraire ?")) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/saved-routes/${id}`, { params: { pin } });
      setRoutes(routes.filter(r => r.id !== id));
    } catch (err) {
      console.error("Error deleting route:", err);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleLoad = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-routes/${id}`, { params: { pin } });
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

  const slugBase = (name) => {
    const s = String(name || 'trek').replace(/[^\w\-]+/g, '_').replace(/^_|_$/g, '');
    return (s || 'trek').slice(0, 32);
  };

  const fetchTrekZipBlob = async (trekId) => {
    const res = await axios.get(`${API_BASE_URL}/api/saved-routes/trek/${trekId}/export-gpx-zip`, {
      params: { pin },
      responseType: 'blob',
    });
    return res.data;
  };

  const handleDownloadTrekZip = async (e, trek) => {
    e.stopPropagation();
    setTrekZipBusyId(trek.id);
    try {
      const blob = await fetchTrekZipBlob(trek.id);
      downloadBlob(blob, `${slugBase(trek.name)}-etapes.zip`);
    } catch (err) {
      console.error(err);
      alert('Impossible de générer le ZIP du trek.');
    } finally {
      setTrekZipBusyId(null);
    }
  };

  const handleLogout = () => {
    clearStoredPin();
    setPin(null);
    setRoutes([]);
  };

  if (!pin) {
    return <PinPrompt onAuthenticated={(p) => setPin(p)} />;
  }

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

  Object.values(groupedRoutes.treks).forEach((trek) => {
    trek.routes.sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  const trekCumulativeTotals = (trekRoutes) => {
    let distanceKm = 0;
    let elevationGainM = 0;
    for (const r of trekRoutes) {
      distanceKm += Number(r.distance_km) || 0;
      elevationGainM += Number(r.elevation_gain_m) || 0;
    }
    return { distanceKm, elevationGainM };
  };

  return (
    <div className="saved-routes-container glass-panel">
      <div className="saved-routes-header">
        <h2>Itinéraires enregistrés</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{pin}</span>
          <button className="icon-btn small" onClick={handleLogout} title="Changer d'utilisateur">
            <LogOut size={16} />
          </button>
          <button className="icon-btn" onClick={onBack}>
            <X size={24} />
          </button>
        </div>
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
          {Object.values(groupedRoutes.treks).map((trek) => {
            const totals = trekCumulativeTotals(trek.routes);
            return (
            <div key={trek.id} className="trek-group">
              <div 
                className={`trek-folder glass-panel ${expandedTreks[trek.id] ? 'expanded' : ''}`}
                onClick={() => toggleTrek(trek.id)}
              >
                <div className="folder-content">
                  <Folder size={20} className="folder-icon" />
                  <div className="folder-info">
                    <h3>{trek.name}</h3>
                    <span className="folder-meta">
                      {trek.routes.length} étape{trek.routes.length > 1 ? 's' : ''}
                      {' · '}
                      Σ {totals.distanceKm.toFixed(1)} km
                      {' · '}
                      D+ cumul {Math.round(totals.elevationGainM)} m
                    </span>
                  </div>
                </div>
                <div className="folder-actions">
                  <button
                    type="button"
                    className="icon-btn small trek-export-btn"
                    disabled={trekZipBusyId === trek.id}
                    title="Télécharger toutes les étapes (ZIP de GPX)"
                    onClick={(e) => handleDownloadTrekZip(e, trek)}
                  >
                    <Archive size={18} />
                  </button>
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
                              {(Number(route.distance_km) || 0).toFixed(1)} km
                            </span>
                            <span className="meta-item">
                              +{Math.round(Number(route.elevation_gain_m) || 0)} m
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
            );
          })}

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
                      <strong>{(Number(route.distance_km) || 0).toFixed(1)} km</strong>
                    </span>
                    <span className="meta-item">
                      <strong>+{Math.round(Number(route.elevation_gain_m) || 0)} m</strong>
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
