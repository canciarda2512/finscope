import {
  TrendingUp, ArrowUpRight, ArrowDownRight,
  BarChart3, Wallet, Clock, Zap, Target, Award, AlertTriangle,
} from 'lucide-react';
import { PALETTE, fmtUSD, fmtPct, fmtTime } from './formatters';

// -- DonutChart ----------------------------------------------------------------
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
      <circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={T} />
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
      <text x={S / 2} y={S / 2 - 10} textAnchor="middle" fill="#f8fafc" fontSize="15" fontWeight="bold" fontFamily="system-ui">
        {fmtUSD(total)}
      </text>
      <text x={S / 2} y={S / 2 + 10} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="system-ui">
        Total Assets
      </text>
    </svg>
  );
}

// -- StatCard ------------------------------------------------------------------
function StatCard({ label, value, sub, icon: Icon, color = 'blue', trend, valueStyle }) {
  const colors = {
    blue:   { ring: 'ring-blue-500/20',   bg: 'bg-blue-500/10',   text: 'text-blue-400'   },
    green:  { ring: 'ring-green-500/20',  bg: 'bg-green-500/10',  text: 'text-[var(--green)]'  },
    amber:  { ring: 'ring-amber-500/20',  bg: 'bg-amber-500/10',  text: 'text-amber-400'  },
    purple: { ring: 'ring-purple-500/20', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    red:    { ring: 'ring-red-500/20',    bg: 'bg-red-500/10',    text: 'text-[var(--red)]'    },
    cyan:   { ring: 'ring-cyan-500/20',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400'   },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`rounded-2xl p-5 ring-1 ${c.ring} transition-colors`} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={17} className={c.text} />
        </div>
        {trend != null && (
          <span className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: trend >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={valueStyle || { color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{sub}</p>}
    </div>
  );
}

// -- OverviewTab ---------------------------------------------------------------
export default function OverviewTab({ data, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm animate-pulse">
        Loading portfolio data...
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

  const slices = positions
    .filter(p => Number(p.value || 0) > 0)
    .slice(0, 8)
    .map((p, i) => ({
      label: p.symbol?.replace('USDT', '') || p.symbol,
      value: Number(p.value || 0),
      color: PALETTE[i % PALETTE.length],
    }));

  if (balance > 0 && slices.length < 8) {
    slices.push({ label: 'USDT', value: balance, color: '#475569' });
  }

  const chartTotal = slices.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-6">

      {/* Portfolio hero */}
      <div className="relative bg-gradient-to-br from-blue-950/60 via-[var(--bg-secondary)] to-purple-950/30 border border-[var(--border-primary)] rounded-2xl p-6 overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-end gap-6">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Total Portfolio Value</p>
            <p className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {fmtUSD(totalValue)}
            </p>
            <div className="flex items-center gap-2 mt-2 text-sm font-semibold" style={{ color: pnlUp ? 'var(--green)' : 'var(--red)' }}>
              {pnlUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span>{pnlUp ? '+' : ''}{fmtUSD(totalPnL)}</span>
              <span style={{ color: 'var(--text-dim)' }}>·</span>
              <span>{fmtPct(totalPnLPercent)}</span>
              <span className="font-normal text-xs" style={{ color: 'var(--text-dim)' }}>vs $100K start</span>
            </div>
          </div>

          <div className="sm:ml-auto flex gap-6 text-right">
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Available Cash</p>
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmtUSD(balance)}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>In Positions</p>
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmtUSD(positionsValue)}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Unrealized PNL</p>
              <p className="font-bold" style={{ color: unrealizedPnL >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {unrealizedPnL >= 0 ? '+' : ''}{fmtUSD(unrealizedPnL)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`}
          sub={`${winningTrades} / ${closedTrades} trades`}
          icon={Target}
          color={closedTrades === 0 ? 'blue' : winRate >= 50 ? 'green' : 'red'}
          valueStyle={closedTrades === 0 ? undefined : { color: winRate >= 50 ? 'var(--green)' : 'var(--red)' }} />
        <StatCard label="Realized PNL" value={fmtUSD(realizedPnL)}
          sub="From closed trades"
          icon={Award}
          color={realizedPnL >= 0 ? 'green' : 'red'}
          valueStyle={{ color: realizedPnL >= 0 ? 'var(--green)' : 'var(--red)' }}
          trend={realizedPnL >= 0 ? Math.abs(realizedPnL / 100) : -Math.abs(realizedPnL / 100)} />
        <StatCard label="Sharpe Ratio" value={closedTrades >= 2 ? Number(sharpeRatio).toFixed(2) : '\u2014'}
          sub={closedTrades >= 2 ? 'Per-trade risk-adjusted return' : 'Needs 2+ closed trades'}
          icon={Zap}
          color={closedTrades < 2 ? 'cyan' : Number(sharpeRatio) >= 0 ? 'cyan' : 'red'}
          valueStyle={closedTrades < 2 ? { color: 'var(--text-muted)' } : { color: Number(sharpeRatio) >= 0 ? 'var(--accent-text)' : 'var(--red)' }} />
        <StatCard label="Max Drawdown" value={maxDrawdown > 0 ? fmtPct(-maxDrawdown, false) : '0.00%'}
          sub="Worst peak-to-trough"
          icon={AlertTriangle}
          color={maxDrawdown > 0 ? 'red' : 'green'}
          valueStyle={{ color: maxDrawdown > 0 ? 'var(--red)' : 'var(--green)' }} />
      </div>

      {/* Chart + Allocation */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut chart card */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-6">Asset Allocation</h3>

          {slices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-dim)] text-sm">
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
                      <span className="text-xs font-medium text-[var(--text-secondary)]">{s.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{chartTotal > 0 ? ((s.value / chartTotal) * 100).toFixed(1) : 0}%</span>
                      <span className="text-[10px] text-[var(--text-dim)] ml-1">{fmtUSD(s.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Open positions card */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Open Positions</h3>

          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-dim)] text-sm">
              <BarChart3 size={32} className="mb-3 opacity-40" />
              No open positions
            </div>
          ) : (
            <div className="space-y-1">
              {positions.slice(0, 6).map((p, i) => {
                const pnlUp = Number(p.pnl || 0) >= 0;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold text-blue-300">
                        {p.symbol?.replace('USDT', '').slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{p.symbol?.replace('USDT', '')}<span className="text-[var(--text-dim)] font-normal">/USDT</span></p>
                        <p className="text-[11px] text-[var(--text-dim)]">{Number(p.quantity || 0).toFixed(4)} qty · @{fmtUSD(p.avgCost ?? p.entryPrice)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{fmtUSD(p.value)}</p>
                      <p className={`text-[11px] font-medium ${pnlUp ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                        {pnlUp ? '+' : ''}{fmtUSD(p.pnl)} ({fmtPct(p.pnlPercent)})
                      </p>
                    </div>
                  </div>
                );
              })}
              {positions.length > 6 && (
                <p className="text-center text-[var(--text-dim)] text-xs pt-2">+{positions.length - 6} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Recent Transactions</h3>
          <span className="text-[10px] text-[var(--text-dim)]">{trades.length} total</span>
        </div>

        {recentTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-dim)] text-sm">
            <Clock size={32} className="mb-3 opacity-40" />
            No transactions yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  {['Type', 'Asset', 'Amount', 'Price', 'Total', 'PNL', 'Date'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-[10px] text-[var(--text-dim)] uppercase tracking-widest font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t, i) => {
                  const isBuy = t.type === 'buy';
                  const hasPnl = t.realizedPnL != null && Number(t.realizedPnL) !== 0;
                  return (
                    <tr key={t.id || i} className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          isBuy ? 'bg-green-500/15 text-[var(--green)]' : 'bg-red-500/15 text-[var(--red)]'
                        }`}>
                          {isBuy ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {t.type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[9px] font-bold text-blue-300">
                            {t.symbol?.replace('USDT', '').slice(0, 3)}
                          </div>
                          <span className="text-sm font-medium text-[var(--text-primary)]">{t.symbol?.replace('USDT', '')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-[var(--text-secondary)]">{Number(t.quantity || 0).toFixed(4)}</td>
                      <td className="px-6 py-3.5 text-sm text-[var(--text-secondary)]">{fmtUSD(t.price)}</td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-[var(--text-primary)]">{fmtUSD(t.total)}</td>
                      <td className="px-6 py-3.5 text-sm">
                        {hasPnl ? (
                          <span className={`font-semibold ${Number(t.realizedPnL) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                            {Number(t.realizedPnL) >= 0 ? '+' : ''}{fmtUSD(t.realizedPnL)}
                          </span>
                        ) : <span className="text-[var(--text-dim)]">{'\u2014'}</span>}
                      </td>
                      <td className="px-6 py-3.5 text-[11px] text-[var(--text-dim)]">{fmtTime(t.timestamp)}</td>
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
