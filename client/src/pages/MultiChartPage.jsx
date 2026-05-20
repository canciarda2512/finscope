import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickChart, MousePointer2, Minus, PencilLine, Wifi, WifiOff } from 'lucide-react';
import APIClient from '../services/APIClient';
import WebSocketClient from '../services/WebSocketClient';
import ChartView from '../components/ChartView';
import { useTheme } from '../context/ThemeContext';

import { SYMBOLS, TIMEFRAMES, INDICATORS } from '../constants';
const LAYOUTS = [
  { id: 1, label: 'Single Chart' },
  { id: 2, label: '2 Charts' },
  { id: 4, label: '4 Charts' },
];
const DEFAULT_PANELS = [
  { id: 'panel-1', symbol: 'BTCUSDT', timeframe: '5m' },
  { id: 'panel-2', symbol: 'ETHUSDT', timeframe: '5m' },
  { id: 'panel-3', symbol: 'SOLUSDT', timeframe: '1m' },
  { id: 'panel-4', symbol: 'BNBUSDT', timeframe: '1D' },
];

function formatSymbol(symbol) {
  return symbol.replace('USDT', '/USDT');
}

export default function MultiChartPage() {
  const { theme } = useTheme();
  const [layout, setLayout] = useState(1);
  const [connected, setConnected] = useState(WebSocketClient.isConnected());

  useEffect(() => {
    const unsubStatus = WebSocketClient.onStatus(setConnected);
    const unsubMessages = WebSocketClient.subscribe((msg) => {
      window.dispatchEvent(new CustomEvent('multi-chart:kline', { detail: msg }));
    });
    return () => { unsubStatus(); unsubMessages(); };
  }, []);

  const visiblePanels = DEFAULT_PANELS.slice(0, layout);
  const gridClass = layout === 1
    ? 'grid-cols-1'
    : layout === 2
      ? 'grid-cols-1 xl:grid-cols-2'
      : 'grid-cols-1 xl:grid-cols-2';

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            <CandlestickChart size={20} style={{ color: 'var(--accent)' }} />
            Multi-Chart
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Compare independent symbols and timeframes from one shared live feed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl p-1" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
            {LAYOUTS.map(option => (
              <button
                key={option.id}
                onClick={() => setLayout(option.id)}
                className="rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition"
                style={{
                  backgroundColor: layout === option.id ? 'var(--accent)' : 'transparent',
                  color: layout === option.id ? '#fff' : 'var(--text-muted)',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: connected ? 'var(--green)' : 'var(--text-dim)' }}>
            {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            {connected ? 'Shared WebSocket Active' : 'Connecting'}
          </div>
        </div>
      </div>

      <div className={`grid ${gridClass} gap-4`}>
        {visiblePanels.map((panel, index) => (
          <MultiChartPanel
            key={panel.id}
            panelId={panel.id}
            defaultSymbol={panel.symbol}
            defaultTimeframe={panel.timeframe}
            compact={layout === 4}
            title={`Panel ${index + 1}`}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}

const MultiChartPanel = memo(function MultiChartPanel({
  panelId,
  defaultSymbol,
  defaultTimeframe,
  compact,
  title,
  theme,
}) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [candles, setCandles] = useState([]);
  const [liveCandle, setLiveCandle] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [activeTool, setActiveTool] = useState('cursor');
  const [enabledIndicators, setEnabledIndicators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const symbolRef = useRef(symbol);

  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;

    const loadPanelData = async () => {
      setLoading(true);
      setError('');
      setLiveCandle(null);

      try {
        const [candlesRes, drawingsRes] = await Promise.all([
          APIClient.get('/chart/candles', { params: { symbol, timeframe } }),
          APIClient.get('/chart/drawings', { params: { symbol, timeframe } }),
        ]);

        if (cancelled) return;

        const formattedCandles = (candlesRes.data?.candles || [])
          .map(candle => ({
            time: Number(candle.time),
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
          }))
          .filter(candle => Number.isFinite(candle.time))
          .sort((a, b) => a.time - b.time);

        setCandles(formattedCandles);
        setDrawings(drawingsRes.data?.drawings || []);
      } catch (err) {
        console.error(`Multi-chart panel load error (${panelId}):`, err);
        if (!cancelled) {
          setCandles([]);
          setDrawings([]);
          setError('Data temporarily unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPanelData();

    return () => {
      cancelled = true;
    };
  }, [panelId, symbol, timeframe]);

  useEffect(() => {
    const handleKline = (event) => {
      const msg = event.detail;
      if (msg?.s !== symbolRef.current || !msg.k) return;

      const kline = msg.k;
      setLiveCandle({
        time: Math.floor(Number(kline.t) / 1000),
        open: Number(kline.o),
        high: Number(kline.h),
        low: Number(kline.l),
        close: Number(kline.c),
      });
    };

    window.addEventListener('multi-chart:kline', handleKline);
    return () => window.removeEventListener('multi-chart:kline', handleKline);
  }, []);

  const chartHeight = compact ? 320 : 500;
  const selectedIndicators = useMemo(() => new Set(enabledIndicators), [enabledIndicators]);

  const toggleIndicator = (indicator) => {
    setEnabledIndicators(prev => (
      prev.includes(indicator)
        ? prev.filter(item => item !== indicator)
        : [...prev, indicator]
    ));
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-xl" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</span>
          {loading && <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Loading...</span>}
          {error && <span className="text-[10px]" style={{ color: 'var(--red)' }}>{error}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="rounded px-2 py-1 text-[11px] font-bold outline-none"
            style={{ border: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            {SYMBOLS.map(item => (
              <option key={item} value={item}>{formatSymbol(item)}</option>
            ))}
          </select>

          <select
            value={timeframe}
            onChange={e => setTimeframe(e.target.value)}
            className="rounded px-2 py-1 text-[11px] font-bold outline-none"
            style={{ border: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            {TIMEFRAMES.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-1">
          {[
            { id: 'cursor', icon: <MousePointer2 size={14} />, label: 'Cursor' },
            { id: 'tline', icon: <PencilLine size={14} />, label: 'Trendline' },
            { id: 'hline', icon: <Minus size={14} />, label: 'Horizontal Line' },
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              className="rounded p-1.5 transition"
              style={{
                backgroundColor: activeTool === tool.id ? 'var(--accent-muted)' : 'transparent',
                color: activeTool === tool.id ? 'var(--accent-text)' : 'var(--text-muted)',
              }}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {INDICATORS.map(indicator => (
            <button
              key={indicator}
              onClick={() => toggleIndicator(indicator)}
              className="rounded px-2 py-1 text-[9px] font-bold uppercase transition"
              style={{
                border: selectedIndicators.has(indicator) ? '1px solid var(--accent)' : '1px solid var(--border-primary)',
                backgroundColor: selectedIndicators.has(indicator) ? 'var(--accent-muted)' : 'transparent',
                color: selectedIndicators.has(indicator) ? 'var(--accent-text)' : 'var(--text-dim)',
              }}
            >
              {indicator}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2">
        <ChartView
          key={`${panelId}-${symbol}-${timeframe}-${theme}`}
          candles={candles}
          liveCandle={liveCandle}
          timeframe={timeframe}
          activeTool={activeTool}
          savedDrawings={drawings}
          indicators={enabledIndicators}
          height={chartHeight}
          theme={theme}
        />
      </div>

      <div className="flex items-center justify-between px-3 py-2 text-[10px]" style={{ borderTop: '1px solid var(--border-primary)', color: 'var(--text-dim)' }}>
        <span>{formatSymbol(symbol)} / {timeframe}</span>
        <span>{drawings.length} saved drawings</span>
      </div>
    </section>
  );
});
