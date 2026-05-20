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
  if (rsi >= 70) return { backgroundColor: 'var(--red-muted)', color: 'var(--red)' };
  if (rsi <= 30) return { backgroundColor: 'var(--green-muted)', color: 'var(--green)' };
  return { backgroundColor: 'var(--accent-muted)', color: 'var(--accent-text)' };
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
    <div className="min-h-screen p-6 pb-20" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Activity size={20} style={{ color: 'var(--accent)' }} /> Market Screener
          </h1>

          <div className="flex flex-wrap gap-2 p-1.5 rounded-xl w-fit" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-t-2xl p-4 flex items-center justify-between gap-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search loaded symbols..."
              className="w-full rounded-xl py-2 pl-10 pr-4 text-sm outline-none transition-all"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} /> Snapshot
            </span>
          </div>
        </div>

        {error && (
          <div className="border-x px-6 py-3 text-sm" style={{ backgroundColor: 'var(--red-muted)', borderColor: 'var(--red)', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <div className="border-t-0 rounded-b-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderTop: 'none' }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
                <th className="px-6 py-4 font-bold">#</th>
                <th className="px-6 py-4 font-bold">Symbol</th>
                <th className="px-6 py-4 font-bold">Current Price</th>
                <th className="px-6 py-4 font-bold">24h % Change</th>
                <th className="px-6 py-4 font-bold">Volume (USDT, 24h)</th>
                {showRsi && <th className="px-6 py-4 font-bold">RSI</th>}
                <th className="px-6 py-4 font-bold text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((item, index) => {
                const up = Number(item.change24h) >= 0;
                return (
                  <tr
                    key={item.symbol}
                    onClick={() => navigate(`/?symbol=${encodeURIComponent(item.symbol)}`)}
                    className="transition-colors group cursor-pointer" style={{ borderBottom: '1px solid var(--border-primary)' }}
                  >
                    <td className="px-6 py-4 text-xs" style={{ color: 'var(--text-dim)' }}>{index + 1}</td>
                    <td className="px-6 py-4 font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {formatSymbol(item.symbol)}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">${money(item.currentPrice)}</td>
                    <td className="px-6 py-4 text-sm font-bold" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                      <div className="flex items-center gap-1">
                        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {percent(item.change24h)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                      {compact(item.volume24h)}
                    </td>
                    {showRsi && (
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={rsiTone(item.rsi)}>
                          {Number(item.rsi).toFixed(2)}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <button
                        className="p-2 rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}
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
            <div className="px-6 py-16 text-center font-medium" style={{ color: 'var(--text-muted)' }}>
              Loading snapshot...
            </div>
          )}

          {!loading && filteredRows.length === 0 && !error && (
            <div className="px-6 py-16 text-center font-medium" style={{ color: 'var(--text-muted)' }}>
              No symbols matched this screen.
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-between items-center px-2 text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          <span>{queryStats ? `${queryStats.queryTime} | ${Number(queryStats.rowsScanned || 0).toLocaleString()} rows scanned` : 'Snapshot query'}</span>
          <span>Last sync: {queryStats ? new Date().toLocaleTimeString() : '-'}</span>
        </div>
      </div>
    </div>
  );
}
