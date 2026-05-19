import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/Authcontext';
import { useTheme } from '../context/ThemeContext';
import APIClient from '../services/APIClient';
import {
  MousePointer2, Minus, PencilLine, Brain, AlertTriangle, TrendingUp,
  ChevronDown, Lock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import ChartView from '../components/ChartView';
import AlertPanel from '../components/AlertPanel';
import TradingPanel from '../components/TradingPanel';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M'];
const INDICATORS = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
const AVAILABLE_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT',
  'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT',
];

const SYMBOL_NAMES = {
  BTCUSDT: 'Bitcoin', ETHUSDT: 'Ethereum', BNBUSDT: 'BNB', SOLUSDT: 'Solana',
  XRPUSDT: 'XRP', ADAUSDT: 'Cardano', DOGEUSDT: 'Dogecoin', AVAXUSDT: 'Avalanche',
  LINKUSDT: 'Chainlink', DOTUSDT: 'Polkadot', TRXUSDT: 'TRON', MATICUSDT: 'Polygon',
  LTCUSDT: 'Litecoin', BCHUSDT: 'Bitcoin Cash', UNIUSDT: 'Uniswap', ATOMUSDT: 'Cosmos',
  ETCUSDT: 'Ethereum Classic', FILUSDT: 'Filecoin', APTUSDT: 'Aptos', ARBUSDT: 'Arbitrum',
  OPUSDT: 'Optimism', NEARUSDT: 'NEAR', INJUSDT: 'Injective', SUIUSDT: 'Sui', SEIUSDT: 'Sei',
};

function AiBanner({ result, onClose }) {
  const linR2  = result.models?.linear_r2 ?? null;
  const polyR2 = result.models?.poly_r2   ?? null;
  const hasModels = linR2 !== null && polyR2 !== null;
  const linWins   = hasModels && linR2 >= polyR2;
  const bestR2    = hasModels ? Math.max(linR2, polyR2) : null;
  const bestLabel = linWins ? 'Linear' : 'Polynomial';

  return (
    <div style={{ backgroundColor: 'var(--accent-muted)', borderBottom: '1px solid var(--accent-ring)' }}
      className="px-3 py-2 text-[11px]">
      <div className="flex items-center gap-2">
        <Brain size={12} style={{ color: 'var(--accent-text)' }} />
        <span style={{ color: 'var(--accent-text)' }}>
          AI projection · next 7 candles ·{' '}
          <strong style={{ color: result.direction === 'UP' ? 'var(--green)' : 'var(--red)' }}>
            {result.direction}
          </strong>
          {hasModels
            ? <> trend · Best fit: <strong>{bestLabel} R²: {(bestR2 * 100).toFixed(1)}%</strong></>
            : <> trend · Model fit: <strong>{result.confidence}%</strong></>
          }
        </span>
        <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100 text-[10px]"
          style={{ color: 'var(--text-muted)' }}>dismiss</button>
      </div>
      {hasModels && (
        <div className="flex items-center gap-2 mt-1 pl-5" style={{ color: 'var(--text-muted)' }}>
          <span style={ linWins ? { color: 'var(--accent-text)', fontWeight: 600 } : {}}>
            Linear: {(linR2 * 100).toFixed(1)}%{linWins ? ' ✓' : ''}
          </span>
          <span>·</span>
          <span style={!linWins ? { color: 'var(--accent-text)', fontWeight: 600 } : {}}>
            Polynomial: {(polyR2 * 100).toFixed(1)}%{!linWins ? ' ✓' : ''}
          </span>
          <span>·</span>
          <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
            {linWins ? 'linear-dominant' : 'poly-dominant'} blend → {result.confidence}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function ChartPage() {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
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
  const [prevPrice, setPrevPrice] = useState(null);
  const [selectedOrderPrice, setSelectedOrderPrice] = useState('');
  const [pendingAlertPrice, setPendingAlertPrice] = useState(null);
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showRightPanel] = useState(true);
  const [symbol, setSymbol] = useState(
    AVAILABLE_SYMBOLS.includes(initialSymbol) ? initialSymbol : 'BTCUSDT'
  );

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [anomalyError, setAnomalyError] = useState(null);
  const [anomalyActive, setAnomalyActive] = useState(false);

  const socketRef = useRef(null);
  const symbolSearchRef = useRef(null);

  useEffect(() => {
    const querySymbol = searchParams.get('symbol')?.toUpperCase();
    if (AVAILABLE_SYMBOLS.includes(querySymbol) && querySymbol !== symbol) setSymbol(querySymbol);
  }, [searchParams, symbol]);

  useEffect(() => {
    const fetchCandles = async () => {
      setLoading(true); setError(null); setAiResult(null); setAiError(null);
      setAnomalies([]); setAnomalyError(null); setAnomalyActive(false); setLiveCandle(null);
      try {
        const res = await APIClient.get('/chart/candles', { params: { symbol, timeframe } });
        const formattedCandles = (res.data?.candles || [])
          .map(c => ({ time: Number(c.time), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
          .sort((a, b) => a.time - b.time);
        setCandles(formattedCandles);
        if (formattedCandles.length > 0) {
          const last = formattedCandles[formattedCandles.length - 1];
          setCurrentPrice(last.close);
          setPrevPrice(formattedCandles.length > 1 ? formattedCandles[formattedCandles.length - 2].close : last.open);
          setSelectedOrderPrice(last.close.toFixed(2));
        }
        setQueryStats({ queryTime: res.data?.queryTime || '0ms', rowsScanned: res.data?.rowsScanned || 0 });
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Could not connect to the backend.');
      } finally { setLoading(false); }
    };
    fetchCandles();
    if (socketRef.current) socketRef.current.close();
    const socket = new WebSocket('ws://localhost:4000');
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.s !== symbol) return;
        const k = msg.k;
        const newCandle = { time: Math.floor(k.t / 1000), open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c) };
        setLiveCandle(newCandle);
        setPrevPrice(prev => currentPrice || prev);
        setCurrentPrice(newCandle.close);
      } catch (err) { console.warn('WS parse error:', err); }
    };
    socketRef.current = socket;
    return () => { if (socketRef.current) socketRef.current.close(); };
  }, [symbol, timeframe]);

  const handleAIPrediction = async () => {
    if (aiLoading) return;
    if (aiResult) { setAiResult(null); return; }
    setAiLoading(true); setAiError(null);
    try {
      const res = await APIClient.post('/chart/predict', { symbol, timeframe });
      if (res.data?.error) setAiError(res.data.error); else setAiResult(res.data);
    } catch { setAiError('AI service did not respond. Please try again.'); }
    finally { setAiLoading(false); }
  };

  const handleAnomalyDetection = async () => {
    if (anomalyLoading) return;
    if (anomalyActive) { setAnomalyActive(false); setAnomalies([]); setAnomalyError(null); return; }
    setAnomalyLoading(true); setAnomalyError(null);
    try {
      const res = await APIClient.post('/chart/anomalies', { symbol, timeframe });
      if (res.data?.error) setAnomalyError(res.data.error); else { setAnomalies(res.data.anomalies || []); setAnomalyActive(true); }
    } catch { setAnomalyError('Anomaly service did not respond.'); }
    finally { setAnomalyLoading(false); }
  };

  const toggleIndicator = (ind) => setActiveIndicators(prev =>
    prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
  );

  const priceChange = currentPrice && prevPrice ? currentPrice - prevPrice : 0;
  const priceChangePercent = prevPrice ? ((priceChange / prevPrice) * 100) : 0;
  const priceUp = priceChange >= 0;

  const filteredSymbols = AVAILABLE_SYMBOLS.filter(s => {
    const term = symbolSearch.toLowerCase();
    if (!term) return true;
    return s.toLowerCase().includes(term) || (SYMBOL_NAMES[s] || '').toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
      {/* CHART HEADER BAR */}
      <div className="flex items-center justify-between px-3 h-10 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="flex items-center gap-4">
          {/* Symbol selector */}
          <div className="relative">
            <button onClick={() => { setShowSymbolSearch(!showSymbolSearch); setTimeout(() => symbolSearchRef.current?.focus(), 50); }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md transition font-semibold text-sm"
              style={{ color: 'var(--text-primary)' }}>
              <span>{symbol.replace('USDT', '')}</span>
              <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/ USDT</span>
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
            {showSymbolSearch && (
              <div className="absolute top-full left-0 mt-1 w-64 rounded-lg shadow-2xl z-50 overflow-hidden"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                <div className="p-2" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <input ref={symbolSearchRef} type="text" value={symbolSearch} onChange={e => setSymbolSearch(e.target.value)}
                    placeholder="Search symbol..." className="w-full rounded px-2.5 py-1.5 text-xs outline-none transition"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }} />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredSymbols.map(s => (
                    <button key={s} onClick={() => { setSymbol(s); setShowSymbolSearch(false); setSymbolSearch(''); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left transition text-xs"
                      style={{ color: s === symbol ? 'var(--accent-text)' : 'var(--text-secondary)', backgroundColor: s === symbol ? 'var(--accent-muted)' : 'transparent' }}>
                      <div><span className="font-semibold">{s.replace('USDT', '')}</span><span className="ml-1" style={{ color: 'var(--text-dim)' }}>/ USDT</span></div>
                      <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{SYMBOL_NAMES[s]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live price */}
          {currentPrice && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-bold" style={{ color: priceUp ? 'var(--green)' : 'var(--red)' }}>
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: priceUp ? 'var(--green)' : 'var(--red)' }}>
                {priceUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {priceUp ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            </div>
          )}

          <div className="w-px h-5" style={{ backgroundColor: 'var(--border-primary)' }} />

          {/* Timeframes */}
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className="px-2 py-1 rounded text-[10px] font-bold transition"
                style={{
                  backgroundColor: timeframe === tf ? 'var(--accent-muted)' : 'transparent',
                  color: timeframe === tf ? 'var(--accent-text)' : 'var(--text-dim)',
                }}>
                {tf}
              </button>
            ))}
          </div>

          <div className="w-px h-5" style={{ backgroundColor: 'var(--border-primary)' }} />

          {/* Indicators */}
          <div className="hidden lg:flex items-center gap-0.5">
            {INDICATORS.map(ind => (
              <button key={ind} onClick={() => toggleIndicator(ind)}
                className="px-2 py-1 rounded text-[9px] uppercase font-bold transition"
                style={{
                  backgroundColor: activeIndicators.includes(ind) ? 'var(--accent-muted)' : 'transparent',
                  color: activeIndicators.includes(ind) ? 'var(--accent-text)' : 'var(--text-dim)',
                  boxShadow: activeIndicators.includes(ind) ? 'inset 0 0 0 1px var(--accent-ring)' : 'none',
                }}>
                {ind}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {loading && <span className="text-[10px] animate-pulse mr-2" style={{ color: 'var(--text-dim)' }}>Loading...</span>}
          {error && <span className="text-[10px] mr-2" style={{ color: 'var(--red)' }}>{error}</span>}
          {queryStats && (
            <span className="text-[9px] mr-2 hidden sm:inline" style={{ color: 'var(--text-dim)' }}>
              {queryStats.queryTime} | {queryStats.rowsScanned?.toLocaleString()} rows
            </span>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT TOOLBAR */}
        <div className="w-10 flex-shrink-0 flex flex-col items-center py-2 gap-1"
          style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-primary)' }}>
          {[
            { id: 'cursor', icon: <MousePointer2 size={15} />, title: 'Cursor' },
            { id: 'tline', icon: <PencilLine size={15} />, title: 'Trendline' },
            { id: 'hline', icon: <Minus size={15} />, title: 'Horizontal Line' },
          ].map(({ id, icon, title }) => (
            <button key={id} onClick={() => setActiveTool(id)} title={title} className="p-2 rounded-md transition"
              style={{
                backgroundColor: activeTool === id ? 'var(--accent-muted)' : 'transparent',
                color: activeTool === id ? 'var(--accent-text)' : 'var(--text-dim)',
              }}>
              {icon}
            </button>
          ))}
          <div className="w-5 my-1" style={{ borderTop: '1px solid var(--border-primary)' }} />
          {isAuthenticated ? (
            <>
              <button onClick={handleAIPrediction} disabled={aiLoading} title="AI Trend Prediction" className="p-2 rounded-md transition disabled:opacity-40"
                style={{ backgroundColor: aiResult ? 'var(--accent-muted)' : 'transparent', color: aiResult ? 'var(--accent-text)' : 'var(--text-dim)' }}>
                <Brain size={15} />
              </button>
              <button onClick={handleAnomalyDetection} disabled={anomalyLoading} title="Anomaly Detection" className="p-2 rounded-md transition disabled:opacity-40"
                style={{ backgroundColor: anomalyActive ? 'rgba(249,115,22,0.15)' : 'transparent', color: anomalyActive ? '#f97316' : 'var(--text-dim)' }}>
                <AlertTriangle size={15} />
              </button>
            </>
          ) : (
            <>
              <div title="Sign in to use AI Prediction" className="p-2 cursor-not-allowed relative" style={{ color: 'var(--text-dim)', opacity: 0.4 }}>
                <Brain size={15} /><Lock size={7} className="absolute bottom-1.5 right-1.5" />
              </div>
              <div title="Sign in to use Anomaly Detection" className="p-2 cursor-not-allowed relative" style={{ color: 'var(--text-dim)', opacity: 0.4 }}>
                <AlertTriangle size={15} /><Lock size={7} className="absolute bottom-1.5 right-1.5" />
              </div>
            </>
          )}
        </div>

        {/* CENTER: Chart */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeTool === 'tline' && (
            <div className="px-3 py-1.5 text-[10px]" style={{ color: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.08)', borderBottom: '1px solid rgba(6,182,212,0.2)' }}>
              Click the first point on the chart, then click the second point to draw a trendline.
            </div>
          )}
          {aiResult && <AiBanner result={aiResult} onClose={() => setAiResult(null)} />}
          {aiError && (
            <div className="px-3 py-1.5 text-[10px] flex items-center gap-2" style={{ color: 'var(--red)', backgroundColor: 'var(--red-muted)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
              <Brain size={10} /> {aiError}
              <button onClick={() => setAiError(null)} className="ml-auto opacity-60 hover:opacity-100">dismiss</button>
            </div>
          )}
          {anomalyActive && anomalies.length > 0 && (
            <div className="px-3 py-1.5 flex flex-wrap gap-1.5" style={{ backgroundColor: 'rgba(249,115,22,0.06)', borderBottom: '1px solid rgba(249,115,22,0.2)' }}>
              {anomalies.map((a, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{
                  backgroundColor: a.severity === 'HIGH' ? 'var(--red-muted)' : 'rgba(249,115,22,0.1)',
                  border: `1px solid ${a.severity === 'HIGH' ? 'rgba(239,68,68,0.3)' : 'rgba(249,115,22,0.3)'}`,
                  color: a.severity === 'HIGH' ? 'var(--red)' : '#f97316',
                }}>
                  <AlertTriangle size={8} className="inline mr-0.5" />
                  {a.type} - {new Date(a.time * 1000).toLocaleTimeString()} - {a.severity}
                </span>
              ))}
            </div>
          )}
          {anomalyError && (
            <div className="px-3 py-1.5 text-[10px] flex items-center gap-2" style={{ color: '#f97316', backgroundColor: 'rgba(249,115,22,0.06)', borderBottom: '1px solid rgba(249,115,22,0.2)' }}>
              <AlertTriangle size={10} /> {anomalyError}
              <button onClick={() => setAnomalyError(null)} className="ml-auto opacity-60 hover:opacity-100">dismiss</button>
            </div>
          )}
          {!isAuthenticated && (
            <div className="px-3 py-1.5 flex items-center justify-between" style={{ backgroundColor: 'var(--accent-muted)', borderBottom: '1px solid var(--accent-ring)' }}>
              <span className="text-[11px]" style={{ color: 'var(--accent-text)' }}>You are viewing as guest. Charts and indicators are free to use.</span>
              <Link to="/register" className="text-[10px] font-semibold text-white px-3 py-0.5 rounded transition"
                style={{ backgroundColor: 'var(--accent)' }}>Sign Up for Trading, Alerts & AI</Link>
            </div>
          )}

          <div className="flex-1 p-1">
            <ChartView
              key={`${symbol}-${timeframe}-${theme}`}
              candles={candles} liveCandle={liveCandle} timeframe={timeframe} activeTool={activeTool}
              aiPrediction={aiResult} anomalies={anomalyActive ? anomalies : []} indicators={activeIndicators}
              onPriceSelect={price => setSelectedOrderPrice(price?.toFixed(2) || '')}
              onSetAlert={isAuthenticated ? (price) => setPendingAlertPrice(price) : undefined}
              height="100%" theme={theme}
            />
          </div>

          <div className="h-6 flex-shrink-0 flex items-center justify-between px-3 text-[9px]"
            style={{ borderTop: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-dim)' }}>
            <div className="flex items-center gap-4">
              <span>{SYMBOL_NAMES[symbol] || symbol} / Tether</span>
              <span>{timeframe} timeframe</span>
              {anomalyActive && <span style={{ color: '#f97316' }}>{anomalies.length} anomalies detected</span>}
            </div>
            <div className="flex items-center gap-4">
              {queryStats && <span>Query: {queryStats.queryTime} | {queryStats.rowsScanned?.toLocaleString()} rows scanned</span>}
              <span>ClickHouse</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        {isAuthenticated && showRightPanel && (
          <div className="w-64 flex-shrink-0 overflow-y-auto" style={{ borderLeft: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="p-2 flex flex-col gap-2">
              <TradingPanel symbol={symbol} currentPrice={currentPrice} selectedPrice={selectedOrderPrice} />
              <AlertPanel symbol={symbol} currentPrice={currentPrice} pendingPrice={pendingAlertPrice} onPendingPriceConsumed={() => setPendingAlertPrice(null)} />
            </div>
          </div>
        )}
        {!isAuthenticated && showRightPanel && (
          <div className="w-64 flex-shrink-0 flex flex-col items-center justify-center px-4 text-center"
            style={{ borderLeft: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
            <Lock size={24} className="mb-3" style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Trading Panel</p>
            <p className="text-[11px] mb-4" style={{ color: 'var(--text-dim)' }}>
              Sign in to access paper trading, limit orders, price alerts, and AI features.
            </p>
            <Link to="/register" className="w-full py-2 text-xs font-bold text-white rounded-lg transition text-center block"
              style={{ backgroundColor: 'var(--accent)' }}>Create Free Account</Link>
            <Link to="/login" className="mt-2 text-[11px] transition" style={{ color: 'var(--text-muted)' }}>
              Already have an account? Sign in
            </Link>
          </div>
        )}
      </div>

      {showSymbolSearch && <div className="fixed inset-0 z-40" onClick={() => { setShowSymbolSearch(false); setSymbolSearch(''); }} />}
    </div>
  );
}
