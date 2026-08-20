import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import './index.css';

export default function App() {
  const [spotData, setSpotData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRefresh = useCallback(() => {
    if (window.__dashboardRefresh) {
      window.__dashboardRefresh();
    }
  }, []);

  return (
    <div className="app-layout">
        <Sidebar />
        <Header spotData={spotData} onRefresh={handleRefresh} loading={loading} />
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                onSpotData={setSpotData}
                setLoading={setLoading}
                loading={loading}
              />
            }
          />
          <Route
            path="/chain"
            element={
              <div className="app-main">
                <div className="card" style={{ textAlign: 'center', padding: '80px 40px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                  <h2 style={{ color: 'var(--text-bright)', marginBottom: 8 }}>Options Chain</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Tabla interactiva de opciones — Próximamente</p>
                </div>
              </div>
            }
          />
        </Routes>
      </div>
  );
}
