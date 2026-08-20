import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="custom-tooltip">
      <div className="label">Expiración: {label}</div>
      <div className="value" style={{ color: value >= 0 ? '#00e676' : '#ff1744' }}>
        GEX: {value?.toFixed(4)} B$
      </div>
    </div>
  );
}

export default function GexTermStructure({ termData }) {
  if (!termData?.term_structure?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot amber" /> GEX Term Structure</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando estructura temporal...</span>
        </div>
      </div>
    );
  }

  const data = termData.term_structure.map((item) => ({
    expiry: item.expiry_date.substring(5), // Show MM-DD
    gex: item.total_gex_billions,
  }));

  return (
    <div className="card span-2 fade-in" id="gex-term-card">
      <div className="card-title"><span className="dot amber" /> Estructura Temporal del GEX por Expiración</div>
      <div className="chart-container" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis
              dataKey="expiry"
              tick={{ fontSize: 10, fill: '#64748b' }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${v.toFixed(1)}B`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" />
            <Bar dataKey="gex" radius={[2, 2, 0, 0]} maxBarSize={20}>
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
