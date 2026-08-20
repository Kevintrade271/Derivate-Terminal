import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">Strike: {Number(label).toLocaleString('en-US')}</div>
      {payload.map((entry, i) => (
        <div key={i} className="value" style={{ color: entry.color }}>
          {entry.name}: {Math.abs(entry.value)?.toFixed(4)} B$
        </div>
      ))}
    </div>
  );
}

export default function DexProfile({ dexData }) {
  if (!dexData?.dex_by_strike?.length) {
    return (
      <div className="card">
        <div className="card-title"><span className="dot amber" /> Delta Exposure (DEX)</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando perfil de delta...</span>
        </div>
      </div>
    );
  }

  let data = dexData.dex_by_strike.map((item) => ({
    strike: item.strike,
    Calls: item.call_dex_billions,
    Puts: item.put_dex_billions, // put_dex_billions is already negative from backend
  }));

  const spot = dexData.spot_price;
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
    <div className="card span-2 fade-in" id="dex-profile-card">
      <div className="card-title"><span className="dot amber" /> Delta Exposure (DEX)</div>
      <div className="chart-container" style={{ minHeight: 260 }}>
        <ResponsiveContainer width="100%" height={260}>
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
                return `${absV.toFixed(1)}B`;
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(68,138,255,0.06)' }} />
            <ReferenceLine
              x={dexData.spot_price}
              stroke="#ff1744"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Bar dataKey="Calls" stackId="a" fill="#00e5ff" fillOpacity={0.9} radius={[2, 2, 0, 0]} maxBarSize={10} />
            <Bar dataKey="Puts" stackId="a" fill="#ffab40" fillOpacity={0.9} radius={[0, 0, 2, 2]} maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
