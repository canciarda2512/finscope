import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickChart, MousePointer2, Minus, PencilLine, Wifi, WifiOff } from 'lucide-react';
import APIClient from '../services/APIClient';
import ChartView from '../components/ChartView';

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT',
  'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT',
];
const TIMEFRAMES = ['1m', '5m', '1D', '1W', '1M'];
const INDICATORS = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
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
  const [layout, setLayout] = useState(1);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:4000');
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        window.dispatchEvent(new CustomEvent('multi-chart:kline', { detail: msg }));
      } catch (err) {
        console.warn('Multi-chart websocket parse error:', err);
      }
    };

    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const visiblePanels = DEFAULT_PANELS.slice(0, layout);
  const gridClass = layout === 1
    ? 'grid-cols-1'
    : layout === 2
      ? 'grid-cols-1 xl:grid-cols-2'
      : 'grid-cols-1 xl:grid-cols-2';

  return (
    <div className="min-h-screen bg-[#020617] p-4 text-slate-300">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <CandlestickChart size={20} className="text-blue-500" />
            Multi-Chart
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Compare independent symbols and timeframes from one shared live feed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-800 bg-[#0f172a] p-1">
            {LAYOUTS.map(option => (
              <button
                key={option.id}
                onClick={() => setLayout(option.id)}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
                  layout === option.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={`flex items-center gap-2 text-xs font-bold ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
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
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</span>
          {loading && <span className="text-[10px] text-slate-600">Loading...</span>}
          {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="rounded border border-slate-700 bg-[#020617] px-2 py-1 text-[11px] font-bold text-white outline-none focus:border-blue-500"
          >
            {SYMBOLS.map(item => (
              <option key={item} value={item}>{formatSymbol(item)}</option>
            ))}
          </select>

          <select
            value={timeframe}
            onChange={e => setTimeframe(e.target.value)}
            className="rounded border border-slate-700 bg-[#020617] px-2 py-1 text-[11px] font-bold text-white outline-none focus:border-blue-500"
          >
            {TIMEFRAMES.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
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
              className={`rounded p-1.5 transition ${
                activeTool === tool.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
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
              className={`rounded border px-2 py-1 text-[9px] font-bold uppercase transition ${
                selectedIndicators.has(indicator)
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-800 text-slate-600 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {indicator}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2">
        <ChartView
          key={`${panelId}-${symbol}-${timeframe}`}
          candles={candles}
          liveCandle={liveCandle}
          timeframe={timeframe}
          activeTool={activeTool}
          savedDrawings={drawings}
          indicators={enabledIndicators}
          height={chartHeight}
        />
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2 text-[10px] text-slate-600">
        <span>{formatSymbol(symbol)} / {timeframe}</span>
        <span>{drawings.length} saved drawings</span>
      </div>
    </section>
  );
});
