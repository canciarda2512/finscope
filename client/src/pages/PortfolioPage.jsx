import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Briefcase, Clock, Search, Target, TrendingUp, Wallet
} from 'lucide-react';
import APIClient from '../services/APIClient';
import { usePortfolio } from '../context/PortfolioContext';

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

function shortDate(value) {
  if (!value || value === 'Start' || value === 'Now') return value || '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PortfolioPage() {
  const { portfolio, loading: portfolioLoading } = usePortfolio();
  const [performance, setPerformance] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPerformance = async () => {
      try {
        const res = await APIClient.get('/portfolio/performance');
        if (!cancelled) setPerformance(res.data.datapoints || []);
      } catch (err) {
        if (!cancelled) {
          console.error('Performance load error:', err);
          setError(err.response?.data?.message || 'Performance data could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPerformance();
    const intervalId = window.setInterval(loadPerformance, 30000);

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
    <div className="min-h-screen p-6 pb-24" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Portfolio Analysis</h1>
          <p className="text-sm mt-1 italic" style={{ color: 'var(--text-muted)' }}>
            Demo account start balance: {money(portfolio?.startBalance ?? 100000)}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ border: '1px solid var(--red)', backgroundColor: 'var(--red-muted)', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Loading portfolio...</div>
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
                ? 'Peak-to-trough realized decline'
                : 'No drawdown recorded yet'
            }
            tone="rose"
          />
          <MetricCard icon={Activity} label="Win Rate" value={percent(portfolio?.winRate)} detail={`${portfolio?.winningTrades ?? 0}/${portfolio?.closedTrades ?? 0} closed trades`} tone="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <div className="px-6 pt-5 pb-2 flex items-start justify-between">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <TrendingUp size={13} /> Equity Curve
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>Realized P&L + unrealized at market price</p>
              </div>
              {performance.length >= 2 && (() => {
                const lastVal = Number(performance[performance.length - 1]?.value ?? 0);
                const start = portfolio?.startBalance ?? 100000;
                const diff = lastVal - start;
                const pct = (diff / start) * 100;
                const up = diff >= 0;
                return (
                  <div className="text-right">
                    <p className="font-bold text-xl leading-tight" style={{ color: 'var(--text-primary)' }}>{money(lastVal)}</p>
                    <p className="text-xs font-semibold" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                      {up ? '+' : ''}{money(diff)} ({up ? '+' : ''}{pct.toFixed(2)}%)
                    </p>
                  </div>
                );
              })()}
            </div>
            <div className="px-2 pb-4">
              <EquityChart performance={performance} startBalance={portfolio?.startBalance ?? 100000} />
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <div className="p-5" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
              <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Open Positions</h2>
            </div>
            <table className="w-full text-left">
              <tbody>
                {positions.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-xs" style={{ color: 'var(--text-dim)' }}>No open positions yet.</td>
                  </tr>
                )}
                {positions.map((pos) => {
                  const up = Number(pos.pnl || 0) >= 0;
                  return (
                    <tr key={pos.symbol} className="transition group" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>{pos.symbol.replace('USDT', '/USDT')}</p>
                        <p className="text-[10px] font-mono italic" style={{ color: 'var(--text-muted)' }}>{number(pos.quantity)} units</p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>Avg {money(pos.avgCost ?? pos.entryPrice)}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="text-sm font-bold" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>{money(pos.pnl)}</p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{percent(pos.pnlPercent)}</p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>Now {money(pos.currentPrice)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div className="p-5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
            <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Clock size={16} style={{ color: 'var(--accent)' }} /> Trade History
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-dim)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search history..."
                className="rounded-lg py-1 pl-9 pr-4 text-xs outline-none transition"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase font-bold tracking-[0.2em]" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
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
              <tbody>
                {filteredTrades.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
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
                    <tr key={trade.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td className="px-6 py-4 text-xs font-mono" style={{ color: 'var(--text-dim)' }}>{index + 1}</td>
                      <td className="px-6 py-4 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatDate(trade.timestamp)}</td>
                      <td className="px-6 py-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{trade.symbol?.replace('USDT', '/USDT')}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${side === 'BUY' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                          {side}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{number(trade.quantity)}</td>
                      <td className="px-6 py-4 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{money(trade.price)}</td>
                      <td className="px-6 py-4 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{money(trade.total)}</td>
                      <td className="px-6 py-4 text-right text-xs font-bold" style={{
                        color: !hasRealizedPnL ? 'var(--text-secondary)' : realizedUp ? 'var(--green)' : 'var(--red)',
                      }}>
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

function EquityChart({ performance, startBalance }) {
  const [tip, setTip] = useState(null);
  const svgRef = useRef(null);

  const VW = 640, VH = 220;
  const PL = 62, PR = 16, PT = 14, PB = 32;
  const CW = VW - PL - PR, CH = VH - PT - PB;

  if (!performance || performance.length < 2) {
    return (
      <div className="h-52 flex flex-col items-center justify-center gap-3">
        <TrendingUp size={32} strokeWidth={1.5} style={{ color: 'var(--text-dim)' }} />
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Place a demo trade to build your equity curve</p>
      </div>
    );
  }

  const values = performance.map(p => Number(p.value));
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const spread = maxV - minV;
  const pad = spread > 0 ? spread * 0.22 : (startBalance * 0.04 || 2000);
  const yMin = minV - pad, yMax = maxV + pad, yRange = yMax - yMin;

  const toX = i => PL + (i / Math.max(performance.length - 1, 1)) * CW;
  const toY = v => PT + CH - ((v - yMin) / yRange) * CH;
  const pts = performance.map((p, i) => ({ x: toX(i), y: toY(Number(p.value)) }));

  // Smooth cubic bezier (midpoint control points)
  let linePath = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const { x: x0, y: y0 } = pts[i - 1];
    const { x: x1, y: y1 } = pts[i];
    const cpx = (x0 + x1) / 2;
    linePath += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  const firstPt = pts[0], lastPt = pts[pts.length - 1];
  const areaPath = `${linePath} L ${lastPt.x},${PT + CH} L ${firstPt.x},${PT + CH} Z`;

  const lastVal = values[values.length - 1];
  const isUp = lastVal >= startBalance;
  const color = isUp ? '#34d399' : '#f87171';
  const gid = `eqg${isUp ? 'u' : 'd'}`;

  // Y ticks (4 levels, bottom → top)
  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const v = yMin + (yRange * i) / 3;
    return { v, y: toY(v) };
  }).reverse();

  // X labels: start + 1 middle + end
  const n = performance.length;
  const xIdxs = [...new Set([0, n > 3 ? Math.round(n / 2) : null, n - 1].filter(v => v !== null))];

  const fmtY = v => {
    const abs = Math.abs(v);
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };
  const fmtX = s => {
    if (!s || s === 'Start') return 'Start';
    if (s === 'Now') return 'Now';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * VW;
    const frac = Math.max(0, Math.min(1, (mx - PL) / CW));
    const idx = Math.round(frac * (n - 1));
    const val = Number(performance[idx].value);
    const diff = val - startBalance;
    setTip({ x: pts[idx].x, y: pts[idx].y, val, date: performance[idx].date, diff, pct: (diff / startBalance) * 100 });
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="w-full select-none"
      style={{ height: '220px' }} onMouseMove={handleMove} onMouseLeave={() => setTip(null)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="70%"  stopColor={color} stopOpacity="0.06" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="eq-glow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="eq-clip">
          <rect x={PL} y={PT} width={CW} height={CH} />
        </clipPath>
      </defs>

      {/* Y gridlines + labels */}
      {yTicks.map(({ v, y }, i) => (
        <g key={i}>
          <line x1={PL} y1={y} x2={PL + CW} y2={y} stroke="#1e293b" strokeWidth="1" />
          <text x={PL - 8} y={y} textAnchor="end" dominantBaseline="middle"
            fill="#334155" fontSize="10.5" fontFamily="monospace">{fmtY(v)}</text>
        </g>
      ))}

      {/* Start-balance dashed reference */}
      {startBalance >= yMin && startBalance <= yMax && (
        <line x1={PL} y1={toY(startBalance)} x2={PL + CW} y2={toY(startBalance)}
          stroke="#334155" strokeWidth="1" strokeDasharray="5,4" />
      )}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gid})`} clipPath="url(#eq-clip)" />

      {/* Curve */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" clipPath="url(#eq-clip)" />

      {/* Start dot */}
      <circle cx={firstPt.x} cy={firstPt.y} r="3" fill={color} stroke="#0f172a" strokeWidth="2" />

      {/* End dot (glowing) */}
      <circle cx={lastPt.x} cy={lastPt.y} r="5.5" fill={color} stroke="#0f172a" strokeWidth="2"
        filter="url(#eq-glow)" />

      {/* X-axis labels */}
      {xIdxs.map(i => (
        <text key={i} x={toX(i)} y={PT + CH + 18}
          textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          fill="#475569" fontSize="10" fontFamily="system-ui, sans-serif">
          {fmtX(performance[i].date)}
        </text>
      ))}

      {/* Hover crosshair + tooltip */}
      {tip && (() => {
        const BW = 152, BH = 54;
        const bx = tip.x + 14 + BW > PL + CW ? tip.x - BW - 14 : tip.x + 14;
        const by = Math.max(PT, Math.min(PT + CH - BH, tip.y - BH / 2));
        const tc = tip.diff >= 0 ? '#34d399' : '#f87171';
        return (
          <g>
            <line x1={tip.x} y1={PT} x2={tip.x} y2={PT + CH}
              stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={tip.x} cy={tip.y} r="5" fill={color} stroke="#0f172a" strokeWidth="2" />
            <rect x={bx} y={by} width={BW} height={BH} rx="8"
              fill="#1e293b" stroke="#334155" strokeWidth="1" />
            <text x={bx + 12} y={by + 17} fill="#64748b" fontSize="9.5" fontFamily="system-ui">{fmtX(tip.date)}</text>
            <text x={bx + 12} y={by + 38} fill="#f1f5f9" fontSize="15"
              fontWeight="bold" fontFamily="monospace">{fmtY(tip.val)}</text>
            <text x={bx + BW - 12} y={by + 38} textAnchor="end"
              fill={tc} fontSize="11" fontFamily="system-ui">
              {tip.diff >= 0 ? '+' : ''}{tip.pct.toFixed(2)}%
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  const toneClass = {
    white: 'text-[var(--text-primary)]',
    emerald: 'text-emerald-400',
    rose: 'text-rose-500',
    blue: 'text-blue-400',
  }[tone] || 'text-[var(--text-primary)]';

  return (
    <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
        <Icon size={12} /> {label}
      </p>
      <div className={`text-2xl font-bold mb-2 ${toneClass}`}>{value}</div>
      <div className="text-[11px] font-medium italic" style={{ color: 'var(--text-muted)' }}>{detail}</div>
    </div>
  );
}
