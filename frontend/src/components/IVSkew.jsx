import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">Strike: {Number(label).toLocaleString('en-US')}</div>
      {payload.map((entry, i) => (
        <div key={i} className="value" style={{ color: entry.color }}>
          {entry.name}: {(entry.value * 100)?.toFixed(1)}%
        </div>
      ))}
    </div>
  );
}

export default function IVSkew({ ivData, spotPrice }) {
  if (!ivData?.iv_points?.length) {
    return (
      <div className="card">
        <div className="card-title"><span className="dot amber" /> IV Skew</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando IV Skew...</span>
        </div>
      </div>
    );
  }

  const data = ivData.iv_points
    .filter((p) => p.call_iv || p.put_iv)
    .map((p) => ({
      strike: p.strike,
      'Call IV': p.call_iv,
      'Put IV': p.put_iv,
    }));

  return (
    <div className="card fade-in" id="iv-skew-card">
      <div className="card-title">
        <span className="dot amber" /> IV Skew
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          Exp: {ivData.expiry_date}
        </span>
      </div>
      <div className="chart-container" style={{ minHeight: 400 }}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis
              dataKey="strike"
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickFormatter={(v) => v.toLocaleString('en-US')}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            {spotPrice && (
              <ReferenceLine
                x={spotPrice}
                stroke="#448aff"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            <Line
              type="monotone"
              dataKey="Call IV"
              stroke="#00e676"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#00e676' }}
            />
            <Line
              type="monotone"
              dataKey="Put IV"
              stroke="#ff1744"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#ff1744' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
