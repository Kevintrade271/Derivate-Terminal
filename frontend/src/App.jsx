import { useState, useCallback } from 'react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import './index.css';

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTicker = searchParams.get('ticker') || 'QQQ';
  
  const setTicker = (newTicker) => {
    setSearchParams({ ticker: newTicker }, { replace: true });
  };

  const [spotData, setSpotData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [globalGex, setGlobalGex] = useState(null);
  const [globalOi, setGlobalOi] = useState(null);

  const handleRefresh = useCallback(() => {
    if (window.__dashboardRefresh1) window.__dashboardRefresh1();
  }, []);

  return (
    <div className="app-layout">
      <Header 
        currentTicker={activeTicker}
        onSelectTicker={setTicker}
        spotData={spotData} 
        gexData={globalGex}
        oiData={globalOi}
        onRefresh={handleRefresh} 
        loading={loading} 
      />
      <div style={{ flex: 1, padding: 'var(--gap-lg)', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                key={activeTicker}
                ticker={activeTicker}
                onSpotData={setSpotData}
                setGlobalGex={setGlobalGex}
                setGlobalOi={setGlobalOi}
                setLoading={setLoading}
                loading={loading}
                instanceId={1}
              />
            }
          />
          <Route
            path="/history"
            element={
              <History key={activeTicker} ticker={activeTicker} />
            }
          />
        </Routes>
      </div>
    </div>
  );
}
