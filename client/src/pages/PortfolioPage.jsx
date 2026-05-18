import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Briefcase, Clock, Search, Target, TrendingUp, Wallet
} from 'lucide-react';
import APIClient from '../services/APIClient';

function money(value) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

function number(value, digits = 6) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: digits,
  });
}

function percent(value) {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-US');
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      setError('');

      try {
        const [portfolioRes, performanceRes] = await Promise.all([
          APIClient.get('/portfolio'),
          APIClient.get('/portfolio/performance'),
        ]);

        if (!cancelled) {
          setPortfolio(portfolioRes.data);
          setPerformance(performanceRes.data.datapoints || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Portfolio load error:', err);
          setError(err.response?.data?.message || 'Portfolio could not be loaded.');
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    loadPortfolio(true);
    const intervalId = window.setInterval(() => loadPortfolio(false), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredTrades = useMemo(() => {
    const trades = portfolio?.trades || [];
    const term = search.trim().toLowerCase();
    if (!term) return trades;
    return trades.filter(trade => trade.symbol?.toLowerCase().includes(term) || trade.type?.toLowerCase().includes(term));
  }, [portfolio, search]);

  const pnlUp = Number(portfolio?.totalPnL || 0) >= 0;
  const positions = portfolio?.positions || [];

  return (
    <div className="bg-[#020617] min-h-screen p-6 text-slate-300 pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Portfolio Analysis</h1>
          <p className="text-slate-500 text-sm mt-1 italic">
            Demo account start balance: {money(portfolio?.startBalance ?? 100000)}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-4 text-sm text-slate-500">Loading portfolio...</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <MetricCard icon={Wallet} label="Total Value" value={money(portfolio?.totalValue)} detail={`${money(portfolio?.cash)} cash`} tone="white" />
          <MetricCard icon={TrendingUp} label="Total P&L" value={percent(portfolio?.totalPnLPercent)} detail={`${money(portfolio?.realizedPnL)} realized`} tone={pnlUp ? 'emerald' : 'rose'} />
          <MetricCard icon={Briefcase} label="Positions Value" value={money(portfolio?.positionsValue)} detail={`${positions.length} open positions`} tone="white" />
          <MetricCard
            icon={Target}
            label="Max Drawdown"
            value={
              portfolio?.maxDrawdown > 0
                ? `−${Number(portfolio.maxDrawdown).toFixed(2)}%`
                : '0.00%'
            }
            detail={
              portfolio?.maxDrawdown > 0
                ? 'Peak-to-trough equity decline'
                : 'No drawdown yet'
            }
            tone="rose"
          />
          <MetricCard
            icon={Activity}
            label="Win Rate"
            value={
              portfolio?.closedTrades > 0
                ? `${Number(portfolio.winRate).toFixed(1)}%`
                : '—'
            }
            detail={
              portfolio?.closedTrades > 0
                ? `${portfolio.winningTrades} wins / ${portfolio.closedTrades} closed`
                : 'No closed trades yet'
            }
            tone={
              portfolio?.closedTrades === 0   ? 'white'
              : portfolio?.winRate >= 50       ? 'blue'
              :                                  'rose'
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-white font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                  <TrendingUp size={16} /> Equity Curve
                </h2>
                <p className="text-slate-600 text-[11px] mt-0.5">Portfolio value over each trade · Y = USD · X = trade date</p>
              </div>
              {performance.length >= 2 && (() => {
                const lastVal  = Number(performance[performance.length - 1]?.value ?? 0);
                const startBal = portfolio?.startBalance ?? 100000;
                const diff     = lastVal - startBal;
                const pct      = (diff / startBal) * 100;
                const up       = diff >= 0;
                return (
                  <div className="text-right">
                    <p className="text-white font-bold text-lg leading-tight">{money(lastVal)}</p>
                    <p className={`text-xs font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {up ? '+' : ''}{money(diff)} ({up ? '+' : ''}{pct.toFixed(2)}%)
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Chart */}
            <EquityChart performance={performance} startBalance={portfolio?.startBalance ?? 100000} />
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 bg-slate-900/30">
              <h2 className="text-white font-bold text-xs uppercase tracking-widest">Open Positions</h2>
            </div>
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-800/50">
                {positions.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-xs text-slate-600">No open positions yet.</td>
                  </tr>
                )}
                {positions.map((pos) => {
                  const up = Number(pos.pnl || 0) >= 0;
                  return (
                    <tr key={pos.symbol} className="hover:bg-slate-800/30 transition group">
                      <td className="px-5 py-4">
                        <p className="font-bold text-white text-sm tracking-tight">{pos.symbol.replace('USDT', '/USDT')}</p>
                        <p className="text-[10px] text-slate-500 font-mono italic">{number(pos.quantity)} units</p>
                        <p className="text-[10px] text-slate-600 font-mono">Avg {money(pos.avgCost ?? pos.entryPrice)}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className={`text-sm font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{money(pos.pnl)}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{percent(pos.pnlPercent)}</p>
                        <p className="text-[10px] text-slate-600 font-mono">Now {money(pos.currentPrice)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
            <h2 className="text-white font-bold text-sm flex items-center gap-2 underline decoration-blue-500 decoration-2 underline-offset-8">
              <Clock size={16} className="text-blue-500" /> Trade History
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search history..."
                className="bg-[#020617] border border-slate-700 rounded-lg py-1 pl-9 pr-4 text-xs focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#020617]/50 text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 border-b border-slate-800">
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Side</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4 text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredTrades.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-xs text-slate-600">
                      No trade history yet.
                    </td>
                  </tr>
                )}
                {filteredTrades.map((trade, index) => {
                  const side = String(trade.type || '').toUpperCase();
                  const realizedPnL = trade.realizedPnL;
                  const hasRealizedPnL = realizedPnL !== null && realizedPnL !== undefined;
                  const realizedUp = Number(realizedPnL || 0) >= 0;
                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-600 font-mono">{index + 1}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{formatDate(trade.timestamp)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-white">{trade.symbol?.replace('USDT', '/USDT')}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${side === 'BUY' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                          {side}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">{number(trade.quantity)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-300">{money(trade.price)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-300">{money(trade.total)}</td>
                      <td className={`px-6 py-4 text-right text-xs font-bold ${
                        !hasRealizedPnL ? 'text-slate-500' : realizedUp ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {hasRealizedPnL ? money(realizedPnL) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Equity Curve ─────────────────────────────────────────────────────────────
function EquityChart({ performance, startBalance }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  if (!performance || performance.length < 2) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-2 text-slate-600">
        <TrendingUp size={28} className="opacity-25" />
        <span className="text-sm">Place a demo trade to build your equity curve</span>
      </div>
    );
  }

  // ── Layout constants ──────────────────────────────────────────
  const VW = 620, VH = 230;
  const PL = 68, PR = 16, PT = 14, PB = 38;
  const CW = VW - PL - PR, CH = VH - PT - PB;

  // ── Value range with padding ──────────────────────────────────
  const values = performance.map(p => Number(p.value));
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const vPad = (maxV - minV) * 0.15 || maxV * 0.05 || 1000;
  const yMin = minV - vPad;
  const yMax = maxV + vPad;
  const yRange = yMax - yMin;

  const toX = i => PL + (i / (performance.length - 1)) * CW;
  const toY = v => PT + CH - ((v - yMin) / yRange) * CH;

  // ── SVG paths ─────────────────────────────────────────────────
  const linePath = 'M ' + performance.map((p, i) => `${toX(i)} ${toY(Number(p.value))}`).join(' L ');
  const areaPath = linePath + ` L ${toX(performance.length - 1)} ${PT + CH} L ${PL} ${PT + CH} Z`;

  const lastVal  = values[values.length - 1];
  const isUp     = lastVal >= startBalance;
  const stroke   = isUp ? '#4ade80' : '#f87171';

  // ── Y-axis ticks ─────────────────────────────────────────────
  const N_Y = 5;
  const yTicks = Array.from({ length: N_Y }, (_, i) => yMin + (yRange / (N_Y - 1)) * i);

  // ── X-axis ticks (evenly spaced, always include first & last) ─
  const N_X = Math.min(6, performance.length);
  const xIdxs = performance.length <= N_X
    ? performance.map((_, i) => i)
    : Array.from({ length: N_X }, (_, i) => Math.round((i * (performance.length - 1)) / (N_X - 1)));

  const fmtY = v => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  const fmtDate = s => {
    if (!s || s === 'Start') return 'Start';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── Hover handler ─────────────────────────────────────────────
  const handleMouseMove = e => {
    if (!svgRef.current) return;
    const rect  = svgRef.current.getBoundingClientRect();
    const scaleX = VW / rect.width;
    const mx     = (e.clientX - rect.left) * scaleX;
    const frac   = Math.max(0, Math.min(1, (mx - PL) / CW));
    const idx    = Math.round(frac * (performance.length - 1));
    const pt     = performance[idx];
    setTooltip({ x: toX(idx), y: toY(Number(pt.value)), value: Number(pt.value), date: pt.date });
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full select-none"
      style={{ height: '230px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
        </linearGradient>
        <clipPath id="eq-clip">
          <rect x={PL} y={PT} width={CW} height={CH} />
        </clipPath>
      </defs>

      {/* ── Y gridlines + labels ── */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PL} y1={toY(v)} x2={PL + CW} y2={toY(v)}
            stroke="#1e293b" strokeWidth="1" />
          <text x={PL - 7} y={toY(v)} textAnchor="end" dominantBaseline="middle"
            fill="#475569" fontSize="10.5" fontFamily="system-ui, sans-serif">
            {fmtY(v)}
          </text>
        </g>
      ))}

      {/* ── Y-axis label ── */}
      <text x={11} y={PT + CH / 2} textAnchor="middle" dominantBaseline="middle"
        fill="#334155" fontSize="9.5" fontFamily="system-ui, sans-serif"
        transform={`rotate(-90,11,${PT + CH / 2})`}>
        Portfolio Value (USD)
      </text>

      {/* ── X tick lines + date labels ── */}
      {xIdxs.map(i => (
        <g key={i}>
          <line x1={toX(i)} y1={PT} x2={toX(i)} y2={PT + CH}
            stroke="#1e293b" strokeWidth="1" strokeDasharray="3,4" opacity="0.6" />
          <text x={toX(i)} y={PT + CH + 16} textAnchor="middle"
            fill="#475569" fontSize="10" fontFamily="system-ui, sans-serif">
            {fmtDate(performance[i].date)}
          </text>
        </g>
      ))}

      {/* ── Start-balance reference line ── */}
      {startBalance >= yMin && startBalance <= yMax && (
        <g>
          <line x1={PL} y1={toY(startBalance)} x2={PL + CW} y2={toY(startBalance)}
            stroke="#64748b" strokeWidth="1.5" strokeDasharray="6,5" opacity="0.55" />
          <rect x={PL + 4} y={toY(startBalance) - 9} width={60} height={14}
            rx="3" fill="#0f172a" />
          <text x={PL + 34} y={toY(startBalance)} textAnchor="middle" dominantBaseline="middle"
            fill="#64748b" fontSize="9" fontFamily="system-ui, sans-serif">
            Start $100K
          </text>
        </g>
      )}

      {/* ── Area fill ── */}
      <path d={areaPath} fill="url(#eq-fill)" clipPath="url(#eq-clip)" />

      {/* ── Line ── */}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" clipPath="url(#eq-clip)" />

      {/* ── Last-value dot ── */}
      <circle cx={toX(performance.length - 1)} cy={toY(lastVal)}
        r="4" fill={stroke} stroke="#0f172a" strokeWidth="2" />

      {/* ── Hover crosshair + tooltip ── */}
      {tooltip && (() => {
        const BOX_W = 148, BOX_H = 52;
        const bx = tooltip.x + 12 + BOX_W > PL + CW ? tooltip.x - BOX_W - 12 : tooltip.x + 12;
        const by = Math.max(PT, Math.min(PT + CH - BOX_H, tooltip.y - BOX_H / 2));
        const diff    = tooltip.value - startBalance;
        const diffPct = (diff / startBalance) * 100;
        return (
          <g>
            {/* crosshair */}
            <line x1={tooltip.x} y1={PT} x2={tooltip.x} y2={PT + CH}
              stroke="#64748b" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
            <circle cx={tooltip.x} cy={tooltip.y} r="5" fill={stroke} stroke="#0f172a" strokeWidth="2" />

            {/* tooltip card */}
            <rect x={bx} y={by} width={BOX_W} height={BOX_H} rx="7"
              fill="#1e293b" stroke="#334155" strokeWidth="1" />
            {/* date */}
            <text x={bx + 10} y={by + 17} fill="#94a3b8" fontSize="9.5"
              fontFamily="system-ui, sans-serif">
              {fmtDate(tooltip.date) || 'Start'}
            </text>
            {/* value */}
            <text x={bx + 10} y={by + 37} fill="#f1f5f9" fontSize="14"
              fontWeight="bold" fontFamily="system-ui, sans-serif">
              {fmtY(tooltip.value)}
            </text>
            {/* change */}
            <text x={bx + BOX_W - 10} y={by + 37} textAnchor="end"
              fill={diff >= 0 ? '#4ade80' : '#f87171'} fontSize="11"
              fontFamily="system-ui, sans-serif">
              {diff >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  const toneClass = {
    white: 'text-white',
    emerald: 'text-emerald-400',
    rose: 'text-rose-500',
    blue: 'text-blue-400',
  }[tone] || 'text-white';

  return (
    <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
        <Icon size={12} /> {label}
      </p>
      <div className={`text-2xl font-bold mb-2 ${toneClass}`}>{value}</div>
      <div className="text-slate-500 text-[11px] font-medium italic">{detail}</div>
    </div>
  );
}
