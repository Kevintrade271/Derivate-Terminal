import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">γ</div>
        <span className="sidebar-logo-text">QuantDesk</span>
      </div>

      <div className="sidebar-section-title">Derivados</div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} end>
          <span className="icon">📊</span>
          Dashboard
        </NavLink>
        <NavLink to="/chain" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="icon">📋</span>
          Options Chain
        </NavLink>
      </nav>

      <div className="sidebar-section-title">Análisis</div>
      <nav className="sidebar-nav">
        <button className="sidebar-link" disabled title="Próximamente">
          <span className="icon">🔥</span>
          Hurst / Entropy
        </button>
        <button className="sidebar-link" disabled title="Próximamente">
          <span className="icon">📈</span>
          Backtests
        </button>
      </nav>
    </aside>
  );
}
