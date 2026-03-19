import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Activity, Clock, MapPin, Gauge, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import ActivityCard from './ActivityCard';

const TrainingPlanner = () => {
  const [allActivities, setAllActivities] = useState([]);
  const [filters, setFilters] = useState({ run: true, swim: true, bike: true });
  const [weekOffset, setWeekOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/garmin/activities');
      // Sort activities descending by start time
      const sorted = response.data.sort((a, b) => new Date(b.startTimeLocal) - new Date(a.startTimeLocal));
      setAllActivities(sorted);
    } catch (err) {
      console.error("Error fetching Garmin activities:", err);
      setError("Impossible de charger les activités Garmin.");
    } finally {
      setIsLoading(false);
    }
  };

  const getWeekRange = (offset) => {
    const today = new Date();
    // Move to Monday of current week
    const currentMonday = new Date(today);
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Adjust for Sunday (0)
    currentMonday.setDate(today.getDate() + diff);
    currentMonday.setHours(0, 0, 0, 0);

    const targetMonday = new Date(currentMonday);
    targetMonday.setDate(currentMonday.getDate() - (offset * 7));
    
    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);
    targetSunday.setHours(23, 59, 59, 999);

    return { start: targetMonday, end: targetSunday };
  };

  const isSportEnabled = (typeKey) => {
    if (typeKey.includes('run')) return filters.run;
    if (typeKey.includes('swim')) return filters.swim;
    if (typeKey.includes('cycl')) return filters.bike;
    return true; // Default for others
  };

  const getWeeklyStatsForOffset = (offset) => {
    const { start, end } = getWeekRange(offset);
    let distance = 0;
    let duration = 0;
    let counts = { running: 0, cycling: 0, swimming: 0 };

    const weekActivities = allActivities.filter(a => {
        const date = new Date(a.startTimeLocal);
        return date >= start && date <= end;
    });

    weekActivities.forEach(acc => {
      const isEnabled = isSportEnabled(acc.activityType.typeKey);
      if (!isEnabled) return;

      distance += (acc.distance || 0) / 1000;
      duration += acc.duration || 0;
      
      const type = acc.activityType.typeKey;
      if (type.includes('run')) counts.running++;
      else if (type.includes('cycl')) counts.cycling++;
      else if (type.includes('swim')) counts.swimming++;
    });

    return { distance, duration, counts, activities: weekActivities };
  };

  const getCurrentStats = () => {
    const current = getWeeklyStatsForOffset(weekOffset);
    const previous = getWeeklyStatsForOffset(weekOffset + 1);

    const distChange = previous.distance > 0 ? ((current.distance - previous.distance) / previous.distance) * 100 : 0;
    const durationChange = previous.duration > 0 ? ((current.duration - previous.duration) / previous.duration) * 100 : 0;

    return {
      ...current,
      distChange: distChange.toFixed(0),
      durationChange: durationChange.toFixed(0)
    };
  };

  const formatWeekRange = () => {
    const { start, end } = getWeekRange(weekOffset);
    const options = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('fr-FR', options)} - ${end.toLocaleDateString('fr-FR', options)}`;
  };

  if (isLoading && allActivities.length === 0) {
    return (
      <div className="planner-loading">
        <Loader2 className="animate-spin" size={48} />
        <p>Récupération de vos activités Garmin...</p>
      </div>
    );
  }

  const stats = getCurrentStats();
  // Filter current displayed activities by sport
  const filteredActivities = stats.activities.filter(a => isSportEnabled(a.activityType.typeKey));

  const PercentageTag = ({ change }) => {
    if (change == 0 || isNaN(change)) return null;
    const isPositive = parseFloat(change) > 0;
    return (
      <div className={`percent-tag ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{Math.abs(change)}%</span>
      </div>
    );
  };

  return (
    <div className="training-planner-container">
      <div className="planner-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Mon Entraînement</h1>
            <p className="subtitle">{weekOffset === 0 ? "Cette semaine" : formatWeekRange()}</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
            <div className="week-nav">
                <button className="icon-btn small" onClick={() => setWeekOffset(weekOffset + 1)} title="Semaine précédente">
                <ChevronLeft size={20} />
                </button>
                <button className="btn glass-panel" style={{ padding: '0.5rem 1rem' }} onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                Aujourd'hui
                </button>
                <button className="icon-btn small" onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))} title="Semaine suivante" disabled={weekOffset === 0}>
                <ChevronRight size={20} />
                </button>
            </div>

            <div className="sport-filters glass-panel">
                <label className="filter-item">
                    <input type="checkbox" checked={filters.run} onChange={() => setFilters({...filters, run: !filters.run})} />
                    <span>Run</span>
                </label>
                <label className="filter-item">
                    <input type="checkbox" checked={filters.bike} onChange={() => setFilters({...filters, bike: !filters.bike})} />
                    <span>Bike</span>
                </label>
                <label className="filter-item">
                    <input type="checkbox" checked={filters.swim} onChange={() => setFilters({...filters, swim: !filters.swim})} />
                    <span>Swim</span>
                </label>
            </div>
          </div>
        </div>
      </div>

      <div className="weekly-stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Activity size={24} /></div>
          <div className="stat-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="label">Distance Totale</span>
              <PercentageTag change={stats.distChange} />
            </div>
            <span className="value">{stats.distance.toFixed(1)} <small>km</small></span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="label">Temps Total</span>
              <PercentageTag change={stats.durationChange} />
            </div>
            <span className="value">{(stats.duration / 3600).toFixed(1)} <small>h</small></span>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon"><Gauge size={24} /></div>
          <div className="stat-info">
            <span className="label">Activités</span>
            <span className="value-summary">
              {stats.counts.running} Run • {stats.counts.cycling} Bike • {stats.counts.swimming} Swim
            </span>
          </div>
        </div>
      </div>

      <div className="activities-list">
        <h2>{weekOffset === 0 ? "Activités Récentes" : `Activités du ${formatWeekRange()}`}</h2>
        {filteredActivities.length > 0 ? (
          filteredActivities.map(acc => (
            <ActivityCard key={acc.activityId} activity={acc} />
          ))
        ) : (
          <p className="no-data">Aucune activité trouvée pour cette période avec ces filtres.</p>
        )}
      </div>
    </div>
  );
};

export default TrainingPlanner;
