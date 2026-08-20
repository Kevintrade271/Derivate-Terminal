import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';

function CustomTooltip({ active, payload, label, title }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">Strike: {Number(label).toLocaleString('en-US')}</div>
      <div className="label" style={{ marginTop: 4, fontWeight: 'bold' }}>{title}</div>
      {payload.map((entry, i) => (
        <div key={i} className="value" style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(4)} B$
        </div>
      ))}
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

  return (
    <div className="card span-2 fade-in" id="vanna-charm-profile-card">
      <div className="card-title"><span className="dot amber" /> Flujos de Dealers: Vanna & Charm (por Strike)</div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
        {/* Vanna Chart */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
            VANNA (Sensibilidad a la Volatilidad)
          </div>
          <div className="chart-container" style={{ minHeight: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('en-US')} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `${v.toFixed(1)}B`} />
                <Tooltip content={<CustomTooltip title="Vanna" />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
                <ReferenceLine x={spot} stroke="#ff1744" strokeDasharray="4 4" strokeWidth={1.5} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
                <Bar dataKey="vanna" name="Total Vanna" radius={[2, 2, 0, 0]} maxBarSize={10}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.vanna >= 0 ? '#b388ff' : '#7c4dff'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charm Chart */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
            CHARM (Sensibilidad al Tiempo)
          </div>
          <div className="chart-container" style={{ minHeight: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('en-US')} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `${v.toFixed(1)}B`} />
                <Tooltip content={<CustomTooltip title="Charm" />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
                <ReferenceLine x={spot} stroke="#ff1744" strokeDasharray="4 4" strokeWidth={1.5} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
                <Bar dataKey="charm" name="Total Charm" radius={[2, 2, 0, 0]} maxBarSize={10}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.charm >= 0 ? '#ff80ab' : '#f50057'} fillOpacity={0.8} />
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
