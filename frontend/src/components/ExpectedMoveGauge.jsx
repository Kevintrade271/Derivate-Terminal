import { useMemo } from 'react';

export default function ExpectedMoveGauge({ ivData, spotData }) {
  const { expectedMove, currentMove, percentUsed, isWithin } = useMemo(() => {
    if (!ivData?.iv_points?.length || !spotData?.price || !spotData?.candles?.length) {
      return { expectedMove: null, currentMove: null, percentUsed: 0, isWithin: true };
    }

    const spot = spotData.price;

    // Find ATM IV
    let atmPoint = ivData.iv_points[0];
    let minDiff = Infinity;
    ivData.iv_points.forEach(p => {
      const diff = Math.abs(p.strike - spot);
      if (diff < minDiff) { minDiff = diff; atmPoint = p; }
    });

    const atmIv = atmPoint.call_iv || atmPoint.put_iv;
    if (!atmIv) return { expectedMove: null, currentMove: null, percentUsed: 0, isWithin: true };

    // Daily expected move: Spot * IV / sqrt(252)
    const em = spot * (atmIv / Math.sqrt(252));

    // Today's session open
    let todayOpen = spotData.today_open;
    if (!todayOpen || todayOpen <= 0) {
      const lastCandle = spotData.candles[spotData.candles.length - 1];
      if (typeof lastCandle?.time === 'number') {
        const lastDateStr = new Date(lastCandle.time * 1000).toDateString();
        const todayFirst = spotData.candles.find(c => new Date(c.time * 1000).toDateString() === lastDateStr);
        todayOpen = todayFirst?.open || spot;
      } else {
        todayOpen = spotData.candles[0]?.open || spot;
      }
    }

    const move = spot - todayOpen;
    const absMove = Math.abs(move);
    const pct = Math.min((absMove / em) * 100, 150);

    return {
      expectedMove: em,
      currentMove: move,
      percentUsed: pct,
      isWithin: absMove <= em,
    };
  }, [ivData, spotData]);

  if (expectedMove === null) {
    return (
      <div className="card">
        <div className="card-title"><span className="dot blue" /> Expected Move</div>
        <div className="loading-container" style={{ padding: '24px' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const spot = spotData.price;
  const upperEM = spot + expectedMove - currentMove;
  const lowerEM = spot - expectedMove - currentMove;

  // Arc gauge parameters
  const cx = 140, cy = 130, r = 100;
  const startAngle = Math.PI;
  const endAngle = 0;
  const arcLength = Math.PI;

  // Current position on arc (0-150% mapped to 0-PI)
  const currentAngle = startAngle - (percentUsed / 150) * arcLength;
  const needleX = cx + r * Math.cos(currentAngle);
  const needleY = cy - r * Math.sin(currentAngle);

  // Arc path helper
  const arcPath = (startA, endA, radius) => {
    const x1 = cx + radius * Math.cos(startA);
    const y1 = cy - radius * Math.sin(startA);
    const x2 = cx + radius * Math.cos(endA);
    const y2 = cy - radius * Math.sin(endA);
    const largeArc = Math.abs(startA - endA) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`;
  };

  // Color zones: 0-66% green, 66-100% yellow, 100-150% red
  const greenEnd = startAngle - (66 / 150) * arcLength;
  const yellowEnd = startAngle - (100 / 150) * arcLength;

  const needleColor = percentUsed <= 66 ? '#00e676' : percentUsed <= 100 ? '#ffab40' : '#ff1744';

  return (
    <div className="card fade-in" id="expected-move-card">
      <div className="card-title"><span className="dot blue" /> Expected Move (±1σ)</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
        <svg width="280" height="160" viewBox="0 0 280 160">
          {/* Background arc */}
          <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="16" strokeLinecap="round" />

          {/* Green zone: 0-66% */}
          <path d={arcPath(startAngle, greenEnd, r)} fill="none" stroke="rgba(0,230,118,0.3)" strokeWidth="16" strokeLinecap="round" />

          {/* Yellow zone: 66-100% */}
          <path d={arcPath(greenEnd, yellowEnd, r)} fill="none" stroke="rgba(255,171,64,0.3)" strokeWidth="16" strokeLinecap="round" />

          {/* Red zone: 100-150% */}
          <path d={arcPath(yellowEnd, endAngle, r)} fill="none" stroke="rgba(255,23,68,0.3)" strokeWidth="16" strokeLinecap="round" />

          {/* Active arc */}
          <path d={arcPath(startAngle, currentAngle, r)} fill="none" stroke={needleColor} strokeWidth="16" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${needleColor})` }} />

          {/* Needle dot */}
          <circle cx={needleX} cy={needleY} r="6" fill={needleColor} stroke="#111" strokeWidth="2" style={{ filter: `drop-shadow(0 0 8px ${needleColor})` }} />

          {/* Center label */}
          <text x={cx} y={cy - 15} textAnchor="middle" fill={needleColor} fontSize="28" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
            {percentUsed.toFixed(0)}%
          </text>
          <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="'Inter', sans-serif">
            del Expected Move
          </text>

          {/* Labels */}
          <text x="30" y="145" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">0%</text>
          <text x={cx} y="20" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">100%</text>
          <text x="240" y="145" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">150%</text>
        </svg>

        {/* Info row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px',
          width: '100%', marginTop: '8px', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>EM ±1σ</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>
              ±{expectedMove.toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mov. Actual</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
              color: currentMove >= 0 ? '#00e676' : '#ff1744',
            }}>
              {currentMove >= 0 ? '+' : ''}{currentMove.toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              color: isWithin ? '#00e676' : '#ff1744',
              padding: '2px 8px',
              background: isWithin ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)',
              borderRadius: '4px',
              display: 'inline-block',
            }}>
              {isWithin ? 'DENTRO' : 'FUERA'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
