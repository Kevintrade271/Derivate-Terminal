import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries } from 'lightweight-charts';

export default function SpotChart({ spotData, gexData, tf, onTfChange }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !spotData?.candles?.length) return;

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
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
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676',
      downColor: '#ff1744',
      borderDownColor: '#ff1744',
      borderUpColor: '#00e676',
      wickDownColor: '#ff1744',
      wickUpColor: '#00e676',
    });

    const candles = spotData.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(candles);

    // Add key levels as horizontal lines
    if (gexData) {
      if (gexData.call_wall_strike) {
        candlestickSeries.createPriceLine({
          price: gexData.call_wall_strike,
          color: '#00e676',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Call Wall',
        });
      }
      if (gexData.put_wall_strike) {
        candlestickSeries.createPriceLine({
          price: gexData.put_wall_strike,
          color: '#ff1744',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Put Wall',
        });
      }
      if (gexData.zero_gamma) {
        candlestickSeries.createPriceLine({
          price: gexData.zero_gamma,
          color: '#448aff',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Zero γ',
        });
      }
    }

    chart.timeScale().fitContent();

    // Resize handler
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
      }
    };
  }, [spotData, gexData]);

  if (!spotData?.candles?.length) {
    return (
      <div className="card span-2">
        <div className="card-title"><span className="dot blue" /> Precio SPX</div>
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando gráfico...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card span-2 fade-in" id="spot-chart-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center' }}>
        <div><span className="dot blue" /> Precio SPX — {tf.toUpperCase()}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {['1d', '1h', '15m', '5m'].map((t) => (
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
                fontFamily: 'var(--font-mono)'
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container" ref={chartContainerRef} />
    </div>
  );
}
