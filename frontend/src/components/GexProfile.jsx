import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="custom-tooltip">
      <div className="label">Strike: {Number(label).toLocaleString('en-US')}</div>
      <div className="value" style={{ color: value >= 0 ? '#00e676' : '#ff1744' }}>
        GEX: {value?.toFixed(4)} B$
      </div>
    </div>
  );
}

export default function GexProfile({ gexData }) {
  const [show0dte, setShow0dte] = useState(false);

  if (!gexData?.gex_by_strike?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot green" /> Gamma Exposure (GEX)</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando perfil de gamma...</span>
        </div>
      </div>
    );
  }

  let data = gexData.gex_by_strike.map((item) => ({
    strike: item.strike,
    gex: show0dte ? item.gex_0dte_billions : item.gex_billions,
  }));

  const spot = gexData.spot_price;
  let closestIdx = 0;
  let minDiff = Infinity;
  data.forEach((item, idx) => {
    const diff = Math.abs(item.strike - spot);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = idx;
    }
  });

  const startIdx = Math.max(0, closestIdx - 10);
  const endIdx = Math.min(data.length, closestIdx + 11);
  data = data.slice(startIdx, endIdx);

  return (
    <div className="card span-2 fade-in" id="gex-profile-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center' }}>
        <div><span className="dot green" /> Gamma Exposure (GEX) {show0dte ? '— 0DTE' : '— Total'}</div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setShow0dte(!show0dte)}
            style={{
              background: show0dte ? 'rgba(68,138,255,0.2)' : 'transparent',
              border: '1px solid rgba(68,138,255,0.3)',
              color: show0dte ? '#448aff' : 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)'
            }}
          >
            0DTE
          </button>
        </div>
      </div>
      <div className="chart-container" style={{ minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis
              dataKey="strike"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => v.toLocaleString('en-US')}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${v.toFixed(1)}B`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
            <ReferenceLine
              x={gexData.spot_price}
              stroke="#448aff"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{ value: 'Spot', position: 'top', fill: '#448aff', fontSize: 10 }}
            />
            <Bar dataKey="gex" radius={[2, 2, 0, 0]} maxBarSize={12}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.gex >= 0 ? '#00e676' : '#ff1744'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
