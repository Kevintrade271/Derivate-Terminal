import { useState, useEffect, useCallback } from 'react';
import { fetchGEX, fetchGexTerm, fetchDEX, fetchVannaCharm, fetchOI, fetchIVSkew, fetchSpot } from '../api/client';
import KeyLevels from '../components/KeyLevels';
import SpotChart from '../components/SpotChart';
import GexProfile from '../components/GexProfile';
import GexTermStructure from '../components/GexTermStructure';
import DexProfile from '../components/DexProfile';
import VannaCharmProfile from '../components/VannaCharmProfile';
import OIChart from '../components/OIChart';
import IVSkew from '../components/IVSkew';

export default function Dashboard({ ticker, onSpotData, setGlobalGex, setGlobalOi, setLoading, loading }) {
  const [gexData, setGexData] = useState(null);
  const [gexTermData, setGexTermData] = useState(null);
  const [dexData, setDexData] = useState(null);
  const [vcData, setVcData] = useState(null);
  const [oiData, setOiData] = useState(null);
  const [ivData, setIvData] = useState(null);
  const [spotData, setSpotData] = useState(null);
  const [tf, setTf] = useState('1d');
  const [dteFilter, setDteFilter] = useState('ALL');
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const exp = dteFilter === '0DTE' ? 1 : 5;
      const gexTermExp = dteFilter === '0DTE' ? 1 : 15;
      const oiExp = dteFilter === '0DTE' ? 1 : 3;

      // Fetch all data in parallel
      const [gex, gexTerm, dex, vc, oi, iv, spot] = await Promise.allSettled([
        fetchGEX(ticker, exp),
        fetchGexTerm(ticker, gexTermExp),
        fetchDEX(ticker, exp),
        fetchVannaCharm(ticker, exp),
        fetchOI(ticker, oiExp),
        fetchIVSkew(ticker, 0),
        fetchSpot(ticker, tf),
      ]);

      if (gex.status === 'fulfilled') {
        setGexData(gex.value);
        if (setGlobalGex) setGlobalGex(gex.value);
      }
      if (gexTerm.status === 'fulfilled') setGexTermData(gexTerm.value);
      if (dex.status === 'fulfilled') setDexData(dex.value);
      if (vc.status === 'fulfilled') setVcData(vc.value);
      if (oi.status === 'fulfilled') {
        setOiData(oi.value);
        if (setGlobalOi) setGlobalOi(oi.value);
      }
      if (iv.status === 'fulfilled') setIvData(iv.value);
      if (spot.status === 'fulfilled') {
        setSpotData(spot.value);
        onSpotData(spot.value);
      }

      // Check if all failed
      const allFailed = [gex, dex, oi, iv, spot].every(r => r.status === 'rejected');
      if (allFailed) {
        setError('No se pudo conectar con el backend. Asegúrate de que FastAPI esté corriendo en 127.0.0.1:8000');
      }
    } catch (err) {
      setError('Error de conexión con el backend.');
    } finally {
      setLoading(false);
    }
  }, [ticker, onSpotData, setGlobalGex, setGlobalOi, setLoading, tf, dteFilter]);

  useEffect(() => {
    loadData();
    // Recarga los datos automáticamente cada 5 minutos (300,000 ms)
    const interval = setInterval(() => {
      loadData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Expose refresh function
  useEffect(() => {
    window.__dashboardRefresh = loadData;
    return () => { delete window.__dashboardRefresh; };
  }, [loadData]);

  return (
    <div className="app-main">
      {error && <div className="error-msg">{error}</div>}

      {/* Key Levels & Filters */}
      <div style={{ marginBottom: 'var(--gap-md)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Filtro de Expiración:</span>
          <button 
            onClick={() => setDteFilter('ALL')}
            style={{
              background: dteFilter === 'ALL' ? 'rgba(68,138,255,0.2)' : 'transparent',
              border: '1px solid rgba(68,138,255,0.3)',
              color: dteFilter === 'ALL' ? '#448aff' : 'var(--text-secondary)',
              padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
            }}>
            ALL
          </button>
          <button 
            onClick={() => setDteFilter('0DTE')}
            style={{
              background: dteFilter === '0DTE' ? 'rgba(68,138,255,0.2)' : 'transparent',
              border: '1px solid rgba(68,138,255,0.3)',
              color: dteFilter === '0DTE' ? '#448aff' : 'var(--text-secondary)',
              padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
            }}>
            0DTE
          </button>
        </div>
        <KeyLevels gexData={gexData} />
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Spot Chart — full width */}
        <SpotChart spotData={spotData} gexData={gexData} ivData={ivData} tf={tf} onTfChange={setTf} />

        {/* GEX Profile — full width */}
        <GexProfile gexData={gexData} />
        
        {/* GEX Term Structure */}
        <GexTermStructure termData={gexTermData} />

        {/* OI & DEX */}
        <OIChart oiData={oiData} />
        <DexProfile dexData={dexData} />

        {/* Vanna & Charm */}
        <VannaCharmProfile vcData={vcData} />

        {/* IV Skew */}
        <IVSkew ivData={ivData} spotPrice={spotData?.price} />
      </div>
    </div>
  );
}
