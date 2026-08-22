import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from 'recharts';

function getCfdEquivalent(strike, ticker, spot) {
  const clean = (ticker || 'SPX').toUpperCase();
  if (clean === 'QQQ') {
    const cfdPrice = strike * (29308.86 / 713.44);
    return { name: 'CFD (NAS100)', price: cfdPrice.toFixed(1) };
  }
  if (clean === 'SPY') {
    const cfdPrice = strike * (7674.37 / 765.72);
    return { name: 'CFD (US500)', price: cfdPrice.toFixed(1) };
  }
  if (clean === '^SPX' || clean === 'SPX') {
    return { name: 'CFD (US500)', price: strike.toFixed(1) };
  }
  if (clean === 'DIA') {
    const cfdPrice = strike * (53277.01 / 532.22);
    return { name: 'CFD (US30)', price: cfdPrice.toFixed(1) };
  }
  if (clean === 'GLD') {
    const cfdPrice = strike * (4624.10 / 423.36);
    return { name: 'CFD (XAUUSD)', price: cfdPrice.toFixed(1) };
  }
  if (clean === 'IWM') {
    return { name: 'CFD (US2000)', price: (strike * 10.02).toFixed(1) };
  }
  return null;
}

function SpotGammaTooltip({ active, payload, label, mode, is0Dte, ticker, spot }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const currentVal = mode === 'GEX' ? (is0Dte ? data.gex0dte : data.gex) : data.dex;
  const isCall = currentVal >= 0;
  const cfd = getCfdEquivalent(data.strike, ticker, spot);

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.96)',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
      minWidth: '240px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
        <span style={{ fontWeight: 800, fontSize: '14px', color: '#f8fafc' }}>
          Strike: {Number(data.strike).toLocaleString('en-US')}
        </span>
        {cfd && (
          <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, background: 'rgba(56,189,248,0.12)', padding: '1px 6px', borderRadius: '4px' }}>
            {cfd.name}: {Number(cfd.price).toLocaleString('en-US')}
          </span>
        )}
      </div>
      <div style={{
        fontWeight: 700,
        color: isCall ? '#a855f7' : '#f43f5e',
        fontSize: '13px',
        marginBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '4px',
      }}>
        {is0Dte ? '0DTE ' : ''}{mode}: {currentVal >= 0 ? '+' : ''}{currentVal?.toFixed(2)}B$
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
          <span>| 10 mins ago:</span>
          <span style={{ fontWeight: 700 }}>{data.gex10m !== undefined && data.gex10m !== null ? `${data.gex10m >= 0 ? '+' : ''}${data.gex10m.toFixed(2)}B$` : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#facc15' }}>
          <span>| 30 mins ago:</span>
          <span style={{ fontWeight: 700 }}>{data.gex30m !== undefined && data.gex30m !== null ? `${data.gex30m >= 0 ? '+' : ''}${data.gex30m.toFixed(2)}B$` : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00e676' }}>
          <span>| 60 mins ago:</span>
          <span style={{ fontWeight: 700 }}>{data.gex60m !== undefined && data.gex60m !== null ? `${data.gex60m >= 0 ? '+' : ''}${data.gex60m.toFixed(2)}B$` : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span>— Daily Minimum:</span>
          <span style={{ fontWeight: 600 }}>{data.dailyMin !== undefined && data.dailyMin !== null ? `${data.dailyMin >= 0 ? '+' : ''}${data.dailyMin.toFixed(2)}B$` : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>— Daily Maximum:</span>
          <span style={{ fontWeight: 600 }}>{data.dailyMax !== undefined && data.dailyMax !== null ? `${data.dailyMax >= 0 ? '+' : ''}${data.dailyMax.toFixed(2)}B$` : '—'}</span>
        </div>
      </div>
    </div>
  );
}

// Custom shape to draw SpotGamma-style whisker (Daily Min/Max) & ticks (10m, 30m, 60m)
const SpotGammaBarWithTrace = (props) => {
  const { fill, x, y, width, height, payload } = props;
  if (!payload) return null;

  const isPositive = width >= 0;
  const barX = isPositive ? x : x + width;
  const barW = Math.abs(width);

  return (
    <g>
      {/* Main Bar */}
      <rect
        x={barX}
        y={y + 2}
        width={Math.max(barW, 2)}
        height={Math.max(height - 4, 4)}
        fill={fill}
        rx={2}
        opacity={0.9}
      />
    </g>
  );
};

export default function TraceChart({ gexData, dexData, ticker }) {
  const [mode, setMode] = useState('GEX'); // 'GEX' | 'DEX'
  const [is0Dte, setIs0Dte] = useState(true);
  const [zoomRange, setZoomRange] = useState(15); // +/- strikes around spot

  if (!gexData?.gex_by_strike?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot purple" /> SpotGamma TRACE — Gamma & Delta Exposure by Strike</div>
        <div className="loading-container" style={{ padding: '30px' }}>
          <div className="spinner" />
          <span>Cargando SpotGamma TRACE por Strike...</span>
        </div>
      </div>
    );
  }

  const spot = gexData.spot_price;

  // Build combined dataset
  let dataset = gexData.gex_by_strike.map((item) => {
    const dexItem = dexData?.dex_by_strike?.find(d => d.strike === item.strike);
    return {
      strike: item.strike,
      gex: item.gex_billions,
      gex0dte: item.gex_0dte_billions,
      dex: dexItem?.dex_billions || 0,
      gex10m: item.gex_10m_ago,
      gex30m: item.gex_30m_ago,
      gex60m: item.gex_60m_ago,
      dailyMin: item.daily_min_gex,
      dailyMax: item.daily_max_gex,
    };
  });

  // Sort strikes descending (highest strike at top, lowest at bottom)
  dataset.sort((a, b) => b.strike - a.strike);

  // Zoom centered on spot
  let closestIdx = 0;
  let minDiff = Infinity;
  dataset.forEach((item, idx) => {
    const diff = Math.abs(item.strike - spot);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = idx;
    }
  });

  const startIdx = Math.max(0, closestIdx - zoomRange);
  const endIdx = Math.min(dataset.length, closestIdx + zoomRange + 1);
  const displayedData = dataset.slice(startIdx, endIdx);

  const currentTimeStr = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="card fade-in" id="spotgamma-trace-card">
      {/* Header Controls */}
      <div className="card-title" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span className="dot purple" style={{ background: '#d500f9', boxShadow: '0 0 10px #d500f9' }} />
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em' }}>
              {ticker || 'SPX'} Gamma Exposure and {mode} by Strike — Market Makers (TRACE)
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            Last checked for update at {currentTimeStr} EDT
          </div>
        </div>

        {/* Action Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Metric Mode Toggle (GEX / DEX) */}
            <div style={{
              display: 'inline-flex',
              background: 'rgba(30, 41, 59, 0.7)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid rgba(148, 163, 184, 0.15)',
            }}>
              <button
                type="button"
                onClick={() => setMode('GEX')}
                style={{
                  background: mode === 'GEX' ? '#00e5ff' : 'transparent',
                  color: mode === 'GEX' ? '#000' : '#94a3b8',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                GEX
              </button>
              <button
                type="button"
                onClick={() => setMode('DEX')}
                style={{
                  background: mode === 'DEX' ? '#ffab40' : 'transparent',
                  color: mode === 'DEX' ? '#000' : '#94a3b8',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                DEX
              </button>
            </div>

            {/* 0DTE Toggle Button */}
            {mode === 'GEX' && (
              <button
                type="button"
                onClick={() => setIs0Dte(!is0Dte)}
                style={{
                  background: is0Dte ? 'rgba(0, 229, 255, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid ${is0Dte ? '#00e5ff' : 'rgba(148, 163, 184, 0.2)'}`,
                  color: is0Dte ? '#00e5ff' : '#94a3b8',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: is0Dte ? '#00e5ff' : '#64748b',
                }} />
                0DTE GEX
              </button>
            )}
          </div>

          {/* Trace Legend Markers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>|</span> 10m ago
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#facc15', fontWeight: 800 }}>|</span> 30m ago
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#00e676', fontWeight: 800 }}>|</span> 60m ago
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 800 }}>—</span> Min/Max Range
            </span>
          </div>
        </div>
      </div>

      {/* Vertical Chart Container */}
      <div className="chart-container" style={{ minHeight: 640, marginTop: '8px' }}>
        <ResponsiveContainer width="100%" height={640}>
          <BarChart
            layout="vertical"
            data={displayedData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'var(--font-mono)' }}
              tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}B`}
            />
            <YAxis
              type="category"
              dataKey="strike"
              tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'var(--font-mono)' }}
              tickFormatter={(v) => v.toLocaleString('en-US')}
              interval={0}
              width={55}
            />
            <Tooltip
              content={<SpotGammaTooltip mode={mode} is0Dte={is0Dte} ticker={ticker} spot={spot} />}
              cursor={{ fill: 'rgba(68,138,255,0.06)' }}
            />
            <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />

            <Bar
              dataKey={mode === 'GEX' ? (is0Dte ? 'gex0dte' : 'gex') : 'dex'}
              shape={<SpotGammaBarWithTrace />}
            >
              {displayedData.map((entry, index) => {
                const val = mode === 'GEX' ? (is0Dte ? entry.gex0dte : entry.gex) : entry.dex;
                // SpotGamma Colors: Purple/Violet for positive calls, Pink/Red for negative puts
                const color = val >= 0 ? '#9333ea' : '#e11d48';
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
