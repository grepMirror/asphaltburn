import React, { useState } from 'react';
import { Download, TrendingUp, Compass, ChevronUp, ChevronDown, Trash2, RotateCcw, Info, Clock, X, Save, Folder } from 'lucide-react';
import ElevationChart from './ElevationChart';

const ROAD_TYPE_COLORS = {
  "Route": "#0040a1",
  "Chemin / Sentier": "#10b981",
  "Chemin empierré": "#059669",
  "Piste Cyclable": "#8b5cf6",
  "Escaliers": "#f43f5e",
  "Autoroute": "#ef4444",
  "Autre": "#64748b",
  "Default": "#0040a1"
};

const Dashboard = ({ distance, elevation, elevationLoss, elevationProfile, roadTypeSummary, onUndo, onReset, onSave, waypointsCount, isMobile, isOpen, onOpen, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pace, setPace] = useState("6:30");

  const getPercentage = (dist) => {
    if (!distance || distance === 0) return 0;
    return (dist / distance) * 100;
  };

  const getEstimatedTime = () => {
    if (!distance || distance === 0) return "0:00";
    const [minStr, secStr] = pace.split(':');
    const mins = parseInt(minStr) || 0;
    const secs = parseInt(secStr) || 0;
    const totalPaceMins = mins + (secs / 60);
    
    const totalMins = distance * totalPaceMins;
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Mobile "Peek" handle
  if (isMobile && !isOpen) {
    return (
      <div 
        className="floating-dashboard glass-panel mobile-peek"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        style={{ 
          maxWidth: 'calc(100vw - 2rem)', 
          margin: '0 auto',
          flexDirection: 'column', 
          padding: '0.3rem 1rem 0.5rem',
          minWidth: 'unset' 
        }}
      >
        <div className="dashboard-handle" style={{ marginBottom: '0.3rem', width: '30px', height: '3px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', width: '100%' }}>
          <div className="mini-stat" style={{ gap: '0.3rem' }}>
            <Compass size={14} className="text-primary" />
            <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>{distance} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>km</span></span>
          </div>
          <div className="mini-stat" style={{ gap: '0.3rem' }}>
            <Clock size={14} className="text-primary" />
            <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>{getEstimatedTime()}</span>
          </div>
          <div className="mini-stat" style={{ gap: '0.3rem' }}>
            <TrendingUp size={14} style={{ color: '#10b981' }} />
            <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#10b981' }}>{elevation} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>m</span></span>
          </div>
        </div>
      </div>
    );
  }

  const classNames = [
    'floating-dashboard',
    'glass-panel',
    isMobile ? 'mobile-overlay' : '',
    !isMobile && isExpanded ? 'expanded' : '',
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={classNames}
      onClick={(e) => {
        e.stopPropagation();
        if (!isMobile && !isExpanded) setIsExpanded(true);
      }}
      style={{ 
        width: !isMobile && isExpanded ? '400px' : (!isMobile ? '450px' : undefined),
        left: !isMobile && isExpanded ? '1rem' : '50%',
        transform: !isMobile && isExpanded ? 'none' : 'translateX(-50%)',
        bottom: (!isMobile && isExpanded) || isMobile ? '1rem' : '1.5rem',
        maxHeight: !isMobile && isExpanded ? 'calc(100vh - 2rem)' : undefined,
        overflowY: !isMobile && isExpanded ? 'auto' : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: !isMobile && !isExpanded ? '0.6rem 2rem' : undefined,
        maxWidth: isMobile ? '100vw' : 'calc(100vw - 2rem)',
        gap: 0
      }}
    >
      <div className="dashboard-handle" onClick={(e) => { e.stopPropagation(); if (isMobile) onClose(); else setIsExpanded(!isExpanded); }} / >
      
      {(isMobile || isExpanded) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.5rem', flexShrink: 0 }}>
          <div>
            <h3 className="font-headline" style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Résumé</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Parcours optimisé • {distance} km</span>
          </div>
          <button className="btn glass-panel icon-btn small" onClick={(e) => { e.stopPropagation(); isMobile ? onClose() : setIsExpanded(false); }} style={{ background: '#f8fafc', border: 'none' }}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="stat-grid" style={{ 
        display: 'flex',
        flexDirection: (isExpanded || isMobile) ? 'column' : 'row',
        justifyContent: 'center',
        gap: (isExpanded || isMobile) ? '0.75rem' : '2rem',
        marginBottom: (isExpanded || isMobile) ? '1rem' : '0',
        flexShrink: 0
      }}>
        <div className="stat-item" style={{ 
          background: (isExpanded || isMobile) ? '#f8fafc' : 'transparent', 
          padding: (isExpanded || isMobile) ? '0.5rem 1rem' : '0', 
          borderRadius: '1rem', 
          border: (isExpanded || isMobile) ? '1px solid rgba(0,0,0,0.02)' : 'none',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <Compass size={18} className="text-primary" />
          { (isExpanded || isMobile) && <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Distance</span> }
          <div className="stat-value" style={{ fontSize: '1rem' }}>{distance} <span style={{ fontSize: '0.7rem' }}>km</span></div>
        </div>

        <div className="stat-item" style={{ 
          background: (isExpanded || isMobile) ? '#f8fafc' : 'transparent', 
          padding: (isExpanded || isMobile) ? '0.5rem 1rem' : '0', 
          borderRadius: '1rem', 
          border: (isExpanded || isMobile) ? '1px solid rgba(0,0,0,0.02)' : 'none',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <Clock size={16} className="text-primary" />
          { (isExpanded || isMobile) && <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Temps</span> }
          <div className="stat-value" style={{ fontSize: '1rem' }}>{getEstimatedTime()}h</div>
        </div>

        <div className="stat-item" style={{ 
          background: (isExpanded || isMobile) ? '#f8fafc' : 'transparent', 
          padding: (isExpanded || isMobile) ? '0.5rem 1rem' : '0', 
          borderRadius: '1rem', 
          border: (isExpanded || isMobile) ? '1px solid rgba(0,0,0,0.02)' : 'none',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <TrendingUp size={18} style={{ color: '#10b981' }} />
          { (isExpanded || isMobile) && <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Gain D+</span> }
          <div className="stat-value" style={{ color: '#10b981', fontSize: '1rem' }}>{elevation} <span style={{ fontSize: '0.7rem' }}>m</span></div>
        </div>

        {(isExpanded || isMobile) && (
          <div className="stat-item" style={{ background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '1rem', border: '1px solid rgba(0,0,0,0.02)', flexDirection: 'row', alignItems: 'center', gap: '0.6rem' }}>
            <TrendingUp size={18} style={{ color: '#ef4444', transform: 'rotate(180deg)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pertes D-</span>
            <div className="stat-value" style={{ color: '#ef4444', fontSize: '1rem' }}>{elevationLoss} <span style={{ fontSize: '0.7rem' }}>m</span></div>
          </div>
        )}
      </div>

      {(isExpanded || isMobile) && (
        <>
          <div className="road-type-bar" style={{ height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '99px', display: 'flex', overflow: 'hidden', marginBottom: '1.5rem', flexShrink: 0, marginTop: '1.5rem' }}>
            {Object.entries(roadTypeSummary || {}).map(([type, dist]) => (
              <div 
                key={type}
                style={{
                  width: `${getPercentage(dist)}%`,
                  height: '100%',
                  background: ROAD_TYPE_COLORS[type] || ROAD_TYPE_COLORS.Default,
                  transition: 'all 0.4s'
                }}
              />
            ))}
          </div>

          <div className="expanded-content" style={{ opacity: 1, animation: 'none', paddingBottom: isMobile ? '4rem' : '1rem' }}>
            <div className="stat-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 className="font-headline" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Profil de dénivelé (X: km, Y: m)</h4>
                <ElevationChart data={elevationProfile} />
              </div>
              <div>
                <h4 className="font-headline" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Profil de surface</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(roadTypeSummary || {}).map(([type, dist]) => (
                    <div key={type} className="road-type-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROAD_TYPE_COLORS[type] || ROAD_TYPE_COLORS.Default }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{type}</span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>{dist} km</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h4 className="font-headline" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Paramètres</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Allure:</span>
                    <input 
                      type="text" 
                      value={pace} 
                      onChange={(e) => setPace(e.target.value)} 
                      style={{ background: 'transparent', border: 'none', fontWeight: '800', color: 'var(--primary)', width: '60px', outline: 'none' }} 
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.5 }}>min/km</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={waypointsCount < 2} style={{ width: '100%', background: 'var(--primary)', color: 'white', borderRadius: '1rem', border: 'none', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Save size={16} /> Enregistrer
                  </button>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); onReset(); }} disabled={waypointsCount === 0} style={{ width: '100%', background: '#fee2e2', color: '#ba1a1a', borderRadius: '1rem', border: 'none', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trash2 size={16} /> Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
