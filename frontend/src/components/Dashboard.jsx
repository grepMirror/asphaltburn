import React, { useState } from 'react';
import { Download, TrendingUp, Compass, ChevronUp, ChevronDown, Trash2, RotateCcw, Info, Clock } from 'lucide-react';

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

const Dashboard = ({ distance, elevation, elevationLoss, roadTypeSummary, onUndo, onReset, waypointsCount }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pace, setPace] = useState("6:30");

  const getPercentage = (dist) => {
    if (!distance || distance === 0) return 0;
    return (dist / distance) * 100;
  };

  const getEstimatedTime = () => {
    if (!distance || distance === 0) return "0h 00m";
    const [minStr, secStr] = pace.split(':');
    const mins = parseInt(minStr) || 0;
    const secs = parseInt(secStr) || 0;
    const totalPaceMins = mins + (secs / 60);
    
    const totalMins = distance * totalPaceMins;
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m`;
  };

  return (
    <div 
      className={`floating-dashboard glass-panel ${isExpanded ? 'expanded' : ''}`}
      onClick={() => {
          if (isExpanded) return; // Don't collapse immediately if already expanded
          setIsExpanded(true);
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1.2rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div className="stat-item">
            <div className="stat-label">
              <Compass size={12} style={{ marginRight: '4px' }} />
              Distance
            </div>
            <div className="stat-value">{distance} <span style={{ fontSize: '0.8rem' }}>km</span></div>
          </div>
          
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

          <div className="stat-item">
            <div className="stat-label">
              <Clock size={12} style={{ marginRight: '4px' }} />
              Temps
            </div>
            <div className="stat-value">{getEstimatedTime()}</div>
          </div>
          
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
          
          <div className="stat-item">
            <div className="stat-label">
              <TrendingUp size={12} style={{ marginRight: '4px', color: '#10b981' }} />
              D+
            </div>
            <div className="stat-value" style={{ color: '#10b981' }}>{elevation} <span style={{ fontSize: '0.8rem' }}>m</span></div>
          </div>

          <div className="stat-item">
            <div className="stat-label">
              <TrendingUp size={12} style={{ marginRight: '4px', color: '#ef4444', transform: 'rotate(180deg)' }} />
              D-
            </div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{elevationLoss} <span style={{ fontSize: '0.8rem' }}>m</span></div>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

          <button 
            className="btn" 
            onClick={(e) => { e.stopPropagation(); onUndo(); }}
            disabled={waypointsCount === 0}
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem'
            }}
          >
            <Trash2 size={14} /> Undo
          </button>
        </div>

        <div 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </div>
      </div>

      {/* Proportional Road Type Bar (Visible in both states) */}
      <div className="road-type-bar-container" style={{ marginTop: '1rem' }}>
        <div className="road-type-bar" style={{ 
          height: '8px', 
          width: '100%', 
          background: 'rgba(255,255,255,0.05)', 
          borderRadius: '4px',
          display: 'flex',
          overflow: 'hidden'
        }}>
          {Object.entries(roadTypeSummary || {}).map(([type, dist]) => (
            <div 
              key={type}
              title={`${type}: ${dist}km`}
              style={{
                width: `${getPercentage(dist)}%`,
                height: '100%',
                background: ROAD_TYPE_COLORS[type] || ROAD_TYPE_COLORS.Default,
                transition: 'width 0.3s ease'
              }}
            />
          ))}
        </div>
      </div>

      {isExpanded && (
        <div className="expanded-content" onClick={(e) => e.stopPropagation()}>
          <div className="stat-grid">
             <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={16} /> Détails du terrain
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(roadTypeSummary || {}).map(([type, dist]) => (
                    <div key={type} className="road-type-item" style={{ borderLeft: `4px solid ${ROAD_TYPE_COLORS[type] || ROAD_TYPE_COLORS.Default}` }}>
                      <span style={{ fontSize: '0.9rem' }}>{type}</span>
                      <span style={{ fontWeight: 'bold' }}>{dist} km ({Math.round(getPercentage(dist))}%)</span>
                    </div>
                  ))}
                  {Object.keys(roadTypeSummary || {}).length === 0 && (
                    <div className="road-type-item">Placez au moins deux points pour voir les détails...</div>
                  )}
                </div>
             </div>
              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Actions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Allure (min/km)</label>
                    <input 
                      type="text" 
                      value={pace} 
                      onChange={(e) => setPace(e.target.value)} 
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        color: 'white', 
                        padding: '0.4rem 0.8rem', 
                        borderRadius: '0.5rem',
                        fontSize: '0.9rem' 
                      }} 
                    />
                  </div>
                  {waypointsCount > 0 && (
                    <button className="btn" onClick={onReset} style={{ width: '100%', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', justifyContent: 'center' }}>
                      <RotateCcw size={18} /> Réinitialiser tout
                    </button>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
