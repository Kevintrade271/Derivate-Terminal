import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';

function getCfdEquivalent(strike) {
  if (!strike) return null;
  if (strike >= 400 && strike <= 900) {
    return { name: 'CFD (NAS100)', price: (strike * (29308.86 / 713.44)).toFixed(1) };
  }
  if (strike >= 600 && strike <= 1000) {
    return { name: 'CFD (US500)', price: (strike * (7674.37 / 765.72)).toFixed(1) };
  }
  if (strike >= 5000 && strike <= 10000) {
    return { name: 'CFD (US500)', price: strike.toFixed(1) };
  }
  if (strike >= 300 && strike <= 600) {
    return { name: 'CFD (US30)', price: (strike * (53277.01 / 532.22)).toFixed(1) };
  }
  if (strike >= 150 && strike <= 600) {
    return { name: 'CFD (XAUUSD)', price: (strike * (4624.10 / 423.36)).toFixed(1) };
  }
  return null;
}

function CustomTooltip({ active, payload, label, title }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const strikeNum = Number(label);
  const cfd = getCfdEquivalent(strikeNum);
  const isPositive = val >= 0;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.96)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '8px',
      padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '12px',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
        <span style={{ color: '#94a3b8' }}>Strike:</span>
        <span style={{ fontWeight: 800 }}>{strikeNum.toLocaleString('en-US')}</span>
      </div>
      {cfd && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#38bdf8' }}>{cfd.name}:</span>
          <span style={{ fontWeight: 700, color: '#38bdf8' }}>{cfd.price}</span>
        </div>
      )}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: '#94a3b8' }}>{title}:</span>
          <span style={{ fontWeight: 800, color: isPositive ? '#00e676' : '#ff1744' }}>
            {isPositive ? '+' : ''}{val?.toFixed(4)} B$
          </span>
        </div>
        {title === 'Vanna' && (
          <div style={{ fontSize: '10px', marginTop: '4px', color: isPositive ? '#00e676' : '#ff1744', fontWeight: 600 }}>
            {isPositive 
              ? '⚡ Vanna Positivo: Compra forzada de dealers si la IV cae' 
              : '⚠️ Vanna Negativo: Venta forzada de dealers si la IV sube'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VannaCharmProfile({ vcData }) {
  if (!vcData?.profiles?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot amber" /> Vanna & Charm</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando Griegos de 2do orden...</span>
        </div>
      </div>
    );
  }

  const spot = vcData.spot_price;
  let closestIdx = 0;
  let minDiff = Infinity;
  vcData.profiles.forEach((item, idx) => {
    const diff = Math.abs(item.strike - spot);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = idx;
    }
  });

  const startIdx = Math.max(0, closestIdx - 15);
  const endIdx = Math.min(vcData.profiles.length, closestIdx + 16);
  const data = vcData.profiles.slice(startIdx, endIdx).map(item => ({
    ...item,
    vanna: item.vanna_billions,
    charm: item.charm_billions,
  }));

  // Calculate Vanna Walls
  let maxVanna = -Infinity;
  let minVanna = Infinity;
  let vannaWallPos = null;
  let vannaWallNeg = null;

  data.forEach((d) => {
    if (d.vanna > maxVanna) {
      maxVanna = d.vanna;
      vannaWallPos = d.strike;
    }
    if (d.vanna < minVanna) {
      minVanna = d.vanna;
      vannaWallNeg = d.strike;
    }
  });

  const cfdPos = getCfdEquivalent(vannaWallPos);
  const cfdNeg = getCfdEquivalent(vannaWallNeg);

  return (
    <div className="card span-2 fade-in" id="vanna-charm-profile-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="dot amber" style={{ background: '#ffb300', boxShadow: '0 0 8px #ffb300' }} />
          <span style={{ fontSize: '13px', fontWeight: 700 }}>FLUJOS DE DEALERS: VANNA & CHARM (POR STRIKE)</span>
        </div>

        {/* Vanna Wall Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {vannaWallPos && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(0, 230, 118, 0.12)',
              border: '1px solid rgba(0, 230, 118, 0.3)',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ color: '#00e676', fontWeight: 700 }}>🛡️ VANNA WALL (+):</span>
              <span style={{ color: '#fff', fontWeight: 800 }}>{vannaWallPos}</span>
              {cfdPos && <span style={{ color: '#38bdf8' }}>({cfdPos.price})</span>}
            </div>
          )}

          {vannaWallNeg && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(255, 23, 68, 0.12)',
              border: '1px solid rgba(255, 23, 68, 0.3)',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ color: '#ff1744', fontWeight: 700 }}>⚠️ RESISTENCIA VANNA (-):</span>
              <span style={{ color: '#fff', fontWeight: 800 }}>{vannaWallNeg}</span>
              {cfdNeg && <span style={{ color: '#38bdf8' }}>({cfdNeg.price})</span>}
            </div>
          )}
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
        {/* Vanna Chart */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
              VANNA (Sensibilidad a la Volatilidad)
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#00e676' }}>▲ (+) Flujo Comprador</span>
              <span style={{ color: '#ff1744' }}>▼ (-) Flujo Vendedor</span>
            </div>
          </div>
          <div className="chart-container" style={{ minHeight: 350 }}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('en-US')} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `${v.toFixed(1)}B`} />
                <Tooltip content={<CustomTooltip title="Vanna" />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
                <ReferenceLine x={spot} stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'SPOT', fill: '#38bdf8', fontSize: 9, position: 'top' }} />
                {vannaWallPos && (
                  <ReferenceLine x={vannaWallPos} stroke="#00e676" strokeDasharray="3 3" strokeWidth={1.2} />
                )}
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Bar dataKey="vanna" name="Total Vanna" radius={[2, 2, 0, 0]} maxBarSize={12}>
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.vanna >= 0 ? '#00e676' : '#ff1744'} 
                      fillOpacity={0.85} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charm Chart */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
              CHARM (Decaimiento Temporal de Delta)
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#00e5ff' }}>▲ (+) Delta Positiva</span>
              <span style={{ color: '#ff9100' }}>▼ (-) Delta Negativa</span>
            </div>
          </div>
          <div className="chart-container" style={{ minHeight: 350 }}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('en-US')} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `${v.toFixed(1)}B`} />
                <Tooltip content={<CustomTooltip title="Charm" />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
                <ReferenceLine x={spot} stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'SPOT', fill: '#38bdf8', fontSize: 9, position: 'top' }} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Bar dataKey="charm" name="Total Charm" radius={[2, 2, 0, 0]} maxBarSize={12}>
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.charm >= 0 ? '#00e5ff' : '#ff9100'} 
                      fillOpacity={0.85} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
