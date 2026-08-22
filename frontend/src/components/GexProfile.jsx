import { useState } from 'react';
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';

function getCfdEquivalent(strike, spot) {
  if (!strike) return null;
  // If strike is in QQQ range (~500-800)
  if (strike >= 400 && strike <= 900) {
    const cfdPrice = strike * (29308.86 / 713.44);
    return { name: 'CFD (NAS100)', price: cfdPrice.toFixed(1) };
  }
  // If strike is in SPY range (~600-900)
  if (strike >= 600 && strike <= 1000) {
    const cfdPrice = strike * (7674.37 / 765.72);
    return { name: 'CFD (US500)', price: cfdPrice.toFixed(1) };
  }
  // If strike is in SPX range (~5000-10000)
  if (strike >= 5000 && strike <= 10000) {
    return { name: 'CFD (US500)', price: strike.toFixed(1) };
  }
  // If strike is in DIA range (~300-600)
  if (strike >= 300 && strike <= 600) {
    return { name: 'CFD (US30)', price: (strike * (53277.01 / 532.22)).toFixed(1) };
  }
  // If strike is in GLD range (~150-600)
  if (strike >= 150 && strike <= 600) {
    return { name: 'CFD (XAUUSD)', price: (strike * (4624.10 / 423.36)).toFixed(1) };
  }
  return null;
}

function CustomTooltip({ active, payload, label, showTrace, spot }) {
  if (!active || !payload?.length) return null;
  const currentItem = payload[0]?.payload;
  const cfd = getCfdEquivalent(Number(label), spot);

  return (
    <div className="custom-tooltip" style={{
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '6px',
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '11px',
      minWidth: '240px',
    }}>
      <div className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '6px' }}>
        <span style={{ fontWeight: 700, color: '#f8fafc' }}>Strike: {Number(label).toLocaleString('en-US')}</span>
        {cfd && (
          <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 600, background: 'rgba(56,189,248,0.12)', padding: '1px 6px', borderRadius: '4px' }}>
            {cfd.name}: {Number(cfd.price).toLocaleString('en-US')}
          </span>
        )}
      </div>

      {payload.map((entry, index) => {
        if (entry.dataKey === 'gexPos' && entry.value === 0) return null;
        if (entry.dataKey === 'gexNeg' && entry.value === 0) return null;
        
        let formattedValue = entry.value?.toFixed(3);
        if (entry.dataKey === 'callVol' || entry.dataKey === 'putVol') {
            formattedValue = entry.value?.toLocaleString('en-US', { maximumFractionDigits: 0 });
        } else {
            formattedValue += ' B$';
        }
        
        return (
          <div key={index} className="value" style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
            <span>{entry.name}:</span>
            <span style={{ fontWeight: 700 }}>{formattedValue}</span>
          </div>
        );
      })}

      {/* SpotGamma Strike TRACE Section */}
      {showTrace && currentItem && (
        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '10px', color: '#d500f9', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.05em' }}>
            • SPOTGAMMA STRIKE TRACE:
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', fontSize: '10px' }}>
            <span>| 10 mins ago:</span>
            <span style={{ fontWeight: 600 }}>{currentItem.gex10m !== undefined && currentItem.gex10m !== null ? `${currentItem.gex10m.toFixed(3)} B$` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#facc15', fontSize: '10px' }}>
            <span>| 30 mins ago:</span>
            <span style={{ fontWeight: 600 }}>{currentItem.gex30m !== undefined && currentItem.gex30m !== null ? `${currentItem.gex30m.toFixed(3)} B$` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00e676', fontSize: '10px' }}>
            <span>| 60 mins ago:</span>
            <span style={{ fontWeight: 600 }}>{currentItem.gex60m !== undefined && currentItem.gex60m !== null ? `${currentItem.gex60m.toFixed(3)} B$` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '10px', marginTop: '3px' }}>
            <span>— Daily Min:</span>
            <span style={{ fontWeight: 600 }}>{currentItem.dailyMin !== undefined && currentItem.dailyMin !== null ? `${currentItem.dailyMin.toFixed(3)} B$` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '10px' }}>
            <span>— Daily Max:</span>
            <span style={{ fontWeight: 600 }}>{currentItem.dailyMax !== undefined && currentItem.dailyMax !== null ? `${currentItem.dailyMax.toFixed(3)} B$` : '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GexProfile({ gexData }) {
  const [show0dte, setShow0dte] = useState(false);
  const [showTrace, setShowTrace] = useState(true);
  const [showNetGexPos, setShowNetGexPos] = useState(true);
  const [showNetGexNeg, setShowNetGexNeg] = useState(true);
  const [showAbsGamma, setShowAbsGamma] = useState(true);
  const [showCallVol, setShowCallVol] = useState(false);
  const [showPutVol, setShowPutVol] = useState(false);

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

  let data = gexData.gex_by_strike.map((item) => {
    const gex = show0dte ? item.gex_0dte_billions : item.gex_billions;
    return {
      strike: item.strike,
      gexPos: gex >= 0 ? gex : 0,
      gexNeg: gex < 0 ? gex : 0,
      absGamma: item.absolute_gamma,
      callVol: item.call_volume,
      putVol: item.put_volume,
      gex10m: item.gex_10m_ago,
      gex30m: item.gex_30m_ago,
      gex60m: item.gex_60m_ago,
      dailyMin: item.daily_min_gex,
      dailyMax: item.daily_max_gex,
    };
  });

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
      <div className="card-title" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div><span className="dot green" /> QTP — GEX por Strike (±5% del spot)</div>
          
          {/* Segmented 0DTE Switch */}
          <div style={{
            display: 'inline-flex',
            background: 'rgba(15, 23, 42, 0.7)',
            borderRadius: '6px',
            padding: '2px',
            border: '1px solid rgba(148, 163, 184, 0.15)',
          }}>
            <button
              type="button"
              onClick={() => setShow0dte(false)}
              style={{
                background: !show0dte ? '#00e5ff' : 'transparent',
                color: !show0dte ? '#0f172a' : '#94a3b8',
                border: 'none',
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              TOTAL GEX
            </button>
            <button
              type="button"
              onClick={() => setShow0dte(true)}
              style={{
                background: show0dte ? '#00e5ff' : 'transparent',
                color: show0dte ? '#0f172a' : '#94a3b8',
                border: 'none',
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              0DTE ONLY
            </button>
          </div>
        </div>
        
        {/* Modern Chip Pills for Series Toggles */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Net GEX (+)', active: showNetGexPos, toggle: () => setShowNetGexPos(!showNetGexPos), color: '#38bdf8', icon: '■' },
            { label: 'Net GEX (-)', active: showNetGexNeg, toggle: () => setShowNetGexNeg(!showNetGexNeg), color: '#f43f5e', icon: '■' },
            { label: 'Strike TRACE', active: showTrace, toggle: () => setShowTrace(!showTrace), color: '#d500f9', icon: '✦' },
            { label: 'Abs Gamma', active: showAbsGamma, toggle: () => setShowAbsGamma(!showAbsGamma), color: '#a855f7', icon: '▲' },
            { label: 'Call Vol', active: showCallVol, toggle: () => setShowCallVol(!showCallVol), color: '#00e676', icon: '●' },
            { label: 'Put Vol', active: showPutVol, toggle: () => setShowPutVol(!showPutVol), color: '#fb923c', icon: '●' },
          ].map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={pill.toggle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: pill.active ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.5)',
                border: `1px solid ${pill.active ? pill.color : 'rgba(148, 163, 184, 0.15)'}`,
                color: pill.active ? '#f8fafc' : '#64748b',
                boxShadow: pill.active ? `0 0 10px ${pill.color}22` : 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ color: pill.active ? pill.color : '#64748b', fontSize: '10px' }}>{pill.icon}</span>
              {pill.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="chart-container" style={{ minHeight: 500 }}>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis
              dataKey="strike"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => v.toLocaleString('en-US')}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${v.toFixed(1)}B`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => (v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v)}
            />
            <Tooltip content={<CustomTooltip showTrace={showTrace} />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
            <ReferenceLine
              yAxisId="left"
              x={gexData.spot_price}
              stroke="#448aff"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{ value: `Spot ${gexData.spot_price}`, position: 'top', fill: '#448aff', fontSize: 10 }}
            />
            
            {showAbsGamma && (
              <Area yAxisId="left" type="monotone" dataKey="absGamma" name="Absolute Gamma" fill="#7c4dff" stroke="#7c4dff" fillOpacity={0.2} strokeWidth={2} />
            )}
            
            {showCallVol && (
              <Area yAxisId="right" type="monotone" dataKey="callVol" name="Call Volume" fill="#00e676" stroke="#00e676" fillOpacity={0.15} strokeWidth={1} />
            )}
            
            {showPutVol && (
              <Area yAxisId="right" type="monotone" dataKey="putVol" name="Put Volume" fill="#ff9800" stroke="#ff9800" fillOpacity={0.15} strokeWidth={1} />
            )}
            
            {showNetGexPos && (
              <Bar yAxisId="left" dataKey="gexPos" name="Net GEX (+)" fill="#448aff" radius={[2, 2, 0, 0]} maxBarSize={12} fillOpacity={0.85} />
            )}
            
            {showNetGexNeg && (
              <Bar yAxisId="left" dataKey="gexNeg" name="Net GEX (-)" fill="#ff1744" radius={[0, 0, 2, 2]} maxBarSize={12} fillOpacity={0.85} />
            )}

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
