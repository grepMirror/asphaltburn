import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ElevationChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  // Custom Tooltip to better match the app's premium feel
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="glass-panel" style={{ padding: '0.5rem 1rem', border: '1px solid rgba(0,0,0,0.05)', fontSize: '0.8rem' }}>
          <div style={{ fontWeight: '800', color: 'var(--primary)' }}>{point.distance} km</div>
          <div style={{ color: 'var(--text-secondary)' }}>Alt: <span style={{ fontWeight: '700', color: '#10b981' }}>{Math.round(point.elevation)}m</span></div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: 180, marginTop: '1rem', marginBottom: '1.5rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
          <XAxis 
            dataKey="distance" 
            label={{ value: 'km', position: 'insideBottomRight', offset: 0, fontSize: 10 }}
            tick={{ fontSize: 10 }}
            tickFormatter={(val) => Math.round(val)}
          />
          <YAxis 
            tick={{ fontSize: 10 }}
            domain={['dataMin - 20', 'dataMax + 20']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="elevation" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorElev)" 
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ElevationChart;
