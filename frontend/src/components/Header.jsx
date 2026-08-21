import { useState } from 'react';
import RegimeIndicator from './RegimeIndicator';

export default function Header({ ticker, onTickerChange, spotData, gexData, oiData, onRefresh, loading }) {
  const price = spotData?.price ?? '—';
  const change = spotData?.change_pct ?? 0;
  const isPositive = change >= 0;

  const totalGex = gexData?.total_gex || 0;
  const regime = totalGex >= 0 ? 'POSITIVE' : 'NEGATIVE';
  const pcr = oiData?.put_call_ratio;

  const TICKER_OPTIONS = [
    { value: '^SPX', label: 'S&P 500 (^SPX)' },
    { value: '^NDX', label: 'Nasdaq 100 (^NDX)' },
    { value: 'SPY', label: 'SPDR S&P 500 (SPY)' },
    { value: 'QQQ', label: 'Invesco QQQ (QQQ)' },
    { value: 'GLD', label: 'Gold ETF (GLD)' }
  ];

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const selectedLabel = TICKER_OPTIONS.find(opt => opt.value === ticker)?.label || ticker;

  return (
    <header className="app-header">
      <div className="header-ticker" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <div className="custom-dropdown-container">
            <button 
              className="custom-dropdown-trigger" 
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {selectedLabel}
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>▼</span>
            </button>
            
            {dropdownOpen && (
              <div className="dropdown-overlay" onClick={() => setDropdownOpen(false)} />
            )}
            
            <div className={`custom-dropdown-menu ${dropdownOpen ? 'open' : ''}`}>
              {TICKER_OPTIONS.map(opt => (
                <div 
                  key={opt.value} 
                  className={`custom-dropdown-item ${ticker === opt.value ? 'selected' : ''}`}
                  onClick={() => {
                    onTickerChange(opt.value);
                    setDropdownOpen(false);
                  }}
                >
                  {opt.label}
                  {ticker === opt.value && <span>✓</span>}
                </div>
              ))}
            </div>
          </div>
          
          <span className="header-ticker-price" style={{ marginLeft: '8px' }}>
            {typeof price === 'number' ? price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : price}
          </span>
          <span className={`header-ticker-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '+' : ''}{change}%
          </span>
        </div>
        
        {/* Market Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '24px', paddingLeft: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          {gexData && <RegimeIndicator regime={regime} />}
          {pcr !== undefined && (
            <div className={`regime-badge ${pcr > 1 ? 'negative' : (pcr < 0.8 ? 'positive' : '')}`} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
              PCR: {pcr.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <div className="header-actions">
        <button
          className="header-btn"
          onClick={onRefresh}
          disabled={loading}
          id="refresh-btn"
        >
          <span className="icon">{loading ? '⏳' : '🔄'}</span>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
    </header>
  );
}
