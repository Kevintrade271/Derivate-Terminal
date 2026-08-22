import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">Strike: {Number(label).toLocaleString('en-US')}</div>
      {payload.map((entry, i) => (
        <div key={i} className="value" style={{ color: entry.color }}>
          {entry.name}: {Math.abs(entry.value)?.toLocaleString('en-US')}
        </div>
      ))}
    </div>
  );
}

export default function OIChart({ oiData }) {
  if (!oiData?.oi_by_strike?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot blue" /> Open Interest</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando Open Interest...</span>
        </div>
      </div>
    );
  }

  let data = oiData.oi_by_strike.map((item) => ({
    strike: item.strike,
    Calls: item.call_oi,
    Puts: -item.put_oi,
  }));

  const spot = oiData.spot_price;
  let closestIdx = 0;
  let minDiff = Infinity;
  data.forEach((item, idx) => {
    const diff = Math.abs(item.strike - spot);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = idx;
    }
  });

  const startIdx = Math.max(0, closestIdx - 15);
  const endIdx = Math.min(data.length, closestIdx + 16);
  data = data.slice(startIdx, endIdx);

  return (
    <div className="card span-2 fade-in" id="oi-chart-card">
      <div className="card-title">
        <span className="dot blue" /> Open Interest — Calls vs Puts
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
          P/C Ratio: {oiData.put_call_ratio?.toFixed(2)}
        </span>
      </div>
      <div className="chart-container" style={{ minHeight: 400 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                return absV >= 1000 ? `${(absV / 1000).toFixed(0)}K` : absV;
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
            />
            <ReferenceLine
              x={oiData.spot_price}
              stroke="#ff1744"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Bar dataKey="Calls" stackId="a" fill="#448aff" fillOpacity={0.9} radius={[2, 2, 0, 0]} maxBarSize={10} />
            <Bar dataKey="Puts" stackId="a" fill="#ff7043" fillOpacity={0.9} radius={[0, 0, 2, 2]} maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
