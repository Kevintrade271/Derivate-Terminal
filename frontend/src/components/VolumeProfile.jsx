import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">Strike: {Number(label).toLocaleString('en-US')}</div>
      {payload.map((entry, i) => (
        <div key={i} className="value" style={{ color: entry.color }}>
          {entry.name}: {Math.abs(entry.value)?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </div>
      ))}
    </div>
  );
}

export default function VolumeProfile({ gexData }) {
  if (!gexData?.gex_by_strike?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot blue" /> Volume Profile</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando volumen...</span>
        </div>
      </div>
    );
  }

  const spot = gexData.spot_price;

  // Filter data around spot and prepare
  let data = gexData.gex_by_strike
    .filter(item => item.call_volume > 0 || item.put_volume > 0)
    .map(item => ({
      strike: item.strike,
      callVol: item.call_volume,
      putVol: -item.put_volume, // Negative for mirrored display
    }));

  // Center around spot
  let closestIdx = 0;
  let minDiff = Infinity;
  data.forEach((item, idx) => {
    const diff = Math.abs(item.strike - spot);
    if (diff < minDiff) { minDiff = diff; closestIdx = idx; }
  });
  const startIdx = Math.max(0, closestIdx - 15);
  const endIdx = Math.min(data.length, closestIdx + 16);
  data = data.slice(startIdx, endIdx);

  const totalCall = data.reduce((s, d) => s + d.callVol, 0);
  const totalPut = data.reduce((s, d) => s + Math.abs(d.putVol), 0);
  const cvRatio = totalPut > 0 ? (totalCall / totalPut).toFixed(2) : '∞';

  return (
    <div className="card span-2 fade-in" id="volume-profile-card">
      <div className="card-title">
        <span className="dot blue" /> Volume Profile — Call vs Put Volume por Strike
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-secondary)',
        }}>
          C/P Vol: {cvRatio}
        </span>
      </div>
      <div className="chart-container" style={{ minHeight: 400 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} layout="horizontal">
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
            <ReferenceLine
              x={spot}
              stroke="#448aff"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: 'Spot', position: 'top', fill: '#448aff', fontSize: 10 }}
            />
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.15)" />
            <Bar dataKey="callVol" name="Call Volume" fill="#00e676" fillOpacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={10} />
            <Bar dataKey="putVol" name="Put Volume" fill="#ff7043" fillOpacity={0.8} radius={[0, 0, 2, 2]} maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
