import { Wallet } from 'lucide-react';
import { PALETTE, fmtUSD, fmtPct } from './formatters';

export default function PortfolioTab({ data }) {
  const positions = data?.positions || [];
  const totalValue = data?.totalValue || 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">All Positions</h3>
        <span className="text-[10px] text-[var(--text-dim)]">{positions.length} open</span>
      </div>
      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-dim)] text-sm">
          <Wallet size={36} className="mb-3 opacity-40" />
          No open positions. Start trading to build your portfolio.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                {['Asset', 'Quantity', 'Avg Entry', 'Current Price', 'Value', 'Unrealized PNL', 'Allocation'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-[10px] text-[var(--text-dim)] uppercase tracking-widest font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const pnlUp = Number(p.pnl || 0) >= 0;
                const alloc = totalValue > 0 ? ((Number(p.value || 0) / totalValue) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={i} className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]"
                          style={{ background: PALETTE[i % PALETTE.length] + '33', border: `1px solid ${PALETTE[i % PALETTE.length]}44` }}>
                          {p.symbol?.replace('USDT', '').slice(0, 4)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{p.symbol?.replace('USDT', '')}<span className="text-[var(--text-dim)]">/USDT</span></p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{Number(p.quantity || 0).toFixed(4)}</td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{fmtUSD(p.avgCost ?? p.entryPrice)}</td>
                    <td className="px-6 py-4 text-sm text-[var(--text-primary)] font-medium">{fmtUSD(p.currentPrice)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{fmtUSD(p.value)}</td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-semibold ${pnlUp ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                        {pnlUp ? '+' : ''}{fmtUSD(p.pnl)}
                        <span className="text-[11px] ml-1 opacity-70">({fmtPct(p.pnlPercent)})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden w-20">
                          <div className="h-full rounded-full" style={{ width: `${alloc}%`, background: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">{alloc}%</span>
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
