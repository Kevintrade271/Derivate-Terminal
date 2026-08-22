import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const STORAGE_KEY = 'pcr_history';
const MAX_POINTS = 100; // Keep last 100 readings

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  let status = 'NEUTRAL';
  let color = '#ffab40';
  if (val > 1.2) { status = 'BEARISH EXTREME'; color = '#ff1744'; }
  else if (val < 0.8) { status = 'BULLISH EXTREME'; color = '#00e676'; }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.96)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '8px',
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '12px',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: '4px', fontSize: '11px' }}>
        Hora: {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontWeight: 700 }}>
        <span style={{ color: '#f8fafc' }}>Put/Call Ratio:</span>
        <span style={{ color: color }}>{val?.toFixed(3)}</span>
      </div>
      <div style={{ fontSize: '10px', color: color, fontWeight: 700, marginTop: '4px' }}>
        {status}
      </div>
    </div>
  );
}

export default function PCRatioHistory({ oiData }) {
  const [history, setHistory] = useState([]);
  const lastRatioRef = useRef(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Add new point when ratio changes
  useEffect(() => {
    if (!oiData?.put_call_ratio) return;
    const ratio = oiData.put_call_ratio;

    if (lastRatioRef.current === ratio) return;
    lastRatioRef.current = ratio;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    setHistory(prev => {
      const newHistory = [
        ...prev,
        { time: timeStr, ratio, timestamp: now.getTime() },
      ].slice(-MAX_POINTS);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      } catch {
        // localStorage full, ignore
      }

      return newHistory;
    });
  }, [oiData?.put_call_ratio]);

  const currentRatio = oiData?.put_call_ratio;
  const avgRatio = history.length > 0
    ? history.reduce((s, h) => s + h.ratio, 0) / history.length
    : currentRatio;

  // Sentiment determination
  let sentiment = 'NEUTRAL';
  let sentimentColor = '#ffab40';
  let badgeBg = 'rgba(255, 171, 64, 0.12)';
  if (currentRatio > 1.2) {
    sentiment = 'BEARISH SENTIMENT (HIGH PUT DEMAND)';
    sentimentColor = '#ff1744';
    badgeBg = 'rgba(255, 23, 68, 0.12)';
  } else if (currentRatio < 0.8) {
    sentiment = 'BULLISH SENTIMENT (HIGH CALL DEMAND)';
    sentimentColor = '#00e676';
    badgeBg = 'rgba(0, 230, 118, 0.12)';
  }

  if (!currentRatio) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot red" /> Put/Call Ratio History</div>
        <div className="loading-container" style={{ padding: '24px' }}>
          <div className="spinner" />
          <span>Cargando histórico P/C Ratio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card span-2 fade-in" id="pcr-history-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="dot red" style={{ background: '#ff1744', boxShadow: '0 0 8px #ff1744' }} />
          <span style={{ fontSize: '13px', fontWeight: 700 }}>PUT/CALL RATIO HISTORY — SENTIMIENTO INSTITUCIONAL</span>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setHistory([]);
          }}
          style={{
            background: 'transparent',
            border: '1px solid rgba(148,163,184,0.2)',
            color: 'var(--text-muted)',
            padding: '3px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.15s ease',
          }}
        >
          Reset Timeline
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'rgba(15, 23, 42, 0.5)',
        borderRadius: '8px',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
            P/C RATIO ACTUAL
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 800,
            color: sentimentColor,
            lineHeight: 1.1,
            marginTop: '2px',
          }}>
            {currentRatio.toFixed(3)}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '20px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
            PROMEDIO SESIÓN
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700,
            color: 'var(--text-secondary)',
            marginTop: '2px',
          }}>
            {avgRatio?.toFixed(3)}
          </div>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: sentimentColor,
            padding: '6px 14px',
            background: badgeBg,
            border: `1px solid ${sentimentColor}33`,
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}>
            {sentiment}
          </div>
        </div>
      </div>

      {/* Enlarged Chart */}
      {history.length > 1 ? (
        <div className="chart-container" style={{ minHeight: 260 }}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="pcrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff1744" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ff1744" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'var(--font-mono)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'var(--font-mono)' }}
                domain={['dataMin - 0.05', 'dataMax + 0.05']}
                tickFormatter={(v) => v.toFixed(2)}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={1.0}
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="4 4"
                label={{ value: '1.0 Neutral', fill: '#94a3b8', fontSize: 10, position: 'right' }}
              />
              <ReferenceLine
                y={1.2}
                stroke="rgba(255,23,68,0.3)"
                strokeDasharray="3 3"
                label={{ value: '1.2 High Put Demand', fill: '#ff1744', fontSize: 9, position: 'right' }}
              />
              <ReferenceLine
                y={0.8}
                stroke="rgba(0,230,118,0.3)"
                strokeDasharray="3 3"
                label={{ value: '0.8 High Call Demand', fill: '#00e676', fontSize: 9, position: 'right' }}
              />
              <Area
                type="monotone"
                dataKey="ratio"
                stroke="#ff1744"
                strokeWidth={2.5}
                fill="url(#pcrGradient)"
                dot={false}
                activeDot={{ r: 5, fill: '#ff1744', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 12,
        }}>
          El gráfico del Put/Call Ratio se traza en tiempo real acumulando las lecturas intradiarias.
        </div>
      )}
    </div>
  );
}
