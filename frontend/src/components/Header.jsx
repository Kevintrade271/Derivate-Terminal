import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import RegimeIndicator from './RegimeIndicator';

const DEFAULT_ASSETS = [
  { symbol: 'QQQ', label: 'QQQ (Nasdaq 100)' },
  { symbol: 'SPY', label: 'SPY (S&P 500)' },
  { symbol: '^SPX', label: '^SPX (S&P Index)' },
  { symbol: 'DIA', label: 'DIA (Dow Jones)' },
  { symbol: 'GLD', label: 'GLD (Gold)' },
];

export default function Header({ currentTicker, onSelectTicker, spotData, gexData, oiData, onRefresh, loading }) {
  const price = spotData?.price ?? '—';
  const change = spotData?.change_pct ?? 0;
  const isPositive = change >= 0;

  const totalGex = gexData?.total_gex || 0;
  const regime = totalGex >= 0 ? 'POSITIVE' : 'NEGATIVE';
  const pcr = oiData?.put_call_ratio;

  const [customInput, setCustomInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectTicker(customInput.trim().toUpperCase());
      setCustomInput('');
      setShowInput(false);
    }
  };

  return (
    <header className="app-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 24px' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {/* Left: Active Asset Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="live-beacon-dot" style={{ marginRight: '2px' }} title="Conexión en Vivo Activa" />
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {currentTicker}
            </span>
            <span className="header-ticker-price" style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>
              {typeof price === 'number' ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : price}
            </span>
            <span className={`header-ticker-change ${isPositive ? 'positive' : 'negative'}`} style={{ fontSize: '12px', fontWeight: 700 }}>
              {isPositive ? '+' : ''}{change}%
            </span>
          </div>

          {/* Market Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            {gexData && <RegimeIndicator regime={regime} />}
            {pcr !== undefined && (
              <div className={`regime-badge ${pcr > 1 ? 'negative' : (pcr < 0.8 ? 'positive' : '')}`} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                PCR: {pcr.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Right Navigation & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <nav className="header-nav" style={{ display: 'flex', gap: '8px' }}>
            <NavLink 
              to={`/?ticker=${currentTicker}`} 
              className={({ isActive }) => `header-tab ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                padding: '6px 14px',
                textDecoration: 'none',
                color: isActive ? '#00e5ff' : 'var(--text-secondary)',
                background: isActive ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(0, 229, 255, 0.3)' : 'transparent'}`,
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s'
              })}
              end
            >
              Dashboard en Vivo
            </NavLink>
            <NavLink 
              to={`/history?ticker=${currentTicker}`} 
              className={({ isActive }) => `header-tab ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                padding: '6px 14px',
                textDecoration: 'none',
                color: isActive ? '#00e5ff' : 'var(--text-secondary)',
                background: isActive ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(0, 229, 255, 0.3)' : 'transparent'}`,
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s'
              })}
            >
              Historial (Backtest)
            </NavLink>
          </nav>

          <button
            className="header-btn"
            onClick={onRefresh}
            disabled={loading}
            id="refresh-btn"
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              background: 'rgba(30, 41, 59, 0.7)',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Asset Tabs Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', overflowX: 'auto', paddingTop: '4px' }}>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, fontFamily: 'var(--font-mono)', marginRight: '4px' }}>
          ACTIVOS:
        </span>
        {DEFAULT_ASSETS.map((asset) => {
          const isActive = currentTicker === asset.symbol;
          return (
            <button
              key={asset.symbol}
              type="button"
              onClick={() => onSelectTicker(asset.symbol)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: isActive ? 'rgba(68, 138, 255, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${isActive ? '#448aff' : 'rgba(148, 163, 184, 0.15)'}`,
                color: isActive ? '#38bdf8' : '#94a3b8',
                boxShadow: isActive ? '0 0 12px rgba(68, 138, 255, 0.25)' : 'none',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isActive ? '#38bdf8' : '#475569',
                boxShadow: isActive ? '0 0 6px #38bdf8' : 'none',
              }} />
              {asset.symbol}
            </button>
          );
        })}

        {/* Custom Ticker Search */}
        {showInput ? (
          <form onSubmit={handleCustomSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="TICKER (ej. AAPL)"
              autoFocus
              style={{
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid #448aff',
                borderRadius: '6px',
                color: '#fff',
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                width: '110px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                background: '#448aff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setShowInput(false)}
              style={{
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px dashed rgba(148, 163, 184, 0.3)',
              color: '#94a3b8',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            + Otro Activo
          </button>
        )}
      </div>
    </header>
  );
}
