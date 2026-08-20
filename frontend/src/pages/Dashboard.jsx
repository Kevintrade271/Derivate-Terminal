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

export default function Dashboard({ onSpotData, setLoading, loading }) {
  const [gexData, setGexData] = useState(null);
  const [gexTermData, setGexTermData] = useState(null);
  const [dexData, setDexData] = useState(null);
  const [vcData, setVcData] = useState(null);
  const [oiData, setOiData] = useState(null);
  const [ivData, setIvData] = useState(null);
  const [spotData, setSpotData] = useState(null);
  const [tf, setTf] = useState('1d');
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [gex, gexTerm, dex, vc, oi, iv, spot] = await Promise.allSettled([
        fetchGEX('^SPX', 5),
        fetchGexTerm('^SPX', 15),
        fetchDEX('^SPX', 5),
        fetchVannaCharm('^SPX', 5),
        fetchOI('^SPX', 3),
        fetchIVSkew('^SPX', 0),
        fetchSpot('^SPX', tf),
      ]);

      if (gex.status === 'fulfilled') setGexData(gex.value);
      if (gexTerm.status === 'fulfilled') setGexTermData(gexTerm.value);
      if (dex.status === 'fulfilled') setDexData(dex.value);
      if (vc.status === 'fulfilled') setVcData(vc.value);
      if (oi.status === 'fulfilled') setOiData(oi.value);
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
  }, [onSpotData, setLoading, tf]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Expose refresh function
  useEffect(() => {
    window.__dashboardRefresh = loadData;
    return () => { delete window.__dashboardRefresh; };
  }, [loadData]);

  return (
    <div className="app-main">
      {error && <div className="error-msg">{error}</div>}

      {/* Key Levels */}
      <div style={{ marginBottom: 'var(--gap-md)' }}>
        <KeyLevels gexData={gexData} />
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Spot Chart — full width */}
        <SpotChart spotData={spotData} gexData={gexData} tf={tf} onTfChange={setTf} />

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
