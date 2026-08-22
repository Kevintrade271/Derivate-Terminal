import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">DTE: {label} días</div>
      {payload.map((entry, i) => (
        <div key={i} className="value" style={{ color: entry.color }}>
          {entry.name}: {(entry.value * 100).toFixed(2)}%
        </div>
      ))}
    </div>
  );
}

export default function IVTermStructure({ ivTermData }) {
  if (!ivTermData?.term_structure?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot amber" /> IV Term Structure</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando estructura temporal de IV...</span>
        </div>
      </div>
    );
  }

  const data = ivTermData.term_structure.map(p => ({
    dte: p.dte,
    atm_iv: p.atm_iv,
    expiry: p.expiry_date,
  }));

  // Determine if contango or backwardation
  const firstIV = data[0]?.atm_iv || 0;
  const lastIV = data[data.length - 1]?.atm_iv || 0;
  const structure = lastIV > firstIV ? 'CONTANGO' : 'BACKWARDATION';
  const structureColor = structure === 'CONTANGO' ? '#00e676' : '#ff1744';

  return (
    <div className="card span-2 fade-in" id="iv-term-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center' }}>
        <div><span className="dot amber" /> IV Term Structure — ATM IV por Expiración</div>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: structureColor,
          padding: '2px 8px',
          background: structure === 'CONTANGO' ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)',
          borderRadius: '4px',
        }}>
          {structure}
        </span>
      </div>
      <div className="chart-container" style={{ minHeight: 350 }}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="ivGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff9800" />
                <stop offset="100%" stopColor="#ffab40" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis
              dataKey="dte"
              tick={{ fontSize: 10, fill: '#64748b' }}
              label={{ value: 'DTE (días)', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              domain={['dataMin - 0.01', 'dataMax + 0.01']}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(68,138,255,0.3)' }} />
            <Line
              type="monotone"
              dataKey="atm_iv"
              name="ATM IV"
              stroke="url(#ivGradient)"
              strokeWidth={3}
              dot={{ fill: '#ff9800', r: 4, strokeWidth: 2, stroke: '#111' }}
              activeDot={{ r: 6, fill: '#ffab40', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
