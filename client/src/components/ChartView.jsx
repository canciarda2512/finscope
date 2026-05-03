import { useEffect, useRef, useCallback } from 'react';
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
  height = 500,
  onPriceSelect,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  const trendlinePointsRef = useRef([]);
  const drawingSeriesRef = useRef([]);
  const savedDrawingSeriesRef = useRef([]);
  const aiSeriesRef = useRef(null);
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

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: {
        borderColor: '#334155',
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

    const resize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener('resize', resize);

    return () => {
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
    const intraday = timeframe === '1m' || timeframe === '5m';
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

    if (!indicators?.length || !candles?.length) return;

    const cleanData = candles
      .map(c => ({ ...c, time: Math.floor(Number(c.time)), close: Number(c.close) }))
      .filter(c => Number.isFinite(c.time) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);

    const addLine = (data, color, title) => {
      if (data.length === 0) return;
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

    if (indicators.includes('SMA')) {
      addLine(simpleMovingAverage(cleanData, 20), '#38bdf8', 'SMA 20');
    }
    if (indicators.includes('EMA')) {
      addLine(exponentialMovingAverage(cleanData, 20), '#f59e0b', 'EMA 20');
    }
    if (indicators.includes('BB')) {
      const bands = bollingerBands(cleanData, 20, 2);
      addLine(bands.upper, '#a855f7', 'BB Upper');
      addLine(bands.lower, '#a855f7', 'BB Lower');
    }
  }, [indicators, candles]);

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

    if (!candles?.length) return;

    const cleanData = candles
      .map(c => ({ ...c, time: Math.floor(Number(c.time)), close: Number(c.close) }))
      .filter(c => Number.isFinite(c.time) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);

    const subChartOptions = (container) => ({
      width: container.clientWidth,
      height: 110,
      layout: { background: { color: '#0f172a' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      rightPriceScale: { borderColor: '#334155', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#334155', timeVisible: false, secondsVisible: false },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false,
    });

    // RSI
    if (indicators.includes('RSI') && rsiContainerRef.current) {
      const rsiChart = createChart(rsiContainerRef.current, subChartOptions(rsiContainerRef.current));
      const rsiData = calculateRSI(cleanData, 14);

      const rsiSeries = rsiChart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'RSI 14',
      });
      rsiSeries.setData(rsiData);

      // Overbought line (70)
      if (rsiData.length > 0) {
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
      }

      rsiChart.timeScale().fitContent();
      rsiChartRef.current = rsiChart;
    }

    // MACD
    if (indicators.includes('MACD') && macdContainerRef.current) {
      const macdChart = createChart(macdContainerRef.current, subChartOptions(macdContainerRef.current));
      const { macdLine, signalLine, histogram } = calculateMACD(cleanData);

      if (histogram.length > 0) {
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

      if (macdLine.length > 0) {
        const macdSeries = macdChart.addLineSeries({
          color: '#38bdf8',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'MACD',
        });
        macdSeries.setData(macdLine);
      }

      if (signalLine.length > 0) {
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
  }, [indicators, candles]);

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

    // Remove existing AI series
    if (aiSeriesRef.current) {
      try { chartRef.current.removeSeries(aiSeriesRef.current); } catch (_) {}
      aiSeriesRef.current = null;
    }

    if (!aiPrediction?.predictedValues?.length || !candles?.length) return;

    const lastCandle = candles[candles.length - 1];
    const intervalSeconds = timeframeToSeconds(timeframe);

    // Build predicted data points starting from the candle AFTER the last one
    const predData = aiPrediction.predictedValues.map((value, i) => ({
      time: lastCandle.time + (i + 1) * intervalSeconds,
      value,
    }));

    const s = chartRef.current.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      lineStyle: 2,          // dashed
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      title: `AI (${aiPrediction.direction} ${aiPrediction.confidence}%)`,
    });

    // Anchor line at last close so it connects visually
    s.setData([
      { time: lastCandle.time, value: lastCandle.close },
      ...predData,
    ]);

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

  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-2">
      <div ref={containerRef} className="w-full" style={{ height }} />

      {indicators?.includes('RSI') && (
        <div className="mt-1 border-t border-slate-700/50">
          <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">RSI (14)</span>
            <span className="text-[9px] text-slate-600">— 70 overbought · 30 oversold</span>
          </div>
          <div ref={rsiContainerRef} className="w-full" />
        </div>
      )}

      {indicators?.includes('MACD') && (
        <div className="mt-1 border-t border-slate-700/50">
          <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
            <span className="text-[9px] font-bold text-sky-400 uppercase tracking-widest">MACD (12,26,9)</span>
            <span className="text-[9px] text-slate-600">— <span className="text-sky-400">MACD</span> · <span className="text-orange-400">Signal</span></span>
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
    '1D': 86400,
    '1W': 604800,
    '1M': 2592000,
  };
  return map[tf] ?? 300;
}

function simpleMovingAverage(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i += 1) {
    const slice = data.slice(i - period + 1, i + 1);
    const value = slice.reduce((sum, item) => sum + item.close, 0) / period;
    result.push({ time: data[i].time, value });
  }
  return result;
}

function exponentialMovingAverage(data, period) {
  if (data.length < period) return [];

  const result = [];
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, item) => sum + item.close, 0) / period;
  result.push({ time: data[period - 1].time, value: ema });

  for (let i = period; i < data.length; i += 1) {
    ema = ((data[i].close - ema) * multiplier) + ema;
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

function bollingerBands(data, period, deviations) {
  const upper = [];
  const lower = [];

  for (let i = period - 1; i < data.length; i += 1) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((sum, item) => sum + item.close, 0) / period;
    const variance = slice.reduce((sum, item) => sum + ((item.close - mean) ** 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push({ time: data[i].time, value: mean + (stdDev * deviations) });
    lower.push({ time: data[i].time, value: mean - (stdDev * deviations) });
  }

  return { upper, lower };
}

function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return [];
  const result = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  result.push({ time: data[period].time, value: 100 - 100 / (1 + avgGain / (avgLoss || 1e-10)) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({ time: data[i].time, value: 100 - 100 / (1 + avgGain / (avgLoss || 1e-10)) });
  }
  return result;
}

function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
  const fastEmaValues = exponentialMovingAverage(data, fast);
  const slowEmaValues = exponentialMovingAverage(data, slow);

  const fastMap = new Map(fastEmaValues.map(d => [d.time, d.value]));
  const slowMap = new Map(slowEmaValues.map(d => [d.time, d.value]));

  const macdLine = [];
  for (const [time, slowVal] of slowMap) {
    if (fastMap.has(time)) {
      macdLine.push({ time, value: fastMap.get(time) - slowVal });
    }
  }
  macdLine.sort((a, b) => a.time - b.time);

  if (macdLine.length < signal) return { macdLine, signalLine: [], histogram: [] };

  const k = 2 / (signal + 1);
  let prev = macdLine.slice(0, signal).reduce((s, d) => s + d.value, 0) / signal;
  const signalLine = [{ time: macdLine[signal - 1].time, value: prev }];

  for (let i = signal; i < macdLine.length; i++) {
    prev = macdLine[i].value * k + prev * (1 - k);
    signalLine.push({ time: macdLine[i].time, value: prev });
  }

  const sigMap = new Map(signalLine.map(d => [d.time, d.value]));
  const histogram = macdLine
    .filter(d => sigMap.has(d.time))
    .map(d => ({ time: d.time, value: d.value - sigMap.get(d.time) }));

  return { macdLine, signalLine, histogram };
}
