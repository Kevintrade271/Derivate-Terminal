import { useMemo } from 'react';
import { Tooltip as RechartsTooltip } from 'recharts';

export default function GEXHeatmap({ heatmapData }) {
  if (!heatmapData?.cells?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot green" /> GEX Heatmap</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando heatmap de gamma...</span>
        </div>
      </div>
    );
  }

  const { strikes, expiries, cells, spot_price } = heatmapData;

  // Build a lookup map: `${strike}-${expiry}` -> gex
  const cellMap = useMemo(() => {
    const map = {};
    cells.forEach(c => {
      const key = `${c.strike}-${c.expiry_date}`;
      map[key] = (map[key] || 0) + c.gex_billions;
    });
    return map;
  }, [cells]);

  // Find max absolute value for color scaling
  const maxAbs = useMemo(() => {
    let m = 0;
    Object.values(cellMap).forEach(v => { m = Math.max(m, Math.abs(v)); });
    return m || 1;
  }, [cellMap]);

  // Color function
  const getColor = (value) => {
    if (value === 0) return 'rgba(30,30,30,0.8)';
    const intensity = Math.min(Math.abs(value) / maxAbs, 1);
    const alpha = 0.15 + intensity * 0.85;
    if (value > 0) {
      return `rgba(0, 230, 118, ${alpha})`;
    } else {
      return `rgba(255, 23, 68, ${alpha})`;
    }
  };

  // Limit strikes for readability
  const displayStrikes = strikes.length > 25
    ? strikes.filter((_, i) => i % Math.ceil(strikes.length / 25) === 0)
    : strikes;

  // Find closest strike to spot
  let closestStrike = displayStrikes[0];
  let minDiff = Infinity;
  displayStrikes.forEach(s => {
    const d = Math.abs(s - spot_price);
    if (d < minDiff) { minDiff = d; closestStrike = s; }
  });

  return (
    <div className="card span-2 fade-in" id="gex-heatmap-card">
      <div className="card-title">
        <span className="dot green" /> GEX Heatmap — Gamma por Strike × Expiración
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)',
          display: 'flex', gap: '12px', alignItems: 'center',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 12, height: 12, background: 'rgba(0,230,118,0.7)', borderRadius: 2, display: 'inline-block' }} />
            Gamma +
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 12, height: 12, background: 'rgba(255,23,68,0.7)', borderRadius: 2, display: 'inline-block' }} />
            Gamma −
          </span>
        </span>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '8px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '2px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)',
                position: 'sticky', left: 0, background: 'var(--bg-primary)', zIndex: 2,
              }}>
                Strike
              </th>
              {expiries.map(exp => (
                <th key={exp} style={{
                  padding: '6px 4px', textAlign: 'center', color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {exp.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...displayStrikes].reverse().map(strike => (
              <tr key={strike}>
                <td style={{
                  padding: '4px 8px', textAlign: 'right',
                  color: strike === closestStrike ? '#448aff' : 'var(--text-secondary)',
                  fontWeight: strike === closestStrike ? 700 : 400,
                  position: 'sticky', left: 0, background: 'var(--bg-primary)', zIndex: 1,
                  borderRight: '1px solid rgba(148,163,184,0.1)',
                }}>
                  {strike.toLocaleString('en-US')}
                  {strike === closestStrike && ' ◄'}
                </td>
                {expiries.map(exp => {
                  const key = `${strike}-${exp}`;
                  const val = cellMap[key] || 0;
                  return (
                    <td
                      key={key}
                      title={`Strike ${strike} | ${exp} | GEX: ${val.toFixed(4)}B`}
                      style={{
                        padding: '4px',
                        background: getColor(val),
                        textAlign: 'center',
                        color: Math.abs(val) > maxAbs * 0.4 ? '#fff' : 'var(--text-muted)',
                        borderRadius: '3px',
                        cursor: 'default',
                        minWidth: '48px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.target.style.outline = '1px solid rgba(255,255,255,0.3)'; }}
                      onMouseLeave={(e) => { e.target.style.outline = 'none'; }}
                    >
                      {val !== 0 ? val.toFixed(3) : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
