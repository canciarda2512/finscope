import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import APIClient from '../services/APIClient';
import {
  MousePointer2, Minus, PencilLine, Brain, AlertTriangle, TrendingUp, X, Lock,
} from 'lucide-react';
import ChartView from '../components/ChartView';
import AlertPanel from '../components/AlertPanel';
import TradingPanel from '../components/TradingPanel';
import { useAuth } from '../context/Authcontext';

const TIMEFRAMES = ['1m', '5m', '1D', '1W', '1M'];
const INDICATORS = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
const AVAILABLE_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT',
  'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT',
];

function AiBanner({ result, onClose }) {
  const linR2 = result.models?.linear_r2 ?? null;
  const polyR2 = result.models?.poly_r2 ?? null;
  const hasModels = linR2 !== null && polyR2 !== null;
  const linWins = hasModels && linR2 >= polyR2;
  const bestR2 = hasModels ? Math.max(linR2, polyR2) : null;
  const bestLabel = linWins ? 'Linear' : 'Polynomial';

  return (
    <div className="mb-3 bg-purple-950 border border-purple-700 rounded-lg px-4 py-2.5 text-sm text-purple-300 w-fit">
      <div className="flex items-center gap-3">
        <Brain size={14} />
        <span>
          AI projection · next 7 candles ·{' '}
          <strong className={result.direction === 'UP' ? 'text-green-400' : 'text-red-400'}>
            {result.direction}
          </strong>
          {hasModels
            ? <>{' '}trend · Best model: <strong>{bestLabel} R²: {(bestR2 * 100).toFixed(1)}%</strong></>
            : <>{' '}trend · Model fit: <strong>{result.confidence}%</strong></>
          }
        </span>
        <button onClick={onClose} className="ml-2 text-purple-400 hover:text-white text-xs">×</button>
      </div>
      {hasModels && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          <span className={linWins ? 'text-purple-200 font-semibold' : 'text-purple-500'}>
            Linear: {(linR2 * 100).toFixed(1)}%{linWins ? ' ✓' : ''}
          </span>
          <span className="text-purple-700">·</span>
          <span className={!linWins ? 'text-purple-200 font-semibold' : 'text-purple-500'}>
            Polynomial: {(polyR2 * 100).toFixed(1)}%{!linWins ? ' ✓' : ''}
          </span>
          <span className="text-purple-700">·</span>
          <span className="text-purple-600 italic">
            weighted blend → {result.confidence}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function ChartPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol')?.toUpperCase();
  const [candles, setCandles] = useState([]);
  const [liveCandle, setLiveCandle] = useState(null);
  const [timeframe, setTimeframe] = useState('5m');
  const [activeTool, setActiveTool] = useState('cursor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryStats, setQueryStats] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [selectedOrderPrice, setSelectedOrderPrice] = useState('');
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [indicatorData, setIndicatorData] = useState({});
  const [symbol, setSymbol] = useState(
    AVAILABLE_SYMBOLS.includes(initialSymbol) ? initialSymbol : 'BTCUSDT'
  );

  // React to ?symbol= param changes (e.g. from navbar search)
  useEffect(() => {
    const s = searchParams.get('symbol')?.toUpperCase();
    if (s && AVAILABLE_SYMBOLS.includes(s)) setSymbol(s);
  }, [searchParams]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);

  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [anomalyError, setAnomalyError] = useState(null);
  const [anomalyActive, setAnomalyActive] = useState(false);

  const [drawings, setDrawings] = useState([]);

  const socketRef = useRef(null);

  const fetchDrawings = useCallback(async () => {
    try {
      const res = await APIClient.get('/chart/drawings', { params: { symbol, timeframe } });
      const fetched = res.data?.drawings || [];
      // Preserve unsaved local drawings while replacing DB entries
      setDrawings(prev => [...fetched, ...prev.filter(d => d.temp)]);
    } catch (err) {
      console.error('Drawings fetch error:', err);
    }
  }, [symbol, timeframe]);

  // Clear drawings on symbol/timeframe change, then fetch
  useEffect(() => {
    setDrawings([]);
    fetchDrawings();
  }, [fetchDrawings]);

  const handleDrawingCreated = useCallback(async (type, coordinates) => {
    const tempId = `temp-${Date.now()}`;
    setDrawings(prev => [...prev, { id: tempId, type, coordinates, temp: true }]);
    try {
      const res = await APIClient.post('/chart/drawings', { symbol, timeframe, type, coordinates });
      setDrawings(prev => prev.map(d => d.id === tempId ? { ...d, id: res.data.id, temp: false } : d));
    } catch (err) {
      // Keep drawing visible as local-only; it will disappear on symbol/timeframe change
      console.warn('Drawing not saved (local only):', err?.response?.status ?? err.message);
    }
  }, [symbol, timeframe]);

  const handleDrawingDelete = useCallback(async (id) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
    if (id.startsWith('temp-')) return; // local-only, no DB record
    try {
      await APIClient.delete(`/chart/drawings/${id}`);
    } catch (err) {
      console.error('Drawing delete error:', err);
      fetchDrawings();
    }
  }, [fetchDrawings]);

  const handleClearAllDrawings = useCallback(async () => {
    const saved = drawings.filter(d => !d.temp);
    setDrawings([]);
    await Promise.allSettled(saved.map(d => APIClient.delete(`/chart/drawings/${d.id}`)));
  }, [drawings]);

  useEffect(() => {
    const querySymbol = searchParams.get('symbol')?.toUpperCase();
    if (AVAILABLE_SYMBOLS.includes(querySymbol) && querySymbol !== symbol) {
      setSymbol(querySymbol);
    }
  }, [searchParams, symbol]);

  useEffect(() => {
    const fetchCandles = async () => {
      setLoading(true);
      setError(null);
      setAiResult(null);
      setAiError(null);
      setAnomalies([]);
      setAnomalyError(null);
      setAnomalyActive(false);
      setLiveCandle(null);

      try {
        const res = await APIClient.get('/chart/candles', {
          params: { symbol, timeframe },
        });

        const formattedCandles = (res.data?.candles || [])
          .map(c => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }))
          .sort((a, b) => a.time - b.time);

        setCandles(formattedCandles);

        if (formattedCandles.length > 0) {
          const last = formattedCandles[formattedCandles.length - 1];
          setCurrentPrice(last.close);
          setSelectedOrderPrice(last.close.toFixed(2));
        }

        setQueryStats({
          queryTime: res.data?.queryTime || '0ms',
          rowsScanned: res.data?.rowsScanned || 0,
        });
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to connect to backend.');
      } finally {
        setLoading(false);
      }
    };

    fetchCandles();

    if (socketRef.current) socketRef.current.close();
    const socket = new WebSocket('ws://localhost:4000');
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.s !== symbol) return;

        const k = msg.k;
        const newCandle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        };

        setLiveCandle(newCandle);
        setCurrentPrice(newCandle.close);
      } catch (err) {
        console.warn('WS parse error:', err);
      }
    };
    socket.onerror = (err) => console.warn('WebSocket error:', err);
    socketRef.current = socket;

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [symbol, timeframe]);

  const handleAIPrediction = async () => {
    if (aiLoading) return;
    if (aiResult) {
      setAiResult(null);
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await APIClient.post('/chart/predict', { symbol, timeframe });

      if (res.data?.error) {
        setAiError(res.data.error);
      } else {
        setAiResult(res.data);
      }
    } catch (err) {
      setAiError('AI service did not respond. Please try again.');
      console.error('AI prediction error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnomalyDetection = async () => {
    if (anomalyLoading) return;

    if (anomalyActive) {
      setAnomalyActive(false);
      setAnomalies([]);
      setAnomalyError(null);
      return;
    }

    setAnomalyLoading(true);
    setAnomalyError(null);

    try {
      const res = await APIClient.post('/chart/anomalies', { symbol, timeframe });

      if (res.data?.error) {
        setAnomalyError(res.data.error);
      } else {
        setAnomalies(res.data.anomalies || []);
        setAnomalyActive(true);
      }
    } catch (err) {
      setAnomalyError('Anomaly service did not respond.');
      console.error('Anomaly detection error:', err);
    } finally {
      setAnomalyLoading(false);
    }
  };

  const toggleIndicator = (ind) => setActiveIndicators(prev =>
    prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
  );

  // ── Backend indicator fetch ──
  useEffect(() => {
    if (activeIndicators.length === 0) {
      setIndicatorData({});
      return;
    }
    const PERIOD = { SMA: 20, EMA: 20, RSI: 14, MACD: 26, BB: 20 };
    let cancelled = false;
    Promise.allSettled(
      activeIndicators.map(type =>
        APIClient.get('/chart/indicators', {
          params: { symbol, timeframe, type, period: PERIOD[type] ?? 20 },
        }).then(res => ({ type, data: res.data }))
      )
    ).then(results => {
      if (cancelled) return;
      const next = {};
      for (const r of results) {
        if (r.status === 'fulfilled') next[r.value.type] = r.value.data;
      }
      setIndicatorData(next);
    });
    return () => { cancelled = true; };
  }, [activeIndicators, symbol, timeframe]);

  return (
    <div className="bg-[#020617] min-h-screen p-4 text-slate-300">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-yellow-400" />
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-[#0f172a] border border-slate-700 text-slate-300 text-sm font-bold rounded px-2 py-1 outline-none focus:border-blue-500"
          >
            {AVAILABLE_SYMBOLS.map(s => (
              <option key={s} value={s}>{s.replace('USDT', '/USDT')}</option>
            ))}
          </select>
        </div>
        {currentPrice && (
          <span className="text-green-400 font-mono text-lg font-bold">
            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
        {loading && <span className="text-slate-500 text-xs animate-pulse">Loading...</span>}
        {error && <span className="text-red-400 text-xs">{error}</span>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f172a] p-2 rounded-xl border border-slate-800 mb-4">
        <div className="flex gap-1">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${timeframe === tf ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {INDICATORS.map(ind => (
            <button
              key={ind}
              onClick={() => toggleIndicator(ind)}
              className={`px-2 py-1 border text-[9px] uppercase rounded transition font-bold ${
                activeIndicators.includes(ind)
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: 'cursor', icon: <MousePointer2 size={15} />, title: 'Cursor' },
            { id: 'tline', icon: <PencilLine size={15} />, title: 'Trendline' },
            { id: 'hline', icon: <Minus size={15} />, title: 'Horizontal Line' },
          ].map(({ id, icon, title }) => (
            <button key={id} onClick={() => setActiveTool(id)} title={title}
              className={`p-2 rounded-lg transition ${activeTool === id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <button
                onClick={handleAIPrediction}
                disabled={aiLoading}
                title="Linear regression projection for next 7 candles"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition
                  ${aiResult
                    ? 'bg-purple-700 text-white ring-1 ring-purple-400'
                    : 'bg-purple-950 border border-purple-700 text-purple-300 hover:bg-purple-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Brain size={13} />
                {aiLoading
                  ? 'Predicting...'
                  : aiResult
                    ? `Trend: ${aiResult.direction}`
                    : 'AI Prediction'}
              </button>

              <button
                onClick={handleAnomalyDetection}
                disabled={anomalyLoading}
                title="Volume spike and price anomaly detection"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition
                  ${anomalyActive
                    ? 'bg-orange-600 text-white ring-1 ring-orange-400'
                    : 'bg-orange-950 border border-orange-700 text-orange-300 hover:bg-orange-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <AlertTriangle size={13} />
                {anomalyLoading
                  ? 'Analyzing...'
                  : anomalyActive
                    ? `${anomalies.length} anomalies`
                    : 'Anomaly Detection'}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
                bg-slate-800 border border-slate-700 text-slate-500 hover:border-blue-500/50 hover:text-blue-400 transition"
              title="Sign in to use AI features"
            >
              <Lock size={12} /> AI Features
            </Link>
          )}
        </div>
      </div>

      {activeTool === 'tline' && (
        <div className="mb-3 text-[11px] text-cyan-400 bg-cyan-950 border border-cyan-800 rounded px-3 py-1.5 w-fit">
          Click on the first point on the chart, then click on the second point to draw a trendline. You can adjust or delete it later.
        </div>
      )}

      {aiResult && <AiBanner result={aiResult} onClose={() => setAiResult(null)} />}

      {aiError && (
        <div className="mb-3 text-[11px] text-red-400 bg-red-950 border border-red-800 rounded px-3 py-1.5 w-fit flex items-center gap-2">
          <Brain size={11} /> AI Prediction: {aiError}
          <button onClick={() => setAiError(null)} className="ml-1 opacity-60 hover:opacity-100">x</button>
        </div>
      )}

      {anomalyActive && anomalies.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {anomalies.map((a, i) => (
            <div key={i}
              className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 font-mono
              ${a.severity === 'HIGH'
                  ? 'bg-red-950 border-red-700 text-red-300'
                  : 'bg-orange-950 border-orange-700 text-orange-300'}`}>
              <AlertTriangle size={9} />
              {a.type} - {new Date(a.time * 1000).toLocaleTimeString('tr-TR')} - {a.severity}
            </div>
          ))}
        </div>
      )}

      {anomalyError && (
        <div className="mb-3 text-[11px] text-orange-400 bg-orange-950 border border-orange-800 rounded px-3 py-1.5 w-fit flex items-center gap-2">
          <AlertTriangle size={11} /> Anomaly Detection: {anomalyError}
          <button onClick={() => setAnomalyError(null)} className="ml-1 opacity-60 hover:opacity-100">x</button>
        </div>
      )}

      {drawings.length > 0 && (
        <div className="mb-3 p-2 bg-[#0f172a] border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Drawings</span>
            <button
              onClick={handleClearAllDrawings}
              className="text-[9px] text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {drawings.map((d) => {
              const coords = typeof d.coordinates === 'string'
                ? (() => { try { return JSON.parse(d.coordinates); } catch { return {}; } })()
                : d.coordinates;
              const label = d.type === 'hline'
                ? `Horizontal  $${Number(coords?.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                : 'Trendline';
              return (
                <div key={d.id}
                  className={`flex items-center justify-between gap-3 text-[11px] px-3 py-1.5 rounded-lg border font-mono
                    ${d.temp
                      ? 'border-slate-700 bg-slate-800/50 text-slate-500 animate-pulse'
                      : d.type === 'hline'
                        ? 'border-yellow-700/50 bg-yellow-950/30 text-yellow-300'
                        : 'border-sky-700/50 bg-sky-950/30 text-sky-300'
                    }`}>
                  <div className="flex items-center gap-2">
                    {d.type === 'hline' ? <Minus size={12} /> : <PencilLine size={12} />}
                    <span>{label}</span>
                    {d.temp && <span className="text-[9px] text-slate-600 font-sans">saving...</span>}
                  </div>
                  <button
                    onClick={() => handleDrawingDelete(d.id)}
                    title="Delete drawing"
                    className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-950/40"
                  >
                    <X size={11} />
                    <span className="text-[9px] font-sans">Delete</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <ChartView
            key={`${symbol}-${timeframe}`}
            candles={candles}
            liveCandle={liveCandle}
            timeframe={timeframe}
            activeTool={activeTool}
            aiPrediction={aiResult}
            anomalies={anomalyActive ? anomalies : []}
            indicators={activeIndicators}
            indicatorData={indicatorData}
            savedDrawings={drawings}
            onPriceSelect={price => setSelectedOrderPrice(price?.toFixed(2) || '')}
            onDrawingCreated={handleDrawingCreated}
          />
          <div className="mt-2 flex items-center gap-6 text-[11px] text-slate-600">
            {queryStats && (
              <span>
                <span className="text-slate-400">{queryStats.queryTime}</span> | <span className="text-slate-400">{queryStats.rowsScanned?.toLocaleString()}</span> rows scanned
              </span>
            )}
            {anomalyActive && (
              <span className="text-orange-400">{anomalies.length} anomalies detected</span>
            )}
          </div>
        </div>

        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          {isAuthenticated ? (
            <>
              <TradingPanel
                symbol={symbol}
                currentPrice={currentPrice}
                selectedPrice={selectedOrderPrice}
              />
              <AlertPanel symbol={symbol} currentPrice={currentPrice} />
            </>
          ) : (
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                  <Lock size={18} className="text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Sign in to trade</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Access paper trading, limit orders, price alerts and portfolio analytics.
                </p>
              </div>
              <Link
                to="/login"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg text-center transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg text-center transition-colors"
              >
                Create Free Account
              </Link>
              <div className="border-t border-slate-800 pt-3 space-y-1.5 text-[10px] text-slate-600">
                {['$100K virtual balance', 'Market & limit orders', 'Price alerts', 'Portfolio analytics', 'AI predictions'].map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <span className="text-blue-500">✓</span> {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
