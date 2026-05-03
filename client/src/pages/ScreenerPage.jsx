import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowDownRight, ArrowUpRight, Eye, Search } from 'lucide-react';
import APIClient from '../services/APIClient';

const TABS = [
  { id: 'top-gainers', label: 'Top Gainers' },
  { id: 'top-losers', label: 'Top Losers' },
  { id: 'highest-volume', label: 'Highest Volume' },
  { id: 'rsi-overbought', label: 'RSI Overbought' },
  { id: 'rsi-oversold', label: 'RSI Oversold' },
];

function formatSymbol(symbol) {
  return String(symbol || '').replace('USDT', '/USDT');
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';

  return number.toLocaleString('en-US', {
    minimumFractionDigits: number >= 100 ? 2 : 4,
    maximumFractionDigits: number >= 100 ? 2 : 6,
  });
}

function compact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';

  return number.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  });
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function rsiTone(value) {
  const rsi = Number(value);
  if (rsi >= 70) return 'bg-red-500/10 text-red-400';
  if (rsi <= 30) return 'bg-emerald-500/10 text-emerald-400';
  return 'bg-blue-500/10 text-blue-400';
}

export default function ScreenerPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('top-gainers');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queryStats, setQueryStats] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadScreener = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await APIClient.get('/screener', {
          params: { tab: activeTab, limit: 10 },
        });

        if (!cancelled) {
          setRows(Array.isArray(res.data.symbols) ? res.data.symbols : []);
          setQueryStats({
            queryTime: res.data.queryTime,
            rowsScanned: res.data.rowsScanned,
          });
        }
      } catch (err) {
        console.error('Screener load error:', err);
        if (!cancelled) {
          setRows([]);
          setQueryStats(null);
          setError('Data temporarily unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadScreener();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(row => row.symbol?.toLowerCase().includes(term));
  }, [rows, search]);

  const showRsi = activeTab === 'rsi-overbought' || activeTab === 'rsi-oversold';

  return (
    <div className="bg-[#020617] min-h-screen text-slate-300 p-6 pb-20">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="text-blue-500" size={20} /> Market Screener
          </h1>

          <div className="flex flex-wrap gap-2 bg-[#0f172a] p-1.5 rounded-xl border border-slate-800 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-t-2xl p-4 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search loaded symbols..."
              className="w-full bg-[#020617] border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-slate-500 rounded-full" /> Snapshot
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/40 border-x border-red-900 px-6 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="bg-[#0f172a] border border-slate-800 border-t-0 rounded-b-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-[10px] uppercase tracking-[0.15em] text-slate-500 border-b border-slate-800">
                <th className="px-6 py-4 font-bold">#</th>
                <th className="px-6 py-4 font-bold">Symbol</th>
                <th className="px-6 py-4 font-bold">Current Price</th>
                <th className="px-6 py-4 font-bold">24h % Change</th>
                <th className="px-6 py-4 font-bold">Volume</th>
                {showRsi && <th className="px-6 py-4 font-bold">RSI</th>}
                <th className="px-6 py-4 font-bold text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredRows.map((item, index) => {
                const up = Number(item.change24h) >= 0;
                return (
                  <tr
                    key={item.symbol}
                    onClick={() => navigate(`/?symbol=${encodeURIComponent(item.symbol)}`)}
                    className="hover:bg-blue-600/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-slate-600 text-xs">{index + 1}</td>
                    <td className="px-6 py-4 font-bold text-white group-hover:text-blue-400 transition-colors">
                      {formatSymbol(item.symbol)}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">${money(item.currentPrice)}</td>
                    <td className={`px-6 py-4 text-sm font-bold ${up ? 'text-green-500' : 'text-red-500'}`}>
                      <div className="flex items-center gap-1">
                        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {percent(item.change24h)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                      {compact(item.volume24h)}
                    </td>
                    {showRsi && (
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${rsiTone(item.rsi)}`}>
                          {Number(item.rsi).toFixed(2)}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <button
                        className="p-2 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-slate-500"
                        title="Open Chart"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="px-6 py-16 text-center text-slate-500 font-medium">
              Loading snapshot...
            </div>
          )}

          {!loading && filteredRows.length === 0 && !error && (
            <div className="px-6 py-16 text-center text-slate-500 font-medium">
              No symbols matched this screen.
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-between items-center px-2 text-[10px] text-slate-600 uppercase tracking-widest">
          <span>{queryStats ? `${queryStats.queryTime} | ${Number(queryStats.rowsScanned || 0).toLocaleString()} rows scanned` : 'Snapshot query'}</span>
          <span>Last sync: {queryStats ? new Date().toLocaleTimeString() : '-'}</span>
        </div>
      </div>
    </div>
  );
}
