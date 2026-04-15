import React from 'react';
import { 
  Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Briefcase, Target, Activity, Clock, Search
} from 'lucide-react';

const MOCK_POSITIONS = [
  { symbol: 'BTC/USDT', amount: '1.24', avgPrice: '42,000', currentPrice: '64,250', profit: '+$27,590', pnlPercent: '+52.9%', up: true },
  { symbol: 'ETH/USDT', amount: '15.5', avgPrice: '2,100', currentPrice: '3,450', profit: '+$20,925', pnlPercent: '+64.2%', up: true },
];

const MOCK_HISTORY = [
  { id: 1, date: '2024-03-12 14:22', symbol: 'BTC/USDT', side: 'BUY', qty: '0.50', price: '62,100', total: '$31,050', pnl: '-', up: null },
  { id: 2, date: '2024-03-11 09:15', symbol: 'ETH/USDT', side: 'SELL', qty: '2.00', price: '3,850', total: '$7,700', pnl: '+$450', up: true },
  { id: 3, date: '2024-03-10 18:45', symbol: 'SOL/USDT', side: 'SELL', qty: '50.0', price: '145', total: '$7,250', pnl: '-$120', up: false },
];

export default function PortfolioPage() {
  return (
    <div className="bg-[#020617] min-h-screen p-6 text-slate-300 pb-24">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Portfolio Analysis</h1>
          <p className="text-slate-500 text-sm mt-1 italic">Simulation start balance: $100,000.00</p>
        </div>

        {/* 5'li STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Value</p>
            <div className="text-2xl font-bold text-white mb-2">$132,450.00</div>
            <div className="text-emerald-500 text-[11px] font-bold flex items-center gap-1">+$32,450.00 <span className="text-slate-500 font-normal underline">all time</span></div>
          </div>

          <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total P&L</p>
            <div className="text-2xl font-bold text-emerald-400 mb-2">+24.42%</div>
            <div className="text-slate-500 text-[11px] font-medium italic">since start</div>
          </div>

          <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Sharpe Ratio</p>
            <div className="text-2xl font-bold text-white mb-2">1.78</div>
            <div className="text-slate-500 text-[11px] font-medium italic">risk-adjusted</div>
          </div>

          <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Max Drawdown</p>
            <div className="text-2xl font-bold text-rose-500 mb-2">-12.4%</div>
            <div className="text-slate-500 text-[11px] font-medium italic">peak to trough</div>
          </div>

          <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Win Rate</p>
            <div className="text-2xl font-bold text-blue-400 mb-2">64%</div>
            <div className="text-slate-500 text-[11px] font-medium italic">16 of 25 trades</div>
          </div>
        </div>

        {/* ORTA BÖLÜM: GRAFİK VE AKTİF POZİSYONLAR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[350px]">
             <h2 className="text-white font-bold mb-6 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400"><TrendingUp size={16}/> Equity Curve</h2>
             <div className="h-64 bg-[#020617]/50 rounded-xl border border-dashed border-slate-700 flex items-center justify-center">
                <p className="text-slate-600 text-sm font-mono tracking-tighter">Performance chart will be rendered here.</p>
             </div>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 bg-slate-900/30">
              <h2 className="text-white font-bold text-xs uppercase tracking-widest text-slate-400">Open Positions</h2>
            </div>
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-800/50">
                {MOCK_POSITIONS.map((pos, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition group">
                    <td className="px-5 py-4">
                      <p className="font-bold text-white text-sm tracking-tight">{pos.symbol}</p>
                      <p className="text-[10px] text-slate-500 font-mono italic">{pos.amount} Units</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className={`text-sm font-bold ${pos.up ? 'text-emerald-400' : 'text-rose-400'}`}>{pos.profit}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{pos.pnlPercent}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ALT BÖLÜM: TRADE HISTORY (TAM İSTEDİĞİN SÜTUNLARLA) */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
            <h2 className="text-white font-bold text-sm flex items-center gap-2 underline decoration-blue-500 decoration-2 underline-offset-8">
              <Clock size={16} className="text-blue-500" /> Trade History
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input type="text" placeholder="Search history..." className="bg-[#020617] border border-slate-700 rounded-lg py-1 pl-9 pr-4 text-xs focus:outline-none focus:border-blue-500 transition" />
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
                {MOCK_HISTORY.map((trade) => (
                  <tr key={trade.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-600 font-mono">{trade.id}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">{trade.date}</td>
                    <td className="px-6 py-4 text-sm font-bold text-white">{trade.symbol}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${trade.side === 'BUY' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">{trade.qty}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-300">${trade.price}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-300">{trade.total}</td>
                    <td className={`px-6 py-4 text-right text-xs font-bold ${trade.up === true ? 'text-emerald-400' : trade.up === false ? 'text-rose-400' : 'text-slate-500'}`}>
                      {trade.pnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}