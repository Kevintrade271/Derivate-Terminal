import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries } from 'lightweight-charts';

export default function SpotChart({ spotData, gexData, ivData, tf, onTfChange }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const isInitialFitRef = useRef(false);

  // 1. Initialize & maintain Chart instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    // Clean up previous instance if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    }

    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: 640,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(68, 138, 255, 0.3)', labelBackgroundColor: '#448aff' },
        horzLine: { color: 'rgba(68, 138, 255, 0.3)', labelBackgroundColor: '#448aff' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        timeVisible: tf !== '1d',
        secondsVisible: false,
      },
      localization: {
        timeFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          return date.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
        dateFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          return date.toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
          });
        },
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676',
      downColor: '#ff1744',
      borderDownColor: '#ff1744',
      borderUpColor: '#00e676',
      wickDownColor: '#ff1744',
      wickUpColor: '#00e676',
    });

    seriesRef.current = candlestickSeries;
    isInitialFitRef.current = false;

    // If candles already exist upon mount, set them immediately
    if (spotData?.candles?.length) {
      const initialCandles = spotData.candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candlestickSeries.setData(initialCandles);
      chart.timeScale().fitContent();
      isInitialFitRef.current = true;
    }

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        priceLinesRef.current = [];
      }
    };
  }, [tf]); // Re-create chart when timeframe changes

  // 2. Real-time Candle Stream Updates
  useEffect(() => {
    if (!seriesRef.current || !spotData?.candles?.length) return;

    const candles = spotData.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(candles);

    if (!isInitialFitRef.current && chartRef.current) {
      chartRef.current.timeScale().fitContent();
      isInitialFitRef.current = true;
    }
  }, [spotData]);

  // 3. Draw & Update Key Levels
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Clear existing price lines
    priceLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Add GEX levels
    if (gexData) {
      if (gexData.call_wall_strike) {
        const line = series.createPriceLine({
          price: gexData.call_wall_strike,
          color: '#00e676',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Call Wall',
        });
        priceLinesRef.current.push(line);
      }
      if (gexData.put_wall_strike) {
        const line = series.createPriceLine({
          price: gexData.put_wall_strike,
          color: '#ff1744',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Put Wall',
        });
        priceLinesRef.current.push(line);
      }
      if (gexData.zero_gamma) {
        const line = series.createPriceLine({
          price: gexData.zero_gamma,
          color: '#e2e8f0',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'Gamma Flip',
        });
        priceLinesRef.current.push(line);
      }
    }

    // Add Expected Move lines
    if (ivData?.iv_points?.length && spotData?.price) {
      const spot = spotData.price;
      let atmPoint = ivData.iv_points[0];
      let minDiff = Infinity;
      ivData.iv_points.forEach((p) => {
        const diff = Math.abs(p.strike - spot);
        if (diff < minDiff) {
          minDiff = diff;
          atmPoint = p;
        }
      });

      const atmIv = atmPoint.call_iv || atmPoint.put_iv;
      if (atmIv) {
        const expectedMove = spot * (atmIv / Math.sqrt(252));
        const upperEM = spot + expectedMove;
        const lowerEM = spot - expectedMove;

        const lineUp = series.createPriceLine({
          price: upperEM,
          color: 'rgba(255, 152, 0, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '+1σ EM',
        });
        const lineDown = series.createPriceLine({
          price: lowerEM,
          color: 'rgba(255, 152, 0, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '-1σ EM',
        });
        priceLinesRef.current.push(lineUp, lineDown);
      }
    }
  }, [gexData, ivData, spotData?.price]);

  return (
    <div className="card fade-in" id="spot-chart-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center' }}>
        <div><span className="dot blue" /> Precio {spotData?.ticker || 'SPX'} — {tf.toUpperCase()}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {['1d', '1h', '15m', '5m', '3m', '1m'].map((t) => (
            <button
              key={t}
              onClick={() => onTfChange(t)}
              style={{
                background: tf === t ? 'rgba(68,138,255,0.2)' : 'transparent',
                border: '1px solid rgba(68,138,255,0.3)',
                color: tf === t ? '#448aff' : 'var(--text-secondary)',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container" ref={chartContainerRef} style={{ minHeight: 640, position: 'relative' }}>
        {!spotData?.candles?.length && (
          <div className="loading-container" style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(10,14,23,0.8)' }}>
            <div className="spinner" />
            <span>Cargando gráfico de velas...</span>
          </div>
        )}
      </div>
    </div>
  );
}
