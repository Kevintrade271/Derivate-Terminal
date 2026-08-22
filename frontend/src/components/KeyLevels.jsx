import RegimeIndicator from './RegimeIndicator';

function getCfdEquivalent(strike, spot) {
  if (!strike) return null;
  if (strike >= 400 && strike <= 900) {
    return { name: 'NAS100', price: (strike * (29308.86 / 713.44)).toFixed(1) };
  }
  if (strike >= 600 && strike <= 1000) {
    return { name: 'US500', price: (strike * (7674.37 / 765.72)).toFixed(1) };
  }
  if (strike >= 5000 && strike <= 10000) {
    return { name: 'US500', price: strike.toFixed(1) };
  }
  if (strike >= 300 && strike <= 600) {
    return { name: 'US30', price: (strike * (53277.01 / 532.22)).toFixed(1) };
  }
  if (strike >= 150 && strike <= 600) {
    return { name: 'XAUUSD', price: (strike * (4624.10 / 423.36)).toFixed(1) };
  }
  return null;
}

export default function KeyLevels({ gexData }) {
  if (!gexData) return null;

  const {
    spot_price,
    call_wall_strike,
    call_wall_gex,
    put_wall_strike,
    put_wall_gex,
    zero_gamma,
    total_gex,
    total_gex_0dte,
    regime,
    hedging_velocity_1pct,
    zero_gamma_distance_pts,
    zero_gamma_distance_pct,
    gamma_regime_state,
  } = gexData;

  const cfdCall = getCfdEquivalent(call_wall_strike, spot_price);
  const cfdPut = getCfdEquivalent(put_wall_strike, spot_price);
  const cfdZero = getCfdEquivalent(zero_gamma, spot_price);

  const isPositiveGamma = total_gex >= 0;
  const absDistPct = Math.abs(zero_gamma_distance_pct || 0);
  const flipBuffer = Math.min(100, Math.max(5, absDistPct * 15)); // visualization bar width

  return (
    <div className="key-levels-grid fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
      
      {/* 1. Call Wall Card */}
      <div className="key-level-card green" id="call-wall-card" style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(0, 230, 118, 0.25)',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="key-level-label" style={{ color: '#00e676', fontWeight: 800 }}>CALL WALL (RESISTENCIA)</span>
          <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>+{call_wall_gex?.toFixed(2)} B$</span>
        </div>
        <div className="key-level-value" style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
          {call_wall_strike?.toLocaleString('en-US')}
        </div>
        {cfdCall && (
          <div className="key-level-sub green" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#38bdf8', fontWeight: 700, marginTop: '4px' }}>
            <span>CFD:</span>
            <span>{cfdCall.price}</span>
          </div>
        )}
      </div>

      {/* 2. Put Wall Card */}
      <div className="key-level-card red" id="put-wall-card" style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 23, 68, 0.25)',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="key-level-label" style={{ color: '#ff1744', fontWeight: 800 }}>PUT WALL (SOPORTE)</span>
          <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>{put_wall_gex?.toFixed(2)} B$</span>
        </div>
        <div className="key-level-value" style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
          {put_wall_strike?.toLocaleString('en-US')}
        </div>
        {cfdPut && (
          <div className="key-level-sub red" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#38bdf8', fontWeight: 700, marginTop: '4px' }}>
            <span>CFD:</span>
            <span>{cfdPut.price}</span>
          </div>
        )}
      </div>

      {/* 3. Zero Gamma / Gamma Flip Proximity Meter */}
      <div className="key-level-card blue" id="zero-gamma-card" style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(68, 138, 255, 0.25)',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="key-level-label" style={{ color: '#38bdf8', fontWeight: 800 }}>ZERO GAMMA (FLIP)</span>
          {cfdZero && <span style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>CFD: {cfdZero.price}</span>}
        </div>
        <div className="key-level-value" style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
          {zero_gamma?.toLocaleString('en-US')}
        </div>
        
        {/* Proximity Distance Indicator */}
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
            <span>Distancia:</span>
            <span style={{ color: isPositiveGamma ? '#00e676' : '#ff1744', fontWeight: 700 }}>
              {zero_gamma_distance_pts > 0 ? '+' : ''}{zero_gamma_distance_pts} pts ({zero_gamma_distance_pct}%)
            </span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${flipBuffer}%`,
              height: '100%',
              background: isPositiveGamma ? 'linear-gradient(90deg, #38bdf8, #00e676)' : 'linear-gradient(90deg, #ff9100, #ff1744)',
              borderRadius: '2px',
            }} />
          </div>
        </div>
      </div>

      {/* 4. Dealer Hedging Velocity (±1% Move Flow) */}
      <div className="key-level-card orange" id="hedging-velocity-card" style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 171, 64, 0.25)',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="key-level-label" style={{ color: '#ffab40', fontWeight: 800 }}>HEDGING VELOCITY (±1%)</span>
          <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>EST. FLOW</span>
        </div>
        <div className="key-level-value" style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
          {hedging_velocity_1pct > 0 ? '+' : ''}{hedging_velocity_1pct?.toFixed(3)} B$
        </div>
        <div style={{ fontSize: '10px', color: isPositiveGamma ? '#00e676' : '#ff9100', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
          {isPositiveGamma ? '⚡ AMORTIGUA (PIN EFFECT)' : '🚀 ACELERA (TREND RUNNER)'}
        </div>
      </div>

      {/* 5. Regime & 0DTE Impact Card */}
      <div className="key-level-card regime" id="regime-card" style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="key-level-label" style={{ color: '#94a3b8', fontWeight: 800 }}>RÉGIMEN DE DEALERS</span>
          <span className="live-beacon-dot" title="Live Market Streaming" />
        </div>
        <div style={{ marginTop: '2px', marginBottom: '4px' }}>
          <RegimeIndicator regime={regime} />
        </div>
        <div className="key-level-sub" style={{ color: 'var(--text-secondary)', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
          <span>0DTE GEX:</span>
          <span style={{ color: total_gex_0dte >= 0 ? '#00e676' : '#ff1744', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {total_gex_0dte > 0 ? '+' : ''}{total_gex_0dte?.toFixed(2)} B$
          </span>
        </div>
      </div>

    </div>
  );
}
