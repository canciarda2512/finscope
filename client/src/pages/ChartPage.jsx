import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import APIClient from '../services/APIClient';
import {
  MousePointer2, Minus, PencilLine, Brain, AlertTriangle, TrendingUp
} from 'lucide-react';
import ChartView from '../components/ChartView';
import AlertPanel from '../components/AlertPanel';
import TradingPanel from '../components/TradingPanel';

const TIMEFRAMES = ['1m', '5m', '1D', '1W', '1M'];
const INDICATORS = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
const AVAILABLE_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT',
  'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT',
];

export default function ChartPage() {
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
        setError('Backend baglantisi kurulamadi.');
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
      setAiError('AI servisi yanit vermedi. Lutfen tekrar deneyin.');
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
      setAnomalyError('Anomali servisi yanit vermedi.');
      console.error('Anomaly detection error:', err);
    } finally {
      setAnomalyLoading(false);
    }
  };

  const toggleIndicator = (ind) => setActiveIndicators(prev =>
    prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
  );

  return (
    <div className="bg-[#020617] min-h-screen p-4 text-slate-300">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-yellow-400" />
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-[#0f172a] border border-slate-700 text-white text-sm font-bold rounded px-2 py-1 outline-none focus:border-blue-500"
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
        {loading && <span className="text-slate-500 text-xs animate-pulse">Yukleniyor...</span>}
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
          <button
            onClick={handleAIPrediction}
            disabled={aiLoading}
            title="AI tabanli trend tahmini"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition
              ${aiResult
                ? 'bg-purple-700 text-white ring-1 ring-purple-400'
                : 'bg-purple-950 border border-purple-700 text-purple-300 hover:bg-purple-900'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Brain size={13} />
            {aiLoading
              ? 'Tahmin ediliyor...'
              : aiResult
                ? `${aiResult.direction === 'UP' ? 'UP' : 'DOWN'} (${aiResult.confidence}%)`
                : 'AI Prediction'}
          </button>

          <button
            onClick={handleAnomalyDetection}
            disabled={anomalyLoading}
            title="Volume spike ve fiyat anomalisi tespiti"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition
              ${anomalyActive
                ? 'bg-orange-600 text-white ring-1 ring-orange-400'
                : 'bg-orange-950 border border-orange-700 text-orange-300 hover:bg-orange-900'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <AlertTriangle size={13} />
            {anomalyLoading
              ? 'Analiz ediliyor...'
              : anomalyActive
                ? `${anomalies.length} anomali`
                : 'Anomaly Detection'}
          </button>
        </div>
      </div>

      {activeTool === 'tline' && (
        <div className="mb-3 text-[11px] text-cyan-400 bg-cyan-950 border border-cyan-800 rounded px-3 py-1.5 w-fit">
          Grafik uzerinde birinci noktaya tiklayin
        </div>
      )}

      {aiResult && (
        <div className="mb-3 flex items-center gap-3 bg-purple-950 border border-purple-700 rounded-lg px-4 py-2 text-sm text-purple-300 w-fit">
          <Brain size={14} />
          <span>
            <strong className={aiResult.direction === 'UP' ? 'text-green-400' : 'text-red-400'}>
              {aiResult.direction === 'UP' ? 'YUKARI' : 'ASAGI'} trend
            </strong>
            {' '}Guven: <strong>{aiResult.confidence}%</strong>
          </span>
          <button onClick={() => setAiResult(null)} className="ml-2 text-purple-400 hover:text-white text-xs">x</button>
        </div>
      )}

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

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-2">
            <ChartView
              key={`${symbol}-${timeframe}`}
              candles={candles}
              liveCandle={liveCandle}
              timeframe={timeframe}
              activeTool={activeTool}
              aiPrediction={aiResult}
              anomalies={anomalyActive ? anomalies : []}
              indicators={activeIndicators}
              onPriceSelect={price => setSelectedOrderPrice(price?.toFixed(2) || '')}
            />
          </div>
          <div className="mt-2 flex items-center gap-6 text-[11px] text-slate-600">
            {queryStats && (
              <span>
                <span className="text-slate-400">{queryStats.queryTime}</span> | <span className="text-slate-400">{queryStats.rowsScanned?.toLocaleString()}</span> rows scanned
              </span>
            )}
            {anomalyActive && (
              <span className="text-orange-400">{anomalies.length} anomali tespit edildi</span>
            )}
          </div>
        </div>

        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          <TradingPanel
            symbol={symbol}
            currentPrice={currentPrice}
            selectedPrice={selectedOrderPrice}
          />
          <AlertPanel symbol={symbol} currentPrice={currentPrice} />
        </div>
      </div>
    </div>
  );
}
