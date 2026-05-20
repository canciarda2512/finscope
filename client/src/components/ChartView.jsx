import { useEffect, useRef, useCallback, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * ChartView — lightweight-charts candlestick component
 *
 * Props:
 *   candles        — full historical array (triggers setData)
 *   liveCandle     — single live tick from WebSocket (triggers update)
 *   timeframe      — string: '1m'|'5m'|'1D'|'1W'|'1M'
 *   activeTool     — 'cursor'|'tline'|'hline'
 *   aiPrediction   — { direction, confidence, predictedValues } | null
 *   anomalies      — [{ time, type, severity }]
 *   onPriceSelect  — (price: number) => void
 *   onSetAlert     — (price: number) => void  (right-click → set alert)
 */
export default function ChartView({
  candles,
  liveCandle,
  timeframe,
  activeTool,
  aiPrediction,
  anomalies = [],
  savedDrawings = [],
  indicators = [],
  indicatorData = {},
  height = '100%',
  onPriceSelect,
  onSetAlert,
  theme = 'dark',
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  const trendlinePointsRef = useRef([]);
  const drawingSeriesRef = useRef([]);
  const savedDrawingSeriesRef = useRef([]);
  const aiSeriesRef = useRef(null);
  const aiLinSeriesRef = useRef(null);
  const aiPolySeriesRef = useRef(null);
  const anomalySeriesRef = useRef(null);
  const indicatorSeriesRef = useRef([]);

  // Sub-chart refs for RSI and MACD
  const rsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);
  const rsiChartRef = useRef(null);
  const macdChartRef = useRef(null);

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== 'tline') trendlinePointsRef.current = [];
  }, [activeTool]);

  // ── Chart init (once per mount) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const computedHeight = height === '100%' ? container.clientHeight || 500 : height;
    const isDark = theme === 'dark';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: computedHeight,
      layout: {
        background: { color: isDark ? '#0d1117' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#64748b',
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#e2e8f0' },
        horzLines: { color: isDark ? '#1e293b' : '#e2e8f0' },
      },
      rightPriceScale: { borderColor: isDark ? '#334155' : '#d1d5db' },
      timeScale: {
        borderColor: isDark ? '#334155' : '#d1d5db',
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    chart.subscribeClick(param => {
      if (!param?.point || !candleSeriesRef.current) return;

      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      const time = chart.timeScale().coordinateToTime(param.point.x);
      if (!price) return;

      const tool = activeToolRef.current;

      if (tool === 'cursor') {
        onPriceSelect?.(price);
        return;
      }
      if (tool === 'hline') {
        drawHorizontalLine(price);
        return;
      }
      if (tool === 'tline') {
        const pts = trendlinePointsRef.current;
        pts.push({ time, price });
        if (pts.length === 2) {
          drawTrendline(pts[0], pts[1]);
          trendlinePointsRef.current = [];
        }
      }
    });

    // Right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      if (!candleSeriesRef.current) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const price = candleSeriesRef.current.coordinateToPrice(y);
      if (price && Number.isFinite(price)) {
        setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, price });
      }
    };
    container.addEventListener('contextmenu', handleContextMenu);

    // Close context menu on any click
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);

    const resize = () => {
      const newHeight = height === '100%' ? container.clientHeight || 500 : height;
      chart.applyOptions({ width: container.clientWidth, height: newHeight });
    };
    window.addEventListener('resize', resize);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', resize);
      chart.remove();
    };
  }, []);

  // ── Drawing helpers ──
  const drawHorizontalLine = useCallback((price) => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const range = ts.getVisibleRange();
    if (!range) return;
    const s = chartRef.current.addLineSeries({
      color: '#facc15',
      lineWidth: 1,
      lineStyle: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    s.setData([
      { time: range.from, value: price },
      { time: range.to, value: price },
    ]);
    drawingSeriesRef.current.push(s);
  }, []);

  const drawTrendline = useCallback((p1, p2) => {
    if (!chartRef.current) return;
    const [from, to] = p1.time <= p2.time ? [p1, p2] : [p2, p1];
    if (from.time === to.time) return;
    const s = chartRef.current.addLineSeries({
      color: '#38bdf8',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    s.setData([
      { time: from.time, value: from.price },
      { time: to.time, value: to.price },
    ]);
    drawingSeriesRef.current.push(s);
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    savedDrawingSeriesRef.current.forEach(series => {
      try { chartRef.current.removeSeries(series); } catch (_) {}
    });
    savedDrawingSeriesRef.current = [];

    savedDrawings.forEach(drawing => {
      try {
        const coordinates = typeof drawing.coordinates === 'string'
          ? JSON.parse(drawing.coordinates)
          : drawing.coordinates;

        if (drawing.type === 'hline') {
          const price = Number(coordinates?.price ?? coordinates?.value ?? coordinates?.[0]?.price);
          if (!Number.isFinite(price)) return;

          const range = chartRef.current.timeScale().getVisibleRange();
          const from = range?.from ?? candles?.[0]?.time;
          const to = range?.to ?? candles?.[candles.length - 1]?.time;
          if (!from || !to) return;

          const series = chartRef.current.addLineSeries({
            color: '#facc15',
            lineWidth: 1,
            lineStyle: 1,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: false,
          });
          series.setData([
            { time: from, value: price },
            { time: to, value: price },
          ]);
          savedDrawingSeriesRef.current.push(series);
        }

        if (drawing.type === 'trendline') {
          const points = Array.isArray(coordinates)
            ? coordinates
            : [coordinates?.from || coordinates?.p1, coordinates?.to || coordinates?.p2];
          const [p1, p2] = points;
          const fromTime = Number(p1?.time);
          const fromPrice = Number(p1?.price ?? p1?.value);
          const toTime = Number(p2?.time);
          const toPrice = Number(p2?.price ?? p2?.value);

          if (![fromTime, fromPrice, toTime, toPrice].every(Number.isFinite)) return;

          if (fromTime === toTime) return;
          
          const series = chartRef.current.addLineSeries({
            color: '#38bdf8',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          series.setData([
            { time: fromTime, value: fromPrice },
            { time: toTime, value: toPrice },
          ]);
          savedDrawingSeriesRef.current.push(series);
        }
      } catch (err) {
        console.warn('Saved drawing render error:', err.message);
      }
    });
  }, [savedDrawings, candles]);

  // ── Timeframe option update ──
  useEffect(() => {
    if (!chartRef.current) return;
    const intraday = ['1m', '5m', '15m', '1h', '4h'].includes(timeframe);
    chartRef.current.applyOptions({
      timeScale: { timeVisible: intraday },
    });
  }, [timeframe]);

  // ── Historical data load ──
  useEffect(() => {
    if (!candleSeriesRef.current || !candles?.length) return;

    const cleanData = candles
      .map(c => {
        let t = c.time;
        if (typeof t === 'object' && t !== null) {
          t = t.time ?? t.value ?? Object.values(t)[0];
        }
        return { ...c, time: Math.floor(Number(t)) };
      })
      .sort((a, b) => a.time - b.time)
      .filter((item, idx, arr) => idx === 0 || item.time > arr[idx - 1].time);

    try {
      candleSeriesRef.current.setData(cleanData);
      chartRef.current.timeScale().fitContent();
    } catch (err) {
      console.warn('setData error:', err.message);
    }
  }, [candles]);

  // ── Overlay indicators (SMA, EMA, BB) on main chart ──
  useEffect(() => {
    if (!chartRef.current) return;

    indicatorSeriesRef.current.forEach(series => {
      try { chartRef.current.removeSeries(series); } catch (_) {}
    });
    indicatorSeriesRef.current = [];

    if (!indicators?.length) return;

    const addLine = (data, color, title) => {
      if (!data?.length) return;
      const series = chartRef.current.addLineSeries({
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title,
      });
      series.setData(data);
      indicatorSeriesRef.current.push(series);
    };

    if (indicators.includes('SMA') && indicatorData.SMA?.values) {
      addLine(indicatorData.SMA.values, '#38bdf8', 'SMA 20');
    }
    if (indicators.includes('EMA') && indicatorData.EMA?.values) {
      addLine(indicatorData.EMA.values, '#f59e0b', 'EMA 20');
    }
    if (indicators.includes('BB') && indicatorData.BB) {
      addLine(indicatorData.BB.upper, '#a855f7', 'BB Upper');
      addLine(indicatorData.BB.lower, '#a855f7', 'BB Lower');
    }
  }, [indicators, indicatorData]);

  // ── Sub-chart indicators: RSI and MACD ──
  useEffect(() => {
    // Cleanup previous sub-charts
    if (rsiChartRef.current) {
      try { rsiChartRef.current.remove(); } catch (_) {}
      rsiChartRef.current = null;
    }
    if (macdChartRef.current) {
      try { macdChartRef.current.remove(); } catch (_) {}
      macdChartRef.current = null;
    }

    const isDarkSub = theme === 'dark';
    const subChartOptions = (container) => ({
      width: container.clientWidth,
      height: 110,
      layout: { background: { color: isDarkSub ? '#0d1117' : '#ffffff' }, textColor: isDarkSub ? '#94a3b8' : '#64748b' },
      grid: { vertLines: { color: isDarkSub ? '#1e293b' : '#e2e8f0' }, horzLines: { color: isDarkSub ? '#1e293b' : '#e2e8f0' } },
      rightPriceScale: { borderColor: isDarkSub ? '#334155' : '#d1d5db', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: isDarkSub ? '#334155' : '#d1d5db', timeVisible: false, secondsVisible: false },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false,
    });

    // RSI
    if (indicators.includes('RSI') && rsiContainerRef.current && indicatorData.RSI?.values?.length) {
      const rsiChart = createChart(rsiContainerRef.current, subChartOptions(rsiContainerRef.current));
      const rsiData = indicatorData.RSI.values;

      const rsiSeries = rsiChart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'RSI 14',
      });
      rsiSeries.setData(rsiData);

      // Overbought line (70)
      const obSeries = rsiChart.addLineSeries({
        color: '#ef444466',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      obSeries.setData(rsiData.map(d => ({ time: d.time, value: 70 })));

      // Oversold line (30)
      const osSeries = rsiChart.addLineSeries({
        color: '#22c55e66',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      osSeries.setData(rsiData.map(d => ({ time: d.time, value: 30 })));

      rsiChart.timeScale().fitContent();
      rsiChartRef.current = rsiChart;
    }

    // MACD
    if (indicators.includes('MACD') && macdContainerRef.current && indicatorData.MACD) {
      const macdChart = createChart(macdContainerRef.current, subChartOptions(macdContainerRef.current));
      const { macdLine, signalLine, histogram } = indicatorData.MACD;

      if (histogram?.length > 0) {
        const histSeries = macdChart.addHistogramSeries({
          color: '#334155',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        histSeries.setData(histogram.map(d => ({
          time: d.time,
          value: d.value,
          color: d.value >= 0 ? '#22c55e66' : '#ef444466',
        })));
      }

      if (macdLine?.length > 0) {
        const macdSeries = macdChart.addLineSeries({
          color: '#38bdf8',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'MACD',
        });
        macdSeries.setData(macdLine);
      }

      if (signalLine?.length > 0) {
        const signalSeries = macdChart.addLineSeries({
          color: '#f97316',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'Signal',
        });
        signalSeries.setData(signalLine);
      }

      macdChart.timeScale().fitContent();
      macdChartRef.current = macdChart;
    }

    // Resize handler for sub-charts
    const handleResize = () => {
      if (rsiChartRef.current && rsiContainerRef.current) {
        rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
      if (macdChartRef.current && macdContainerRef.current) {
        macdChartRef.current.applyOptions({ width: macdContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rsiChartRef.current) {
        try { rsiChartRef.current.remove(); } catch (_) {}
        rsiChartRef.current = null;
      }
      if (macdChartRef.current) {
        try { macdChartRef.current.remove(); } catch (_) {}
        macdChartRef.current = null;
      }
    };
  }, [indicators, indicatorData]);

  // ── Live candle update ──
  useEffect(() => {
    if (!candleSeriesRef.current || !liveCandle) return;
    try {
      candleSeriesRef.current.update({
        ...liveCandle,
        time: Math.floor(Number(liveCandle.time)),
      });
    } catch (err) {
      console.warn('Live update error:', err.message);
    }
  }, [liveCandle]);

  // ── AI Prediction overlay ──
  // Renders predictedValues as a purple line series appended after last candle
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove all existing AI series
    for (const ref of [aiLinSeriesRef, aiPolySeriesRef, aiSeriesRef]) {
      if (ref.current) {
        try { chartRef.current.removeSeries(ref.current); } catch (_) {}
        ref.current = null;
      }
    }

    if (!aiPrediction?.predictedValues?.length || !candles?.length) return;

    const lastCandle = candles[candles.length - 1];
    const intervalSeconds = timeframeToSeconds(timeframe);

    // Shift raw values so the projection starts exactly at lastCandle.close,
    // preserving slope/direction without a visual gap artifact.
    const anchorShift = (rawVals) => {
      const off = rawVals.length > 0 ? lastCandle.close - rawVals[0] : 0;
      return [
        { time: lastCandle.time, value: lastCandle.close },
        ...rawVals.map((v, i) => ({
          time: lastCandle.time + (i + 1) * intervalSeconds,
          value: v + off,
        })),
      ];
    };

    const models = aiPrediction.models ?? {};

    // Linear — thin blue dotted
    if (models.linear_values?.length) {
      const s = chartRef.current.addLineSeries({
        color: '#60a5fa',
        lineWidth: 1,
        lineStyle: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: `Linear R²:${(models.linear_r2 * 100).toFixed(1)}%`,
      });
      s.setData(anchorShift(models.linear_values));
      aiLinSeriesRef.current = s;
    }

    // Polynomial — thin orange dotted
    if (models.poly_values?.length) {
      const s = chartRef.current.addLineSeries({
        color: '#fb923c',
        lineWidth: 1,
        lineStyle: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: `Poly R²:${(models.poly_r2 * 100).toFixed(1)}%`,
      });
      s.setData(anchorShift(models.poly_values));
      aiPolySeriesRef.current = s;
    }

    // Ensemble — purple dashed (main result)
    const s = chartRef.current.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      title: `AI (${aiPrediction.direction})`,
    });
    s.setData(anchorShift(aiPrediction.predictedValues));
    aiSeriesRef.current = s;
  }, [aiPrediction, candles, timeframe]);

  // ── Anomaly markers ──
  // Renders anomalies as colored markers on the candlestick series
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    if (!anomalies?.length) {
      candleSeriesRef.current.setMarkers([]);
      return;
    }

    const markers = anomalies.map(a => ({
      time: Math.floor(Number(a.time)),
      position: 'aboveBar',
      color: a.severity === 'HIGH' ? '#ef4444' : '#f97316',
      shape: 'arrowDown',
      text: a.type,
    }));

    // lightweight-charts requires markers sorted by time
    markers.sort((a, b) => a.time - b.time);
    candleSeriesRef.current.setMarkers(markers);
  }, [anomalies]);

  const handleContextAction = (action) => {
    if (!contextMenu) return;
    if (action === 'alert' && onSetAlert) {
      onSetAlert(contextMenu.price);
    } else if (action === 'hline') {
      drawHorizontalLine(contextMenu.price);
    } else if (action === 'select') {
      onPriceSelect?.(contextMenu.price);
    } else if (action === 'clear-drawings') {
      drawingSeriesRef.current.forEach(s => {
        try { chartRef.current.removeSeries(s); } catch (_) {}
      });
      drawingSeriesRef.current = [];
    }
    setContextMenu(null);
  };

  return (
    <div className={`relative ${height === '100%' ? 'h-full flex flex-col' : ''}`} style={{ backgroundColor: 'var(--chart-bg)' }}>
      <div ref={containerRef} className={`w-full ${height === '100%' ? 'flex-1 min-h-0' : ''}`} style={height !== '100%' ? { height } : undefined} />

      {contextMenu && (
        <div
          className="absolute z-50 rounded-lg shadow-2xl py-1 text-xs min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="px-3 py-1.5 font-mono text-[10px]" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-primary)' }}>
            ${contextMenu.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {onSetAlert && (
            <button onClick={() => handleContextAction('alert')}
              className="w-full text-left px-3 py-1.5 transition" style={{ color: 'var(--text-secondary)' }}>
              Set Price Alert
            </button>
          )}
          <button onClick={() => handleContextAction('hline')}
            className="w-full text-left px-3 py-1.5 transition" style={{ color: 'var(--text-secondary)' }}>
            Draw Horizontal Line
          </button>
          <button onClick={() => handleContextAction('select')}
            className="w-full text-left px-3 py-1.5 transition" style={{ color: 'var(--text-secondary)' }}>
            Use as Order Price
          </button>
          {drawingSeriesRef.current.length > 0 && (
            <button onClick={() => handleContextAction('clear-drawings')}
              className="w-full text-left px-3 py-1.5 transition" style={{ color: 'var(--red)', borderTop: '1px solid var(--border-primary)' }}>
              Clear All Drawings
            </button>
          )}
        </div>
      )}

      {indicators?.includes('RSI') && (
        <div className="mt-1" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">RSI (14)</span>
            <span className="text-[9px] text-[var(--text-dim)]">— 70 overbought · 30 oversold</span>
          </div>
          <div ref={rsiContainerRef} className="w-full" />
        </div>
      )}

      {indicators?.includes('MACD') && (
        <div className="mt-1" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
            <span className="text-[9px] font-bold text-sky-400 uppercase tracking-widest">MACD (12,26,9)</span>
            <span className="text-[9px] text-[var(--text-dim)]">— <span className="text-sky-400">MACD</span> · <span className="text-orange-400">Signal</span></span>
          </div>
          <div ref={macdContainerRef} className="w-full" />
        </div>
      )}
    </div>
  );
}

// ── Helper: timeframe string → seconds ──
function timeframeToSeconds(tf) {
  const map = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1D': 86400,
    '1W': 604800,
    '1M': 2592000,
  };
  return map[tf] ?? 300;
}

