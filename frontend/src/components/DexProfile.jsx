import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';

function CustomTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null;
  const isChange = mode === 'change';

  return (
    <div className="custom-tooltip" style={{
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '6px',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '11px',
    }}>
      <div className="label" style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
        Strike: {Number(label).toLocaleString('en-US')}
      </div>
      {payload.map((entry, i) => {
        const val = Number(entry.value);
        return (
          <div key={i} className="value" style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span>{entry.name}:</span>
            <span style={{ fontWeight: 700 }}>
              {isChange ? (val >= 0 ? `+${(val * 1000).toFixed(1)} M$` : `-${Math.abs(val * 1000).toFixed(1)} M$`) : `${Math.abs(val).toFixed(4)} B$`}
            </span>
          </div>
        );
      })}
      {isChange && payload[0]?.payload?.action && (
        <div style={{
          marginTop: '6px',
          paddingTop: '4px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          color: payload[0].payload.action === 'BUYING' ? '#00e676' : '#ff5252',
          fontWeight: 700,
        }}>
          Acción MM: {payload[0].payload.action === 'BUYING' ? '🟢 COMPRANDO (Short Covering)' : '🔴 VENDIENDO (Delta Hedging)'}
        </div>
      )}
    </div>
  );
}

export default function DexProfile({ dexData, dexChangeData }) {
  const [mode, setMode] = useState('total'); // 'total' | 'change'

  if (!dexData?.dex_by_strike?.length) {
    return (
      <div className="card">
        <div className="card-title"><span className="dot amber" /> Delta Exposure (DEX)</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando perfil de delta...</span>
        </div>
      </div>
    );
  }

  const spot = dexData.spot_price;

  // Prepare Total DEX data
  let totalData = dexData.dex_by_strike.map((item) => ({
    strike: item.strike,
    Calls: item.call_dex_billions,
    Puts: item.put_dex_billions,
  }));

  // Prepare Delta Change data
  let changeData = (dexChangeData?.delta_change_by_strike || []).map((item) => ({
    strike: item.strike,
    'Delta Flow': item.delta_change_billions,
    action: item.action,
  }));

  const activeDataset = mode === 'total' ? totalData : (changeData.length > 0 ? changeData : totalData);

  // Zoom to +/- 15 strikes around spot
  let closestIdx = 0;
  let minDiff = Infinity;
  activeDataset.forEach((item, idx) => {
    const diff = Math.abs(item.strike - spot);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = idx;
    }
  });

  const startIdx = Math.max(0, closestIdx - 15);
  const endIdx = Math.min(activeDataset.length, closestIdx + 16);
  const displayedData = activeDataset.slice(startIdx, endIdx);

  const netFlow = dexChangeData?.net_delta_flow_billions || 0;
  const isNetBuying = netFlow >= 0;

  return (
    <div className="card span-2 fade-in" id="dex-profile-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="dot amber" />
          <span>{mode === 'total' ? 'Delta Exposure (DEX) — Posicionamiento Consolidado' : 'Δ-DEX / Delta Flow — Flujo Dinámico de Cobertura'}</span>
        </div>

        {/* Toggle Mode Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {mode === 'change' && dexChangeData && (
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: isNetBuying ? '#00e676' : '#ff5252',
              background: isNetBuying ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              marginRight: '6px',
            }}>
              {isNetBuying ? `▲ +${(netFlow * 1000).toFixed(0)}M$ COMPRA` : `▼ -${Math.abs(netFlow * 1000).toFixed(0)}M$ VENTA`}
            </span>
          )}

          <div style={{
            display: 'inline-flex',
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '6px',
            padding: '2px',
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }}>
            <button
              type="button"
              onClick={() => setMode('total')}
              style={{
                background: mode === 'total' ? '#2563eb' : 'transparent',
                color: mode === 'total' ? '#fff' : '#94a3b8',
                border: 'none',
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Total DEX
            </button>
            <button
              type="button"
              onClick={() => setMode('change')}
              style={{
                background: mode === 'change' ? '#2563eb' : 'transparent',
                color: mode === 'change' ? '#fff' : '#94a3b8',
                border: 'none',
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Δ-Change (Flow)
            </button>
          </div>
        </div>
      </div>

      <div className="chart-container" style={{ minHeight: 400 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={displayedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis
              dataKey="strike"
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickFormatter={(v) => v.toLocaleString('en-US')}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickFormatter={(v) => {
                const absV = Math.abs(v);
                return mode === 'change' ? `${(absV * 1000).toFixed(0)}M` : `${absV.toFixed(1)}B`;
              }}
            />
            <Tooltip content={<CustomTooltip mode={mode} />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
            <ReferenceLine
              x={spot}
              stroke="#ff1744"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            {mode === 'total' ? (
              <>
                <Bar dataKey="Calls" stackId="a" fill="#00e5ff" fillOpacity={0.9} radius={[2, 2, 0, 0]} maxBarSize={12} />
                <Bar dataKey="Puts" stackId="a" fill="#ffab40" fillOpacity={0.9} radius={[0, 0, 2, 2]} maxBarSize={12} />
              </>
            ) : (
              <Bar dataKey="Delta Flow" maxBarSize={12} radius={[2, 2, 2, 2]}>
                {displayedData.map((entry, index) => {
                  const val = entry['Delta Flow'] || 0;
                  const barColor = val >= 0 ? '#00e676' : '#ff5252';
                  return <Cell key={`cell-${index}`} fill={barColor} fillOpacity={0.85} />;
                })}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
