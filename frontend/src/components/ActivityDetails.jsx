import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, Copy, Heart, Clock, Zap, Target, Activity as ActivityIcon, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../config';

const ActivityDetails = ({ activity, onBack }) => {
  const [details, setDetails] = useState(null);
  const [splits, setSplits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null); // String: 'json', 'llm', or null
  const [llmSummary, setLlmSummary] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/garmin/activities/${activity.activityId}/details`);
        setDetails(response.data.details);
        setSplits(response.data.splits);
        setLlmSummary(response.data.llmSummary);
      } catch (err) {
        console.error("Error fetching activity details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [activity.activityId]);

  const copyToClipboard = (text, type) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
      });
    } else {
      // Fallback for non-secure contexts (HTTP local network on mobile)
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error('Fallback: Unable to copy', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleCopyJSON = () => {
    const dataToCopy = llmSummary ? llmSummary.lapDTOs : splits;
    copyToClipboard(JSON.stringify(dataToCopy, null, 2), 'json');
  };

  const handleCopyLLMText = () => {
    if (llmSummary?.textSummary) {
        copyToClipboard(llmSummary.textSummary, 'llm');
    }
  };

  const hrZones = [
    { zone: '1', time: activity.hrTimeInZone_1 || 0, color: '#9ca3af' },
    { zone: '2', time: activity.hrTimeInZone_2 || 0, color: '#3b82f6' },
    { zone: '3', time: activity.hrTimeInZone_3 || 0, color: '#10b981' },
    { zone: '4', time: activity.hrTimeInZone_4 || 0, color: '#f59e0b' },
    { zone: '5', time: activity.hrTimeInZone_5 || 0, color: '#ef4444' }
  ];

  const totalHRTime = hrZones.reduce((acc, curr) => acc + curr.time, 0);

  // Elevation data processing
  let elevationData = [];
  if (details && details.metricDescriptors && details.activityDetailMetrics) {
    const elevIndex = details.metricDescriptors.findIndex(m => m.key === 'elevation' || m.key === 'directElevation');
    const distIndex = details.metricDescriptors.findIndex(m => m.key === 'distance' || m.key === 'sumDistance');
    
    if (elevIndex !== -1 && distIndex !== -1) {
      elevationData = details.activityDetailMetrics.map(m => {
        // Find correct metric value if array is present
        const elevationVal = m.metrics[elevIndex];
        const distanceVal = m.metrics[distIndex];
        return {
          distance: distanceVal !== null ? (distanceVal / 1000).toFixed(2) : 0,
          elevation: elevationVal !== null ? elevationVal : null
        };
      }).filter(m => m.elevation !== null);
    }
  }

  // Splits parsing
  const renderSplits = () => {
    // Garmin sometimes returns splits directly as an array, or nested in lapDTOs
    const laps = Array.isArray(splits) ? splits : (splits?.lapDTOs || []);
    
    if (!laps || laps.length === 0) {
      return (
        <div style={{ wordBreak: 'break-all', fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '0.5rem' }}>
          <p className="text-secondary font-bold mb-2">Aucun intervalle trouvé. DEBUG RAW JSON:</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#f87171' }}>{JSON.stringify(splits, null, 2)}</pre>
        </div>
      );
    }

    return (
      <div className="splits-table-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3>Intervalles</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {llmSummary && (
                <button className="btn small" onClick={handleCopyLLMText} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <Zap size={14} /> {copied === 'llm' ? "Prêt pour LLM !" : "Copy for LLM"}
                </button>
            )}
            <button className="btn small" onClick={handleCopyJSON} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)' }}>
                <Copy size={14} /> {copied === 'json' ? "Copié !" : (llmSummary ? "Clean JSON" : "JSON")}
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
            <table className="splits-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '500px' }}>
            <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-secondary)' }}>Intervalle</th>
                <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-secondary)' }}>Temps</th>
                <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-secondary)' }}>Distance</th>
                <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-secondary)' }}>Allure</th>
                <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-secondary)' }}>FC Moy.</th>
                </tr>
            </thead>
            <tbody>
                {laps.map((lap, index) => {
                const lapDur = lap.duration || 0;
                const lapDist = lap.distance || 0;
                const durMins = Math.floor(lapDur / 60);
                const durSecs = Math.floor(lapDur % 60);
                const distKm = lapDist / 1000;
                const distDist = distKm.toFixed(2);
                
                // Avoid division by zero
                const paceMinsFull = distKm > 0 ? (lapDur / 60) / distKm : 0;
                const paceMins = Math.floor(paceMinsFull);
                const paceSecs = Math.floor((paceMinsFull - paceMins) * 60);
                
                return (
                    <tr key={lap.lapIndex || index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.8rem 0.5rem' }}>{index + 1}</td>
                    <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold' }}>{`${durMins}:${durSecs.toString().padStart(2, '0')}`}</td>
                    <td style={{ padding: '0.8rem 0.5rem' }}>{distDist} km</td>
                    <td style={{ padding: '0.8rem 0.5rem' }}>{distKm === 0 ? "-" : `${paceMins}:${paceSecs.toString().padStart(2, '0')}`}</td>
                    <td style={{ padding: '0.8rem 0.5rem' }}>{Math.round(lap.averageHR || 0)}</td>
                    </tr>
                )
                })}
            </tbody>
            </table>
        </div>
      </div>
    );
  };

  return (
    <div className="activity-details-view animate-fade-in" style={{ padding: '1rem', maxHeight: 'calc(100vh - 60px)', overflowY: 'auto', paddingBottom: '3rem' }}>
      <button className="btn glass-panel" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.5rem 1rem' }}>
        <ChevronLeft size={18} /> Retour
      </button>

      <div className="detail-header glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{activity.activityName || "Activité sans nom"}</h2>
        <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={16} /> {Math.floor(activity.duration / 60)} min</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Target size={16} /> {(activity.distance ? activity.distance / 1000 : 0).toFixed(2)} km</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Heart size={16} /> {Math.round(activity.averageHR || 0)} bpm moy</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981' }}><TrendingUp size={16} /> D+ {Math.round(activity.elevationGain || 0)}m</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444' }}><TrendingUp size={16} style={{transform: 'rotate(180deg)'}} /> D- {Math.round(activity.elevationLoss || 0)}m</span>
        </div>
      </div>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* HR Zones */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Heart size={18} color="#ef4444" /> Zones de Fréquence Cardiaque
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {hrZones.map(h => {
              const perc = totalHRTime > 0 ? ((h.time / totalHRTime) * 100).toFixed(1) : 0;
              return (
                <div key={h.zone} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ width: '30px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Z{h.zone}</span>
                  <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${perc}%`, height: '100%', background: h.color, transition: 'width 1s ease-out' }}></div>
                  </div>
                  <span style={{ width: '50px', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold' }}>{perc}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Elevation Graph */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ActivityIcon size={18} color="#10b981" /> Élévation
          </h3>
          {loading ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="text-secondary">Chargement...</p>
            </div>
          ) : elevationData.length > 0 ? (
            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={elevationData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="distance" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', backdropFilter: 'blur(4px)' }}
                    itemStyle={{ color: '#10b981' }}
                    labelFormatter={(label) => `${label} km`}
                  />
                  <Area type="monotone" dataKey="elevation" stroke="#10b981" strokeWidth={2} fillOpacity={0.2} fill="#10b981" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="text-secondary">Aucune donnée d'élévation.</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
        {loading ? (
            <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="text-secondary">Chargement des intervalles...</p>
            </div>
        ) : renderSplits()}
      </div>

    </div>
  );
};

export default ActivityDetails;
