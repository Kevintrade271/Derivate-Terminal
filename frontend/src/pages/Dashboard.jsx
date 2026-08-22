import { useState, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  fetchGEX, fetchGexTerm, fetchDEX, fetchDEXChange, fetchVannaCharm,
  fetchOI, fetchSpot, fetchGEXHeatmap, fetchTrace, fetchIVSkew
} from '../api/client';
import KeyLevels from '../components/KeyLevels';
import SpotChart from '../components/SpotChart';
import TraceChart from '../components/TraceChart';
import GexProfile from '../components/GexProfile';
import GexTermStructure from '../components/GexTermStructure';
import DexProfile from '../components/DexProfile';
import VannaCharmProfile from '../components/VannaCharmProfile';
import OIChart from '../components/OIChart';
import GEXHeatmap from '../components/GEXHeatmap';
import VolumeProfile from '../components/VolumeProfile';
import PCRatioHistory from '../components/PCRatioHistory';
import { Flex, Button, Text } from '@tremor/react';

export default function Dashboard({ ticker, onSpotData, setGlobalGex, setGlobalOi, setLoading, loading, instanceId = 1 }) {
  const [tf, setTf] = useState('5m');
  const [dteFilter, setDteFilter] = useState('ALL');

  const exp = dteFilter === '0DTE' ? 1 : 5;
  const gexTermExp = dteFilter === '0DTE' ? 1 : 15;
  const oiExp = dteFilter === '0DTE' ? 1 : 3;
  const traceInterval = tf === '1d' || tf === '1h' ? '5m' : tf;

  const results = useQueries({
    queries: [
      { queryKey: ['gex', ticker, exp], queryFn: () => fetchGEX(ticker, exp), refetchInterval: 60000 },
      { queryKey: ['gexTerm', ticker, gexTermExp], queryFn: () => fetchGexTerm(ticker, gexTermExp), refetchInterval: 60000 },
      { queryKey: ['dex', ticker, exp], queryFn: () => fetchDEX(ticker, exp), refetchInterval: 60000 },
      { queryKey: ['vc', ticker, exp], queryFn: () => fetchVannaCharm(ticker, exp), refetchInterval: 60000 },
      { queryKey: ['oi', ticker, oiExp], queryFn: () => fetchOI(ticker, oiExp), refetchInterval: 60000 },
      { queryKey: ['spot', ticker, tf], queryFn: () => fetchSpot(ticker, tf), refetchInterval: 3000 },
      { queryKey: ['iv', ticker, 0], queryFn: () => fetchIVSkew(ticker, 0), refetchInterval: 60000 },
      { queryKey: ['gexHeatmap', ticker], queryFn: () => fetchGEXHeatmap(ticker, 8), refetchInterval: 60000 },
      { queryKey: ['dexChange', ticker, exp], queryFn: () => fetchDEXChange(ticker, exp, 300), refetchInterval: 10000 },
      { queryKey: ['trace', ticker, traceInterval], queryFn: () => fetchTrace(ticker, traceInterval), refetchInterval: 10000 },
    ]
  });

  const [
    { data: gexData, isLoading: isLoadingGex, error: gexError },
    { data: gexTermData },
    { data: dexData },
    { data: vcData },
    { data: oiData },
    { data: spotData },
    { data: ivData },
    { data: heatmapData },
    { data: dexChangeData },
    { data: traceData },
  ] = results;

  const isLoading = results.some(r => r.isLoading);
  const error = gexError ? 'Error de conexión con el backend.' : null;

  useEffect(() => {
    document.title = `${ticker} — QuantDesk Derivatives Terminal`;
  }, [ticker]);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (gexData && setGlobalGex) setGlobalGex(gexData);
  }, [gexData, setGlobalGex]);

  useEffect(() => {
    if (oiData && setGlobalOi) setGlobalOi(oiData);
  }, [oiData, setGlobalOi]);

  useEffect(() => {
    if (spotData && onSpotData) onSpotData(spotData);
  }, [spotData, onSpotData]);

  return (
    <div className="app-main" style={{ padding: '0', overflowY: 'visible' }}>
      {error && <div className="error-msg">{error}</div>}

      {/* Key Levels & Filters */}
      <div style={{ marginBottom: 'var(--gap-md)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Flex justifyContent="start" className="gap-3">
          <Text>Filtro de Expiración:</Text>
          <Button 
            variant={dteFilter === 'ALL' ? 'primary' : 'secondary'}
            size="xs"
            onClick={() => setDteFilter('ALL')}
          >
            ALL
          </Button>
          <Button 
            variant={dteFilter === '0DTE' ? 'primary' : 'secondary'}
            size="xs"
            onClick={() => setDteFilter('0DTE')}
          >
            0DTE
          </Button>
        </Flex>
        {gexData && <KeyLevels gexData={gexData} />}
      </div>

      {/* Side-by-Side: TradingView Candlestick Chart (Left) + SpotGamma Vertical Strike TRACE (Right) */}
      <div className="spot-trace-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
        gap: '20px',
        alignItems: 'start',
        marginBottom: '20px',
      }}>
        <SpotChart spotData={spotData} gexData={gexData} ivData={ivData} tf={tf} onTfChange={setTf} />
        {gexData && <TraceChart gexData={gexData} dexData={dexData} ticker={ticker} />}
      </div>

      {/* Main Analysis Grid */}
      <div className="dashboard-grid">
        {/* 1. GEX Profile */}
        {gexData && <GexProfile gexData={gexData} />}

        {/* 2. DEX Profile (Directly under GEX) */}
        {dexData && <DexProfile dexData={dexData} dexChangeData={dexChangeData} />}

        {/* 3. Vanna & Charm Profile */}
        {vcData && <VannaCharmProfile vcData={vcData} />}

        {/* 4. Volume Profile */}
        {gexData && <VolumeProfile gexData={gexData} />}

        {/* 5. Open Interest Distribution */}
        {oiData && <OIChart oiData={oiData} />}

        {/* 6. GEX Term Structure */}
        {gexTermData && <GexTermStructure termData={gexTermData} />}

        {/* 7. Put/Call Ratio History (Enlarged Full-Width) */}
        <PCRatioHistory oiData={oiData} />

        {/* 8. GEX Heatmap */}
        {heatmapData && <GEXHeatmap heatmapData={heatmapData} />}
      </div>
    </div>
  );
}

