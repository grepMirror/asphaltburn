import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { Loader2, ArrowLeft, HeartPulse, BarChart2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const DAY_OPTIONS = [
  { value: 30, label: '30 j' },
  { value: 56, label: '8 sem.' },
  { value: 84, label: '12 sem.' },
];

const AcwrChartsPage = ({ onBack }) => {
  const [filters, setFilters] = useState({ run: true, swim: true, bike: true });
  const [days, setDays] = useState(56);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSeries = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/garmin/acwr/series`, {
          params: {
            days,
            run: filters.run,
            bike: filters.bike,
            swim: filters.swim,
          },
        });
        setPayload(response.data);
      } catch (err) {
        console.error('ACWR series:', err);
        setError(err.response?.data?.detail || err.message || 'Erreur');
        setPayload(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSeries();
  }, [days, filters.run, filters.bike, filters.swim]);

  const chartData = useMemo(() => {
    if (!payload?.series) return [];
    return payload.series.map((row) => ({
      ...row,
      labelShort: new Date(row.date + 'T12:00:00').toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      }),
    }));
  }, [payload]);

  const bands = payload?.interpretationBands || {
    sweetSpotMin: 0.8,
    sweetSpotMax: 1.3,
    spikeRiskMin: 1.5,
  };

  const yMax = useMemo(() => {
    let m = 2;
    chartData.forEach((r) => {
      if (r.zoneAcwr != null) m = Math.max(m, r.zoneAcwr);
      if (r.garminAcwr != null) m = Math.max(m, r.garminAcwr);
    });
    return Math.min(4, Math.max(2, m * 1.15));
  }, [chartData]);

  const bandArea = (
    <>
      <ReferenceArea
        y1={bands.sweetSpotMin}
        y2={bands.sweetSpotMax}
        fill="var(--acwr-band-fill, rgba(34, 197, 94, 0.18))"
        strokeOpacity={0}
      />
      <ReferenceLine
        y={bands.spikeRiskMin}
        stroke="rgba(249, 115, 22, 0.65)"
        strokeDasharray="6 4"
        label={{
          value: `Seuil pic ~${bands.spikeRiskMin}`,
          position: 'insideTopRight',
          fill: 'rgba(249, 115, 22, 0.9)',
          fontSize: 11,
        }}
      />
    </>
  );

  return (
    <div className="acwr-charts-page training-planner-container">
      <div className="planner-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            width: '100%',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            {onBack && (
              <button type="button" className="icon-btn small" onClick={onBack} title="Retour">
                <ArrowLeft size={22} />
              </button>
            )}
            <div>
              <h1>ACWR — évolution</h1>
              <p className="subtitle">
                Ratio aigu / chronique (7j vs 28j÷4). La zone verte indique la plage souvent visée (~
                {bands.sweetSpotMin}–{bands.sweetSpotMax}).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
            <div className="glass-panel" style={{ padding: '0.35rem 0.5rem', display: 'flex', gap: '0.25rem' }}>
              {DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="btn"
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.85rem',
                    opacity: days === opt.value ? 1 : 0.75,
                  }}
                  onClick={() => setDays(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="sport-filters glass-panel">
              <label className="filter-item">
                <input
                  type="checkbox"
                  checked={filters.run}
                  onChange={() => setFilters({ ...filters, run: !filters.run })}
                />
                <span>Run</span>
              </label>
              <label className="filter-item">
                <input
                  type="checkbox"
                  checked={filters.bike}
                  onChange={() => setFilters({ ...filters, bike: !filters.bike })}
                />
                <span>Bike</span>
              </label>
              <label className="filter-item">
                <input
                  type="checkbox"
                  checked={filters.swim}
                  onChange={() => setFilters({ ...filters, swim: !filters.swim })}
                />
                <span>Swim</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="planner-loading" style={{ minHeight: 200 }}>
          <Loader2 className="animate-spin" size={40} />
          <p>Calcul des courbes ACWR…</p>
        </div>
      )}

      {error && !loading && (
        <div className="glass-panel" style={{ padding: '1rem', color: 'var(--danger, #f87171)', marginBottom: '1rem' }}>
          {typeof error === 'string' ? error : 'Erreur'}
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <>
          <div className="acwr-chart-card glass-panel">
            <div className="acwr-chart-title">
              <HeartPulse size={20} />
              <span>Charge zones FC (pondération Z1–Z5)</span>
            </div>
            <div className="acwr-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis
                    domain={[0, yMax]}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'ACWR', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => (v != null ? Number(v).toFixed(3) : '—')}
                    labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ''}
                  />
                  <Legend />
                  {bandArea}
                  <Line
                    type="monotone"
                    dataKey="zoneAcwr"
                    name="ACWR zones"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="acwr-chart-card glass-panel">
            <div className="acwr-chart-title">
              <BarChart2 size={20} />
              <span>Garmin — activityTrainingLoad (comparaison)</span>
            </div>
            <div className="acwr-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis
                    domain={[0, yMax]}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'ACWR', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => (v != null ? Number(v).toFixed(3) : '—')}
                    labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ''}
                  />
                  <Legend />
                  {bandArea}
                  <Line
                    type="monotone"
                    dataKey="garminAcwr"
                    name="ACWR Garmin"
                    stroke="#c026d3"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="acwr-footnote">
            Info : valeurs indicatives (littérature · risque blessure). Les trous peuvent correspondre à une charge
            chronique nulle ou à l’absence de training load Garmin sur les séances.
          </p>
        </>
      )}

      {!loading && !error && chartData.length === 0 && (
        <p className="no-data">Aucune donnée sur cette période.</p>
      )}
    </div>
  );
};

export default AcwrChartsPage;
