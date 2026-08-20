import RegimeIndicator from './RegimeIndicator';

export default function KeyLevels({ gexData }) {
  if (!gexData) return null;

  const {
    call_wall_strike,
    call_wall_gex,
    put_wall_strike,
    put_wall_gex,
    zero_gamma,
    vol_trigger,
    total_gex,
    total_gex_0dte,
    absolute_gamma,
    regime,
  } = gexData;

  return (
    <div className="key-levels-grid fade-in">
      {/* Call Wall */}
      <div className="key-level-card green" id="call-wall-card">
        <div className="key-level-label">Call Wall (Resistencia)</div>
        <div className="key-level-value">
          {call_wall_strike?.toLocaleString('en-US')}
        </div>
        <div className="key-level-sub green">
          +{call_wall_gex?.toFixed(2)} B$
        </div>
      </div>

      {/* Put Wall */}
      <div className="key-level-card red" id="put-wall-card">
        <div className="key-level-label">Put Wall (Soporte)</div>
        <div className="key-level-value">
          {put_wall_strike?.toLocaleString('en-US')}
        </div>
        <div className="key-level-sub red">
          {put_wall_gex?.toFixed(2)} B$
        </div>
      </div>

      {/* Zero Gamma */}
      <div className="key-level-card blue" id="zero-gamma-card">
        <div className="key-level-label">Zero Gamma (Pivote)</div>
        <div className="key-level-value">
          {zero_gamma?.toLocaleString('en-US')}
        </div>
        <div className="key-level-sub blue">
          Neto: {total_gex?.toFixed(2)} B$
        </div>
      </div>

      {/* Vol Trigger */}
      <div className="key-level-card orange" id="vol-trigger-card">
        <div className="key-level-label">Vol Trigger</div>
        <div className="key-level-value">
          {vol_trigger?.toLocaleString('en-US')}
        </div>
        <div className="key-level-sub orange">
          Abs Gamma: {absolute_gamma?.toFixed(2)} B$
        </div>
      </div>

      {/* Regime */}
      <div className="key-level-card regime" id="regime-card">
        <div className="key-level-label">Régimen & 0DTE</div>
        <div style={{ marginTop: '4px', marginBottom: '4px' }}>
          <RegimeIndicator regime={regime} />
        </div>
        <div className="key-level-sub" style={{ color: 'var(--text-secondary)' }}>
          0DTE GEX: {total_gex_0dte > 0 ? '+' : ''}{total_gex_0dte?.toFixed(2)} B$
        </div>
      </div>
    </div>
  );
}
