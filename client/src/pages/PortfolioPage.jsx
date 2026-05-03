import { useEffect, useMemo, useState } from 'react';
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

  const chartPoints = useMemo(() => {
    if (!performance.length) return [];
    const values = performance.map(point => Number(point.value || 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return performance.map((point, index) => ({
      ...point,
      left: performance.length === 1 ? 50 : (index / (performance.length - 1)) * 100,
      top: 100 - (((Number(point.value || 0) - min) / range) * 80 + 10),
    }));
  }, [performance]);

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
          <MetricCard icon={Target} label="Max Drawdown" value={percent(portfolio?.maxDrawdown)} detail="demo metric" tone="rose" />
          <MetricCard icon={Activity} label="Win Rate" value={percent(portfolio?.winRate)} detail={`${portfolio?.winningTrades ?? 0}/${portfolio?.closedTrades ?? 0} closed trades`} tone="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[350px]">
            <h2 className="text-white font-bold mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
              <TrendingUp size={16} /> Equity Curve
            </h2>
            <div className="relative h-64 bg-[#020617]/50 rounded-xl border border-slate-800 overflow-hidden">
              {chartPoints.length < 2 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-sm font-mono">
                  Place a demo trade to start the equity curve.
                </div>
              ) : (
                chartPoints.map((point, index) => (
                  <div
                    key={`${point.date}-${index}`}
                    className="absolute h-2 w-2 -ml-1 -mt-1 rounded-full bg-blue-400 shadow-lg shadow-blue-500/30"
                    style={{ left: `${point.left}%`, top: `${point.top}%` }}
                    title={`${formatDate(point.date)} - ${money(point.value)}`}
                  />
                ))
              )}
            </div>
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
                        <p className="text-[10px] text-slate-600 font-mono">Avg {money(pos.entryPrice)}</p>
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
