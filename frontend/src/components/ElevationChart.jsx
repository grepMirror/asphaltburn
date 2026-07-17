import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/** Unique integer km ticks (avoids 0 0 1 1 2 2 from rounding fractional distances). */
function buildKmTicks(maxDistance) {
  const maxKm = Math.max(0, Math.floor(maxDistance));
  const step = Math.max(1, Math.ceil((maxKm + 1) / 8));
  const ticks = [];
  for (let km = 0; km <= maxKm; km += step) {
    ticks.push(km);
  }
  if (ticks[ticks.length - 1] !== maxKm) {
    ticks.push(maxKm);
  }
  return ticks;
}

function toHoverPoint(raw) {
  if (!raw) return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    distance: Number(raw.distance) || 0,
    elevation: Number(raw.elevation) || 0,
  };
}

function nearestByDistance(data, targetDistance) {
  if (!data?.length || !Number.isFinite(targetDistance)) return null;
  let best = data[0];
  let bestDelta = Math.abs(Number(best.distance) - targetDistance);
  for (let i = 1; i < data.length; i++) {
    const delta = Math.abs(Number(data[i].distance) - targetDistance);
    if (delta < bestDelta) {
      best = data[i];
      bestDelta = delta;
    }
  }
  return best;
}

function pointFromChartState(state, data) {
  if (!state || !data?.length) return null;

  const fromPayload = state.activePayload?.[0]?.payload;
  if (fromPayload) return fromPayload;

  if (state.activeLabel != null) {
    return nearestByDistance(data, Number(state.activeLabel));
  }

  if (state.activeTooltipIndex != null && data[state.activeTooltipIndex]) {
    return data[state.activeTooltipIndex];
  }

  // Most reliable with type="number": invert chart X → distance km
  const xAxis = state.xAxisMap && Object.values(state.xAxisMap)[0];
  if (xAxis?.scale && typeof xAxis.scale.invert === 'function' && state.chartX != null) {
    const distance = xAxis.scale.invert(state.chartX);
    return nearestByDistance(data, distance);
  }

  return null;
}

const ElevationChart = ({ data, onHover }) => {
  if (!data || data.length === 0) return null;

  const maxDistance = data[data.length - 1]?.distance ?? 0;
  const kmTicks = buildKmTicks(maxDistance);

  const handleMouseMove = (state) => {
    const raw = pointFromChartState(state, data);
    const point = toHoverPoint(raw);
    if (point) onHover?.(point);
  };

  const handleMouseLeave = () => {
    onHover?.(null);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="glass-panel" style={{ padding: '0.5rem 1rem', border: '1px solid rgba(0,0,0,0.05)', fontSize: '0.8rem' }}>
          <div style={{ fontWeight: '800', color: 'var(--primary)' }}>{Number(point.distance).toFixed(1)} km</div>
          <div style={{ color: 'var(--text-secondary)' }}>Alt: <span style={{ fontWeight: '700', color: '#10b981' }}>{Math.round(point.elevation)}m</span></div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      style={{ width: '100%', height: 180, marginTop: '1rem', marginBottom: '1.5rem' }}
      onMouseLeave={handleMouseLeave}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
          <XAxis
            type="number"
            dataKey="distance"
            domain={[0, 'dataMax']}
            ticks={kmTicks}
            allowDecimals={false}
            label={{ value: 'km', position: 'insideBottomRight', offset: 0, fontSize: 10 }}
            tick={{ fontSize: 10 }}
            tickFormatter={(val) => Math.round(val)}
          />
          <YAxis 
            tick={{ fontSize: 10 }}
            domain={['dataMin - 20', 'dataMax + 20']}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area 
            type="monotone" 
            dataKey="elevation" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorElev)" 
            animationDuration={1000}
            activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ElevationChart;
