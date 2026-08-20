import { useState } from 'react';

export default function Header({ spotData, onRefresh, loading }) {
  const price = spotData?.price ?? '—';
  const change = spotData?.change_pct ?? 0;
  const isPositive = change >= 0;

  return (
    <header className="app-header">
      <div className="header-ticker">
        <span className="header-ticker-symbol">S&P 500</span>
        <span className="header-ticker-price">
          {typeof price === 'number' ? price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : price}
        </span>
        <span className={`header-ticker-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '+' : ''}{change}%
        </span>
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
