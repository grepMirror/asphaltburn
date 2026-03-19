import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Heart, Clock, MapPin, Zap, TrendingUp } from 'lucide-react';

const ActivityCard = ({ activity }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  };

  const getPace = () => {
    const type = activity.activityType.typeKey;
    const distanceKm = activity.distance / 1000;
    const durationMin = activity.duration / 60;

    if (distanceKm === 0) return "-";

    if (type.includes('swim')) {
      // Pace in min/100m
      const pacePer100m = (activity.duration / (activity.distance / 100));
      const m = Math.floor(pacePer100m / 60);
      const s = Math.floor(pacePer100m % 60);
      return `${m}:${s.toString().padStart(2, '0')}/100m`;
    } else if (type.includes('run')) {
      // Pace in min/km
      const pacePerKm = durationMin / distanceKm;
      const m = Math.floor(pacePerKm);
      const s = Math.floor((pacePerKm - m) * 60);
      return `${m}:${s.toString().padStart(2, '0')}/km`;
    } else {
      // Speed in km/h
      return `${(distanceKm / (activity.duration / 3600)).toFixed(1)} km/h`;
    }
  };

  const activityDate = new Date(activity.startTimeLocal).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <div className={`activity-card glass-panel ${isExpanded ? 'expanded' : ''}`} onClick={() => setIsExpanded(!isExpanded)}>
      <div className="card-main">
        <div className="activity-type-icon">
             {/* Simple icons based on type */}
             <div className={`icon-wrapper ${activity.activityType.typeKey}`}>
                <Zap size={20} />
             </div>
        </div>
        
        <div className="activity-info">
          <div className="title-row">
            <h3>{activity.activityName || "Activité sans nom"}</h3>
            <span className="date">{activityDate}</span>
          </div>
          <div className="stats-row">
            <div className="mini-stat">
              <MapPin size={14} />
              <span>{(activity.distance / 1000).toFixed(2)} km</span>
            </div>
            <div className="mini-stat">
              <Clock size={14} />
              <span>{formatDuration(activity.duration)}</span>
            </div>
            <div className="mini-stat">
              <TrendingUp size={14} />
              <span>{getPace()}</span>
            </div>
          </div>
        </div>

        <div className="expand-trigger">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isExpanded && (
        <div className="card-details" onClick={(e) => e.stopPropagation()}>
          <div className="detail-grid">
            <div className="detail-item">
              <Heart size={18} className="heart-icon" />
              <div className="detail-content">
                <span className="label">Fréquence Cardiaque</span>
                <span className="value">{Math.round(activity.averageHR || 0)} <small>bpm moy</small> / {Math.round(activity.maxHR || 0)} <small>max</small></span>
              </div>
            </div>
            <div className="detail-item">
              <Zap size={18} className="energy-icon" />
              <div className="detail-content">
                <span className="label">Calories</span>
                <span className="value">{Math.round(activity.calories || 0)} <small>kcal</small></span>
              </div>
            </div>
            <div className="detail-item">
              <Clock size={18} className="time-icon" />
              <div className="detail-content">
                <span className="label">Zones FC (s)</span>
                <div className="hr-zones">
                    <span title="Zone 1">Z1: {Math.round(activity.hrTimeInZone_1 || 0)}s</span>
                    <span title="Zone 2">Z2: {Math.round(activity.hrTimeInZone_2 || 0)}s</span>
                    <span title="Zone 3">Z3: {Math.round(activity.hrTimeInZone_3 || 0)}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityCard;
