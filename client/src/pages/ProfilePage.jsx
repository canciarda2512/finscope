import { useEffect, useState } from 'react';
import { useAuth } from '../context/Authcontext';
import APIClient from '../services/APIClient';
import {
  BadgeCheck, Edit2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Shield, Settings, BarChart3, Wallet, Clock, Lock,
  Smartphone, Bell, Globe, EyeOff, AlertTriangle, CheckCircle2,
  RefreshCw, Zap, Target, Award, X, Check, ShieldCheck, ShieldOff,
} from 'lucide-react';

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtUSD = v =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const fmtPct = (v, signed = true) => {
  const n = Number(v || 0);
  return `${signed && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const fmtDate = v => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtTime = v => {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── Donut Chart ──────────────────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6', '#22d3ee', '#4ade80', '#f59e0b',
  '#a78bfa', '#f472b6', '#fb923c', '#34d399',
];

function DonutChart({ slices, total }) {
  const S = 220, T = 34, r = (S - T) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  const segs = slices.map(s => {
    const len = total > 0 ? (s.value / total) * C : 0;
    const seg = { ...s, len, acc };
    acc += len;
    return seg;
  });

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="drop-shadow-lg">
      {/* Track */}
      <circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={T} />
      {/* Glow filter */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g transform={`rotate(-90 ${S / 2} ${S / 2})`}>
        {segs.map((seg, i) => (
          <circle key={i} cx={S / 2} cy={S / 2} r={r}
            fill="none" stroke={seg.color} strokeWidth={T - 4}
            strokeDasharray={`${seg.len} ${C - seg.len}`}
            strokeDashoffset={-seg.acc}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        ))}
      </g>
      {/* Center */}
      <text x={S / 2} y={S / 2 - 10} textAnchor="middle" fill="#f8fafc" fontSize="15" fontWeight="bold" fontFamily="system-ui">
        {fmtUSD(total)}
      </text>
      <text x={S / 2} y={S / 2 + 10} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="system-ui">
        Total Assets
      </text>
    </svg>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = 'blue', trend, valueClass = 'text-white' }) {
  const colors = {
    blue:   { ring: 'ring-blue-500/20',   bg: 'bg-blue-500/10',   text: 'text-blue-400'   },
    green:  { ring: 'ring-green-500/20',  bg: 'bg-green-500/10',  text: 'text-green-400'  },
    amber:  { ring: 'ring-amber-500/20',  bg: 'bg-amber-500/10',  text: 'text-amber-400'  },
    purple: { ring: 'ring-purple-500/20', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    red:    { ring: 'ring-red-500/20',    bg: 'bg-red-500/10',    text: 'text-red-400'    },
    cyan:   { ring: 'ring-cyan-500/20',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400'   },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-[#0f172a] border border-slate-800 rounded-2xl p-5 ring-1 ${c.ring} hover:border-slate-700 transition-colors`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={17} className={c.text} />
        </div>
        {trend != null && (
          <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ data, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-600 text-sm animate-pulse">
        Loading portfolio data…
      </div>
    );
  }

  const {
    totalValue = 0, totalPnL = 0, totalPnLPercent = 0,
    balance = 0, positionsValue = 0,
    realizedPnL = 0, unrealizedPnL = 0,
    closedTrades = 0, winningTrades = 0, winRate = 0,
    sharpeRatio = 0, maxDrawdown = 0,
    positions = [], trades = [],
  } = data || {};

  const pnlUp = totalPnL >= 0;
  const recentTrades = trades.slice(0, 8);

  // Build chart slices from positions
  const slices = positions
    .filter(p => Number(p.value || 0) > 0)
    .slice(0, 8)
    .map((p, i) => ({
      label: p.symbol?.replace('USDT', '') || p.symbol,
      value: Number(p.value || 0),
      color: PALETTE[i % PALETTE.length],
    }));

  // Add cash as a slice if meaningful
  if (balance > 0 && slices.length < 8) {
    slices.push({ label: 'USDT', value: balance, color: '#475569' });
  }

  const chartTotal = slices.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-6">

      {/* ── Portfolio hero ── */}
      <div className="relative bg-gradient-to-br from-blue-950/60 via-[#0f172a] to-purple-950/30 border border-slate-800 rounded-2xl p-6 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-end gap-6">
          <div>
            <p className="text-slate-400 text-sm mb-1">Total Portfolio Value</p>
            <p className="text-5xl font-bold text-white tracking-tight">
              {fmtUSD(totalValue)}
            </p>
            <div className={`flex items-center gap-2 mt-2 text-sm font-semibold ${pnlUp ? 'text-green-400' : 'text-red-400'}`}>
              {pnlUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span>{pnlUp ? '+' : ''}{fmtUSD(totalPnL)}</span>
              <span className="text-slate-600">·</span>
              <span>{fmtPct(totalPnLPercent)}</span>
              <span className="text-slate-600 font-normal text-xs">vs $100K start</span>
            </div>
          </div>

          <div className="sm:ml-auto flex gap-6 text-right">
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Available Cash</p>
              <p className="text-white font-bold">{fmtUSD(balance)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">In Positions</p>
              <p className="text-white font-bold">{fmtUSD(positionsValue)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Unrealized PNL</p>
              <p className={`font-bold ${unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {unrealizedPnL >= 0 ? '+' : ''}{fmtUSD(unrealizedPnL)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`}
          sub={`${winningTrades} / ${closedTrades} trades`}
          icon={Target}
          color={closedTrades === 0 ? 'blue' : winRate >= 50 ? 'green' : 'red'}
          valueClass={closedTrades === 0 ? 'text-white' : winRate >= 50 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Realized PNL" value={fmtUSD(realizedPnL)}
          sub="From closed trades"
          icon={Award}
          color={realizedPnL >= 0 ? 'green' : 'red'}
          valueClass={realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}
          trend={realizedPnL >= 0 ? Math.abs(realizedPnL / 100) : -Math.abs(realizedPnL / 100)} />
        <StatCard label="Sharpe Ratio" value={closedTrades >= 2 ? Number(sharpeRatio).toFixed(2) : '—'}
          sub={closedTrades >= 2 ? 'Per-trade risk-adjusted return' : 'Needs 2+ closed trades'}
          icon={Zap}
          color={closedTrades < 2 ? 'cyan' : Number(sharpeRatio) >= 0 ? 'cyan' : 'red'}
          valueClass={closedTrades < 2 ? 'text-slate-500' : Number(sharpeRatio) >= 0 ? 'text-cyan-400' : 'text-red-400'} />
        <StatCard label="Max Drawdown" value={maxDrawdown > 0 ? fmtPct(-maxDrawdown, false) : '0.00%'}
          sub="Worst peak-to-trough"
          icon={AlertTriangle}
          color={maxDrawdown > 0 ? 'red' : 'green'}
          valueClass={maxDrawdown > 0 ? 'text-red-400' : 'text-green-400'} />
      </div>

      {/* ── Chart + Allocation ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Donut chart card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-6">Asset Allocation</h3>

          {slices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-sm">
              <Wallet size={32} className="mb-3 opacity-40" />
              No positions yet
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <DonutChart slices={slices} total={chartTotal} />
              <div className="flex-1 space-y-2.5">
                {slices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs font-medium text-slate-300">{s.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-white">{chartTotal > 0 ? ((s.value / chartTotal) * 100).toFixed(1) : 0}%</span>
                      <span className="text-[10px] text-slate-600 ml-1">{fmtUSD(s.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Open positions card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Open Positions</h3>

          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-sm">
              <BarChart3 size={32} className="mb-3 opacity-40" />
              No open positions
            </div>
          ) : (
            <div className="space-y-1">
              {positions.slice(0, 6).map((p, i) => {
                const pnlUp = Number(p.pnl || 0) >= 0;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800/50 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-blue-300">
                        {p.symbol?.replace('USDT', '').slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{p.symbol?.replace('USDT', '')}<span className="text-slate-500 font-normal">/USDT</span></p>
                        <p className="text-[11px] text-slate-500">{Number(p.quantity || 0).toFixed(4)} qty · @{fmtUSD(p.entryPrice)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{fmtUSD(p.value)}</p>
                      <p className={`text-[11px] font-medium ${pnlUp ? 'text-green-400' : 'text-red-400'}`}>
                        {pnlUp ? '+' : ''}{fmtUSD(p.pnl)} ({fmtPct(p.pnlPercent)})
                      </p>
                    </div>
                  </div>
                );
              })}
              {positions.length > 6 && (
                <p className="text-center text-slate-600 text-xs pt-2">+{positions.length - 6} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300">Recent Transactions</h3>
          <span className="text-[10px] text-slate-600">{trades.length} total</span>
        </div>

        {recentTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-sm">
            <Clock size={32} className="mb-3 opacity-40" />
            No transactions yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/60">
                  {['Type', 'Asset', 'Amount', 'Price', 'Total', 'PNL', 'Date'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t, i) => {
                  const isBuy = t.type === 'buy';
                  const hasPnl = t.realizedPnL != null && Number(t.realizedPnL) !== 0;
                  return (
                    <tr key={t.id || i} className="border-b border-slate-800/30 last:border-0 hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          isBuy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {isBuy ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {t.type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-blue-300">
                            {t.symbol?.replace('USDT', '').slice(0, 3)}
                          </div>
                          <span className="text-sm font-medium text-white">{t.symbol?.replace('USDT', '')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-slate-300">{Number(t.quantity || 0).toFixed(4)}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-300">{fmtUSD(t.price)}</td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-white">{fmtUSD(t.total)}</td>
                      <td className="px-6 py-3.5 text-sm">
                        {hasPnl ? (
                          <span className={`font-semibold ${Number(t.realizedPnL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {Number(t.realizedPnL) >= 0 ? '+' : ''}{fmtUSD(t.realizedPnL)}
                          </span>
                        ) : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-6 py-3.5 text-[11px] text-slate-500">{fmtTime(t.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portfolio Tab ────────────────────────────────────────────────────────────
function PortfolioTab({ data }) {
  const positions = data?.positions || [];
  const totalValue = data?.totalValue || 0;

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">All Positions</h3>
        <span className="text-[10px] text-slate-600">{positions.length} open</span>
      </div>
      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 text-sm">
          <Wallet size={36} className="mb-3 opacity-40" />
          No open positions. Start trading to build your portfolio.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60">
                {['Asset', 'Quantity', 'Avg Entry', 'Current Price', 'Value', 'Unrealized PNL', 'Allocation'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const pnlUp = Number(p.pnl || 0) >= 0;
                const alloc = totalValue > 0 ? ((Number(p.value || 0) / totalValue) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={i} className="border-b border-slate-800/30 last:border-0 hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: PALETTE[i % PALETTE.length] + '33', border: `1px solid ${PALETTE[i % PALETTE.length]}44` }}>
                          {p.symbol?.replace('USDT', '').slice(0, 4)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{p.symbol?.replace('USDT', '')}<span className="text-slate-500">/USDT</span></p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{Number(p.quantity || 0).toFixed(4)}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{fmtUSD(p.entryPrice)}</td>
                    <td className="px-6 py-4 text-sm text-white font-medium">{fmtUSD(p.currentPrice)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-white">{fmtUSD(p.value)}</td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-semibold ${pnlUp ? 'text-green-400' : 'text-red-400'}`}>
                        {pnlUp ? '+' : ''}{fmtUSD(p.pnl)}
                        <span className="text-[11px] ml-1 opacity-70">({fmtPct(p.pnlPercent)})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden w-20">
                          <div className="h-full rounded-full" style={{ width: `${alloc}%`, background: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <span className="text-xs text-slate-400">{alloc}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab({ data }) {
  const [filter, setFilter] = useState('all');
  const trades = data?.trades || [];
  const filtered = filter === 'all' ? trades : trades.filter(t => t.type === filter);

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Transaction History</h3>
        <div className="flex gap-1">
          {['all', 'buy', 'sell'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all capitalize ${
                filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {f === 'all' ? 'All' : f === 'buy' ? 'Buys' : 'Sells'}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 text-sm">
          <Clock size={36} className="mb-3 opacity-40" />
          No transactions found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60">
                {['Type', 'Asset', 'Quantity', 'Price', 'Total', 'Realized PNL', 'Date'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const isBuy = t.type === 'buy';
                const hasPnl = t.realizedPnL != null && Number(t.realizedPnL) !== 0;
                return (
                  <tr key={t.id || i} className="border-b border-slate-800/30 last:border-0 hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        isBuy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {isBuy ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {t.type?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm font-medium text-white">{t.symbol?.replace('USDT', '')}<span className="text-slate-500">/USDT</span></td>
                    <td className="px-6 py-3.5 text-sm text-slate-300">{Number(t.quantity || 0).toFixed(4)}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-300">{fmtUSD(t.price)}</td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-white">{fmtUSD(t.total)}</td>
                    <td className="px-6 py-3.5 text-sm">
                      {hasPnl
                        ? <span className={`font-semibold ${Number(t.realizedPnL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {Number(t.realizedPnL) >= 0 ? '+' : ''}{fmtUSD(t.realizedPnL)}
                          </span>
                        : <span className="text-slate-700">—</span>
                      }
                    </td>
                    <td className="px-6 py-3.5 text-[11px] text-slate-500">{fmtTime(t.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Password strength helpers (mirrored from RegisterPage) ───────────────────
const _UPPER   = /[A-Z]/;
const _DIGIT   = /[0-9]/;
const _SPECIAL = /[^A-Za-z0-9]/;

function pwStrength(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8)      s++;
  if (_UPPER.test(p))     s++;
  if (_DIGIT.test(p))     s++;
  if (_SPECIAL.test(p))   s++;
  return s;
}

const PW_META = [
  null,
  { label: 'Weak',   bar: 'bg-red-500',    text: 'text-red-400'    },
  { label: 'Fair',   bar: 'bg-orange-500', text: 'text-orange-400' },
  { label: 'Good',   bar: 'bg-yellow-400', text: 'text-yellow-400' },
  { label: 'Strong', bar: 'bg-green-500',  text: 'text-green-400'  },
];

// ── Generic modal overlay ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── OTP input component ───────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  return (
    <input
      type="text" inputMode="numeric" maxLength={6}
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
      placeholder="000000"
      autoFocus
      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
        text-white text-2xl text-center font-mono tracking-[0.5em]
        outline-none focus:border-blue-500 placeholder:text-slate-600"
    />
  );
}

// ── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab({ user, twoFAEnabled, onTwoFAChange }) {
  // ── Change Password modal state ────────────────────────────────────────────
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwData, setPwData]           = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw]           = useState({ current: false, next: false });
  const [pwLoading, setPwLoading]     = useState(false);
  const [pwError, setPwError]         = useState('');
  const [pwSuccess, setPwSuccess]     = useState(false);

  // ── 2FA modal state ─────────────────────────────────────────────────────────
  const [tfaModal, setTfaModal]       = useState(null); // null | 'enable' | 'disable'
  const [tfaStep, setTfaStep]         = useState('send'); // 'send' | 'verify'
  const [tfaMasked, setTfaMasked]     = useState('');
  const [tfaCode, setTfaCode]         = useState('');
  const [tfaLoading, setTfaLoading]   = useState(false);
  const [tfaError, setTfaError]       = useState('');

  const nextStrength = pwStrength(pwData.next);
  const nextMeta     = PW_META[nextStrength];

  // ── Change Password handlers ───────────────────────────────────────────────
  function openPwModal() {
    setPwData({ current: '', next: '', confirm: '' });
    setPwError(''); setPwSuccess(false);
    setShowPwModal(true);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    if (pwData.next !== pwData.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwData.next.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwLoading(true);
    try {
      await APIClient.post('/auth/change-password', {
        currentPassword: pwData.current,
        newPassword: pwData.next,
      });
      setPwSuccess(true);
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  }

  // ── 2FA handlers ───────────────────────────────────────────────────────────
  function openTfaModal(action) {
    setTfaModal(action); setTfaStep('send');
    setTfaCode(''); setTfaError(''); setTfaMasked('');
  }

  function closeTfaModal() {
    setTfaModal(null); setTfaStep('send');
    setTfaCode(''); setTfaError('');
  }

  async function handleSendOTP() {
    setTfaError(''); setTfaLoading(true);
    try {
      const res = await APIClient.post('/auth/2fa/send');
      setTfaMasked(res.data.maskedEmail || user?.email || '');
      setTfaStep('verify');
    } catch (err) {
      setTfaError(err.response?.data?.message || 'Failed to send verification code.');
    } finally {
      setTfaLoading(false);
    }
  }

  async function handleVerifyOTP() {
    setTfaError(''); setTfaLoading(true);
    const endpoint = tfaModal === 'enable' ? '/auth/2fa/verify' : '/auth/2fa/disable';
    try {
      await APIClient.post(endpoint, { code: tfaCode.trim() });
      onTwoFAChange(tfaModal === 'enable');
      closeTfaModal();
    } catch (err) {
      setTfaError(err.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setTfaLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Account Security */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Account Security</h3>
          <p className="text-xs text-slate-600 mb-6">Manage your account security settings and authentication methods.</p>

          {/* Password row */}
          <div className="flex items-center justify-between py-5 border-b border-slate-800/60">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                <Lock size={18} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Password</p>
                <p className="text-xs text-slate-500 mt-0.5">Update your account password</p>
              </div>
            </div>
            <button
              onClick={openPwModal}
              className="text-xs font-medium px-4 py-2 rounded-lg text-blue-400
                hover:bg-blue-500/10 border border-blue-500/20 transition-all"
            >
              Change Password
            </button>
          </div>

          {/* 2FA row */}
          <div className="flex items-center justify-between py-5 border-b border-slate-800/60">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFAEnabled ? 'bg-green-500/10' : 'bg-slate-800'}`}>
                <Smartphone size={18} className={twoFAEnabled ? 'text-green-400' : 'text-slate-400'} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">Two-Factor Authentication</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    twoFAEnabled ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {twoFAEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {twoFAEnabled
                    ? 'Login requires a 6-digit code sent to your email'
                    : 'Add an extra layer of security with email verification'}
                </p>
              </div>
            </div>
            <button
              onClick={() => openTfaModal(twoFAEnabled ? 'disable' : 'enable')}
              className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-all ${
                twoFAEnabled
                  ? 'text-red-400 hover:bg-red-500/10 border border-red-500/20'
                  : 'text-blue-400 hover:bg-blue-500/10 border border-blue-500/20'
              }`}
            >
              {twoFAEnabled
                ? <><ShieldOff size={13} /> Disable 2FA</>
                : <><ShieldCheck size={13} /> Enable 2FA</>}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#0f172a] border border-red-900/30 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
          <p className="text-xs text-slate-600 mb-6">Irreversible actions — proceed with caution.</p>
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Reset Demo Account</p>
                <p className="text-xs text-slate-500 mt-0.5">Reset your portfolio balance to $100,000</p>
              </div>
            </div>
            <button className="text-xs font-medium px-4 py-2 rounded-lg text-red-400
              hover:bg-red-500/10 border border-red-500/20 transition-all">
              Reset Account
            </button>
          </div>
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {showPwModal && (
        <Modal title="Change Password" onClose={() => setShowPwModal(false)}>
          {pwSuccess ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
                <Check size={28} className="text-green-400" />
              </div>
              <p className="text-white font-semibold">Password changed!</p>
              <p className="text-slate-500 text-sm text-center">Your password has been updated successfully.</p>
              <button onClick={() => setShowPwModal(false)}
                className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPw.current ? 'text' : 'password'}
                    value={pwData.current}
                    onChange={e => setPwData(d => ({ ...d, current: e.target.value }))}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-white text-sm outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw.current ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPw.next ? 'text' : 'password'}
                    value={pwData.next}
                    onChange={e => setPwData(d => ({ ...d, next: e.target.value }))}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-white text-sm outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, next: !s.next }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw.next ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {/* Strength bar */}
                {pwData.next && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i <= nextStrength ? (nextMeta?.bar || 'bg-slate-700') : 'bg-slate-700'}`} />
                      ))}
                    </div>
                    {nextMeta && <span className={`text-[10px] font-semibold ${nextMeta.text}`}>{nextMeta.label}</span>}
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={pwData.confirm}
                  onChange={e => setPwData(d => ({ ...d, confirm: e.target.value }))}
                  required
                  className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 ${
                    pwData.confirm && pwData.next !== pwData.confirm ? 'border-red-500' : 'border-slate-700'
                  }`}
                />
                {pwData.confirm && pwData.next !== pwData.confirm && (
                  <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {pwError && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg text-xs">
                  {pwError}
                </div>
              )}

              <button type="submit" disabled={pwLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 text-white font-semibold py-2.5 rounded-lg text-sm transition">
                {pwLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* ── 2FA Modal ── */}
      {tfaModal && (
        <Modal
          title={tfaModal === 'enable' ? 'Enable Two-Factor Authentication' : 'Disable Two-Factor Authentication'}
          onClose={closeTfaModal}
        >
          {tfaStep === 'send' ? (
            <div className="space-y-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                tfaModal === 'enable' ? 'bg-green-500/15' : 'bg-red-500/15'
              }`}>
                {tfaModal === 'enable'
                  ? <ShieldCheck size={28} className="text-green-400" />
                  : <ShieldOff size={28} className="text-red-400" />}
              </div>

              <div className="text-center">
                <p className="text-white font-semibold mb-1">
                  {tfaModal === 'enable' ? 'Secure your account' : 'Disable 2FA protection'}
                </p>
                <p className="text-slate-400 text-sm">
                  {tfaModal === 'enable'
                    ? 'A 6-digit verification code will be sent to your email address each time you sign in.'
                    : 'To disable 2FA, we need to verify your identity. A code will be sent to your email.'}
                </p>
              </div>

              <div className="bg-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-3">
                <CheckCircle2 size={16} className="text-blue-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{user?.email}</span>
              </div>

              {tfaError && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg text-xs">
                  {tfaError}
                </div>
              )}

              <button onClick={handleSendOTP} disabled={tfaLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 text-white font-semibold py-2.5 rounded-lg text-sm transition">
                {tfaLoading ? 'Sending…' : 'Send Verification Code'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-white font-semibold mb-1">Enter verification code</p>
                <p className="text-slate-400 text-sm">
                  Code sent to <span className="text-slate-200">{tfaMasked}</span>
                  <br />
                  <span className="text-slate-600 text-xs">Valid for 5 minutes</span>
                </p>
              </div>

              <OTPInput value={tfaCode} onChange={setTfaCode} />

              {tfaError && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg text-xs">
                  {tfaError}
                </div>
              )}

              <button
                onClick={handleVerifyOTP}
                disabled={tfaLoading || tfaCode.length < 6}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60
                  disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition"
              >
                {tfaLoading ? 'Verifying…' : tfaModal === 'enable' ? 'Enable 2FA' : 'Disable 2FA'}
              </button>

              <button onClick={() => { setTfaStep('send'); setTfaError(''); setTfaCode(''); }}
                className="w-full text-slate-500 hover:text-slate-300 text-sm py-1 transition">
                Resend code
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsRow({ icon: Icon, title, desc, control }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="flex-shrink-0 ml-4">{control}</div>
    </div>
  );
}

function Toggle({ on = false }) {
  const [active, setActive] = useState(on);
  return (
    <button onClick={() => setActive(v => !v)}
      className={`w-11 h-6 rounded-full transition-all relative ${active ? 'bg-blue-500' : 'bg-slate-700'}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${active ? 'left-5.5 left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function SettingsTab({ user }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-6">Notifications</h3>
        <SettingsRow icon={Bell} title="Trade Executions" desc="Get notified when your trades are filled" control={<Toggle on={true} />} />
        <SettingsRow icon={Bell} title="Price Alerts" desc="Receive alerts when price targets are hit" control={<Toggle on={true} />} />
        <SettingsRow icon={Bell} title="Limit Order Fills" desc="Alerts when limit orders execute" control={<Toggle on={false} />} />
      </div>
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-6">Display Preferences</h3>
<SettingsRow icon={Globe} title="Currency" desc="Display currency for prices" control={
          <select className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5">
            <option>USD</option><option>EUR</option><option>GBP</option>
          </select>
        } />
        <SettingsRow icon={RefreshCw} title="Auto-refresh Interval" desc="How often to refresh market data" control={
          <select className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5">
            <option>5s</option><option>10s</option><option>30s</option><option>1m</option>
          </select>
        } />
      </div>
    </div>
  );
}

// ── Tabs config ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',      label: 'Overview',      Icon: BarChart3 },
  { id: 'portfolio',     label: 'Portfolio',     Icon: Wallet    },
  { id: 'transactions',  label: 'Transactions',  Icon: Clock     },
  { id: 'security',      label: 'Security',      Icon: Shield    },
  { id: 'settings',      label: 'Settings',      Icon: Settings  },
];

// ── ProfilePage ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState('overview');
  const [twoFAEnabled, setTwoFAEnabled]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      APIClient.get('/portfolio'),
      APIClient.get('/auth/me'),
    ]).then(([portfolioRes, meRes]) => {
      if (!cancelled) {
        setPortfolioData(portfolioRes.data);
        setTwoFAEnabled(!!meRes.data.user?.twoFactorEnabled);
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalValue    = portfolioData?.totalValue    ?? 0;
  const totalPnL      = portfolioData?.totalPnL      ?? 0;
  const totalPnLPct   = portfolioData?.totalPnLPercent ?? 0;
  const positions     = portfolioData?.positions      ?? [];
  const trades        = portfolioData?.trades         ?? [];
  const pnlUp         = totalPnL >= 0;

  const initials = (user?.username || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#020617]">

      {/* ── Hero banner ── */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-purple-900/30" />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
        {/* Glow orbs */}
        <div className="absolute top-4 left-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -top-8 right-1/3 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">

        {/* ── Profile Header ── */}
        <div className="flex flex-col md:flex-row gap-6 items-start -mt-16 mb-8">

          {/* Avatar */}
          <div className="relative flex-shrink-0 z-10">
            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600
              flex items-center justify-center border-4 border-[#020617] shadow-2xl shadow-blue-900/50">
              <span className="text-white font-black text-3xl tracking-tight">{initials}</span>
            </div>
            <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 hover:bg-blue-400 rounded-xl
              flex items-center justify-center border-2 border-[#020617] transition-colors shadow-lg">
              <Edit2 size={13} className="text-white" />
            </button>
            {/* Online indicator */}
            <div className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#020617]" />
          </div>

          {/* User info */}
          <div className="flex-1 mt-16 md:mt-20">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white tracking-tight">
                @{user?.username || 'user'}
              </h1>
              <BadgeCheck size={20} className="text-blue-400" />
              <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30
                px-2.5 py-0.5 rounded-full font-bold tracking-wide">VERIFIED</span>
            </div>
            <p className="text-slate-400 text-sm">{user?.email || '—'}</p>
            <div className="flex flex-wrap gap-4 mt-2">
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-green-500" />
                Member since {fmtDate(user?.createdAt)}
              </span>
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Award size={11} className="text-amber-500" />
                Demo Trader
              </span>
            </div>
          </div>

          {/* Account summary cards */}
          <div className="md:mt-16 flex flex-wrap gap-3">
            {/* Total Balance */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl px-5 py-4 min-w-[165px]
              ring-1 ring-blue-500/10 hover:border-slate-700 transition-colors">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Total Balance</p>
              <p className="text-xl font-bold text-white">{fmtUSD(totalValue)}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${pnlUp ? 'text-green-400' : 'text-red-400'}`}>
                {pnlUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {fmtPct(totalPnLPct)} all time
              </div>
            </div>

            {/* Total PNL */}
            <div className={`bg-[#0f172a] border rounded-2xl px-5 py-4 min-w-[145px] transition-colors
              ${pnlUp ? 'border-green-900/50 ring-1 ring-green-500/10' : 'border-red-900/50 ring-1 ring-red-500/10'}`}>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Total PNL</p>
              <p className={`text-xl font-bold ${pnlUp ? 'text-green-400' : 'text-red-400'}`}>
                {pnlUp ? '+' : ''}{fmtUSD(totalPnL)}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">vs $100K start</p>
            </div>

            {/* Stats */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl px-5 py-4 min-w-[130px]
              hover:border-slate-700 transition-colors">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Activity</p>
              <p className="text-xl font-bold text-white">{trades.length}</p>
              <p className="text-[11px] text-slate-600 mt-1">{positions.length} open positions</p>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex gap-1 border-b border-slate-800 mb-8 overflow-x-auto pb-px">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
                }`}>
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'overview'     && <OverviewTab data={portfolioData} loading={loading} />}
        {activeTab === 'portfolio'    && <PortfolioTab data={portfolioData} />}
        {activeTab === 'transactions' && <TransactionsTab data={portfolioData} />}
        {activeTab === 'security'     && <SecurityTab user={user} twoFAEnabled={twoFAEnabled} onTwoFAChange={setTwoFAEnabled} />}
        {activeTab === 'settings'     && <SettingsTab user={user} />}
      </div>
    </div>
  );
}
