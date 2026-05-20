import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { fmtUSD, fmtTime } from './formatters';

export default function TransactionsTab({ data }) {
  const [filter, setFilter] = useState('all');
  const trades = data?.trades || [];
  const filtered = filter === 'all' ? trades : trades.filter(t => t.type === filter);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Transaction History</h3>
        <div className="flex gap-1">
          {['all', 'buy', 'sell'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all capitalize ${
                filter === f ? 'bg-blue-600 text-white' : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
              }`}>
              {f === 'all' ? 'All' : f === 'buy' ? 'Buys' : 'Sells'}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-dim)] text-sm">
          <Clock size={36} className="mb-3 opacity-40" />
          No transactions found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                {['Type', 'Asset', 'Quantity', 'Price', 'Total', 'Realized PNL', 'Date'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-[10px] text-[var(--text-dim)] uppercase tracking-widest font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
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
                    <td className="px-6 py-3.5 text-sm font-medium text-[var(--text-primary)]">{t.symbol?.replace('USDT', '')}<span className="text-[var(--text-dim)]">/USDT</span></td>
                    <td className="px-6 py-3.5 text-sm text-[var(--text-secondary)]">{Number(t.quantity || 0).toFixed(4)}</td>
                    <td className="px-6 py-3.5 text-sm text-[var(--text-secondary)]">{fmtUSD(t.price)}</td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-[var(--text-primary)]">{fmtUSD(t.total)}</td>
                    <td className="px-6 py-3.5 text-sm">
                      {hasPnl
                        ? <span className={`font-semibold ${Number(t.realizedPnL) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                            {Number(t.realizedPnL) >= 0 ? '+' : ''}{fmtUSD(t.realizedPnL)}
                          </span>
                        : <span className="text-[var(--text-dim)]">{'\u2014'}</span>
                      }
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
  );
}
