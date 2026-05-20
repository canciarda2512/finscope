import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  BarChart3, Shield, Zap, Target, Activity, Brain, LineChart,
  ChevronRight, Star,
} from 'lucide-react';
import APIClient from '../services/APIClient';
import WebSocketClient from '../services/WebSocketClient';
import { SYMBOLS, SYMBOL_NAMES } from '../constants';

const COIN_META = Object.fromEntries(
  Object.entries(SYMBOL_NAMES).map(([symbol, name]) => [
    symbol,
    { name, base: symbol.replace('USDT', '') },
  ])
);

const TICKER_SYMBOLS = SYMBOLS.slice(0, 10);

function fmtPrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}

function fmtCompact(v) {
  return Number(v || 0).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
}

function fmtPct(v) {
  const n = Number(v || 0);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

// ── Scrolling ticker strip ──
function TickerStrip({ coins }) {
  const items = [...coins, ...coins]; // duplicate for seamless loop
  return (
    <div className="w-full overflow-hidden bg-[var(--bg-secondary)] border-y border-[var(--border-primary)] py-2.5">
      <div className="flex animate-ticker gap-10 w-max">
        {items.map((coin, i) => {
          const up = Number(coin.change24h) >= 0;
          return (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                {COIN_META[coin.symbol]?.base ?? coin.symbol.replace('USDT', '')}
              </span>
              <span className="text-xs font-mono text-[var(--text-primary)]">${fmtPrice(coin.currentPrice)}</span>
              <span className={`text-[11px] font-semibold ${up ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {fmtPct(coin.change24h)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Market table ──
function MarketTable({ coins, liveprices }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[var(--border-primary)] text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
            <th className="px-5 py-3 font-bold">#</th>
            <th className="px-5 py-3 font-bold">Asset</th>
            <th className="px-5 py-3 font-bold text-right">Price</th>
            <th className="px-5 py-3 font-bold text-right">24h Change</th>
            <th className="px-5 py-3 font-bold text-right">Volume (USDT, 24h)</th>
            <th className="px-5 py-3 font-bold text-right">Live</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-primary)]">
          {coins.map((coin, i) => {
            const up = Number(coin.change24h) >= 0;
            const meta = COIN_META[coin.symbol];
            const live = liveprices[coin.symbol];
            const displayPrice = live ?? coin.currentPrice;
            return (
              <tr
                key={coin.symbol}
                onClick={() => navigate(`/chart?symbol=${coin.symbol}`)}
                className="hover:bg-blue-600/5 transition-colors cursor-pointer group"
              >
                <td className="px-5 py-3.5 text-[var(--text-dim)] text-xs">{i + 1}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold text-blue-300">
                      {meta?.base?.slice(0, 3) ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">
                        {meta?.base ?? coin.symbol}<span className="text-[var(--text-dim)] font-normal">/USDT</span>
                      </p>
                      <p className="text-[11px] text-[var(--text-dim)]">{meta?.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold text-[var(--text-primary)] text-sm">
                  ${fmtPrice(displayPrice)}
                  {live && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse align-middle" />
                  )}
                </td>
                <td className={`px-5 py-3.5 text-right text-sm font-bold ${up ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  <div className="flex items-center justify-end gap-1">
                    {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {fmtPct(coin.change24h)}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right text-sm text-[var(--text-muted)] font-mono">
                  {fmtCompact(coin.volume24h)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className={`text-[10px] font-bold ${live ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}`}>
                    {live ? 'LIVE' : 'SNAP'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const FEATURES = [
  {
    icon: LineChart,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    ring: 'ring-blue-500/20',
    title: 'Advanced Charts',
    desc: 'Candlestick charts with SMA, EMA, RSI, MACD and Bollinger Bands. Draw trendlines and horizontal levels.',
  },
  {
    icon: Target,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    ring: 'ring-green-500/20',
    title: 'Paper Trading',
    desc: 'Trade with $100,000 virtual balance. Market orders, limit orders, and full portfolio tracking.',
  },
  {
    icon: BarChart3,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    ring: 'ring-purple-500/20',
    title: 'Portfolio Analytics',
    desc: 'Real-time PnL, win rate, Sharpe ratio, max drawdown, and asset allocation breakdown.',
  },
  {
    icon: Brain,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/20',
    title: 'AI Predictions',
    desc: 'Machine learning price direction forecasts and anomaly detection powered by scikit-learn.',
  },
  {
    icon: Activity,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    ring: 'ring-cyan-500/20',
    title: 'Market Screener',
    desc: 'Filter top gainers, top losers, highest volume, and RSI overbought/oversold conditions.',
  },
  {
    icon: Shield,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    ring: 'ring-rose-500/20',
    title: 'Strategy Backtesting',
    desc: 'Build and backtest trading strategies on historical data before risking any capital.',
  },
];

export default function LandingPage() {
  const [coins, setCoins] = useState([]);
  const [liveprices, setLiveprices] = useState({});
  const [activeTab, setActiveTab] = useState('highest-volume');
  const [loading, setLoading] = useState(true);
  // ── Fetch screener data ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    APIClient.get('/screener', { params: { tab: activeTab, limit: 20 } })
      .then(res => {
        if (!cancelled) setCoins(Array.isArray(res.data.symbols) ? res.data.symbols : []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeTab]);

  // ── WebSocket for live prices ──
  useEffect(() => {
    return WebSocketClient.subscribe((msg) => {
      if (msg.k) {
        setLiveprices(prev => ({ ...prev, [msg.s]: parseFloat(msg.k.c) }));
      }
    });
  }, []);

  const tickerCoins = coins.filter(c => TICKER_SYMBOLS.includes(c.symbol)).slice(0, 10);

  const TABS = [
    { id: 'highest-volume', label: 'Highest Volume' },
    { id: 'top-gainers',    label: 'Top Gainers'    },
    { id: 'top-losers',     label: 'Top Losers'     },
    { id: 'rsi-overbought', label: 'RSI Overbought' },
    { id: 'rsi-oversold',   label: 'RSI Oversold'   },
  ];

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen text-[var(--text-secondary)]">

      {/* ── Ticker Strip ── */}
      {tickerCoins.length > 0 && <TickerStrip coins={tickerCoins} />}

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-16 right-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.4) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live market data · 25 cryptocurrencies
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-[var(--text-primary)] tracking-tight mb-5 leading-tight">
            Trade smarter with
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent"> FinScope</span>
          </h1>

          <p className="text-lg text-[var(--text-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Real-time crypto charts, AI-powered predictions, paper trading with $100K virtual balance,
            and professional portfolio analytics — all in one platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="flex items-center gap-2 px-7 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50"
            >
              Get started free <ChevronRight size={16} />
            </Link>
            <Link
              to="/chart"
              className="flex items-center gap-2 px-7 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border-secondary)] text-[var(--text-secondary)] font-semibold rounded-xl text-sm transition-all"
            >
              <LineChart size={15} /> View Live Charts
            </Link>
            <Link
              to="/login"
              className="text-[var(--text-dim)] hover:text-[var(--text-secondary)] text-sm font-medium transition-colors"
            >
              Sign in →
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-10 mt-14 text-center">
            {[
              { label: 'Cryptocurrencies', value: '25' },
              { label: 'Starting Balance', value: '$100K' },
              { label: 'Chart Timeframes', value: '5' },
              { label: 'AI Models', value: '2' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-black text-[var(--text-primary)]">{s.value}</p>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Market Data Section ── */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Activity size={18} className="text-blue-400" /> Live Market
          </h2>
          <div className="flex gap-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-[var(--text-dim)] text-sm animate-pulse">
            Loading market data…
          </div>
        ) : (
          <MarketTable coins={coins} liveprices={liveprices} />
        )}

        <p className="text-center text-[var(--text-dim)] text-[10px] mt-3 uppercase tracking-widest">
          Snapshot · refreshes on tab change · live prices via WebSocket
        </p>
      </div>

      {/* ── Features Section ── */}
      <div className="bg-[var(--bg-secondary)] border-y border-[var(--border-primary)] py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[var(--text-primary)] mb-3">Everything you need to trade</h2>
            <p className="text-[var(--text-muted)] max-w-xl mx-auto text-sm">
              Sign in to unlock the full platform — all features are free.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, color, bg, ring, title, desc }) => (
              <div key={title} className={`bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl p-6 ring-1 ${ring} hover:border-[var(--border-secondary)] transition-colors`}>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon size={20} className={color} />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1.5">{title}</h3>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="relative bg-gradient-to-br from-blue-950/60 via-[var(--bg-secondary)] to-purple-950/30 border border-[var(--border-primary)] rounded-3xl p-12 overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex justify-center mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
              ))}
            </div>
            <h2 className="text-3xl font-black text-[var(--text-primary)] mb-3">Ready to start trading?</h2>
            <p className="text-[var(--text-muted)] mb-8 max-w-md mx-auto text-sm">
              Create your free account and start paper trading with $100,000 virtual funds. No credit card required.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30"
              >
                Create free account <ChevronRight size={16} />
              </Link>
              <Link
                to="/login"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors"
              >
                Already have an account? Sign in →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--border-primary)] py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-[11px] text-[var(--text-dim)]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <TrendingUp size={12} className="text-white" />
            </div>
            <span className="font-bold text-[var(--text-muted)]">FinScope</span>
            <span>· Paper trading platform</span>
          </div>
          <span>Data: Binance · Charts: lightweight-charts</span>
        </div>
      </div>
    </div>
  );
}
