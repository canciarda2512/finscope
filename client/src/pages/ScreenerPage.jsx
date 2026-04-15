import { useState } from 'react';
import { Search, Filter, ArrowUpRight, ArrowDownRight, Activity, Eye } from 'lucide-react';

const MOCK_SCREENER_DATA = [
  { id: 1, symbol: 'BTC/USDT', price: '67,432', change: '+2.34%', volume: '$42.1B', rsi: '62', volatility: '1.2%', trend: 'up' },
  { id: 2, symbol: 'ETH/USDT', price: '3,541', change: '+1.12%', volume: '$18.3B', rsi: '58', volatility: '2.1%', trend: 'up' },
  { id: 3, symbol: 'SOL/USDT', price: '142.50', change: '-0.87%', volume: '$5.2B', rsi: '45', volatility: '4.5%', trend: 'down' },
  { id: 4, symbol: 'AVAX/USDT', price: '38.21', change: '-2.11%', volume: '$1.1B', rsi: '28', volatility: '5.8%', trend: 'down' },
  { id: 5, symbol: 'LINK/USDT', price: '18.45', change: '+4.56%', volume: '$900M', rsi: '72', volatility: '3.2%', trend: 'up' },
  { id: 6, symbol: 'PEPE/USDT', price: '0.000001', change: '+15.2%', volume: '$400M', rsi: '85', volatility: '12.4%', trend: 'up' },
];

export default function ScreenerPage() {
  const [activeFilter, setActiveFilter] = useState('Top Gainers');

  const filters = [
    'Top Gainers', 
    'Top Losers', 
    'Highest Volume', 
    'Most Volatile', 
    'RSI>70', 
    'RSI<30'
  ];

  return (
    <div className="bg-[#020617] min-h-screen text-slate-300 p-6 pb-20">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER & BALSAMIQ STYLE BUTTONS */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="text-blue-500" size={20} /> Market Screener
          </h1>
          
          <div className="flex flex-wrap gap-2 bg-[#0f172a] p-1.5 rounded-xl border border-slate-800 w-fit">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  activeFilter === f 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-t-2xl p-4 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search by symbol (e.g. BTC)..." 
              className="w-full bg-[#020617] border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
             <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Live Market</span>
          </div>
        </div>

        {/* SCREENER TABLE */}
        <div className="bg-[#0f172a] border border-slate-800 border-t-0 rounded-b-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-[10px] uppercase tracking-[0.15em] text-slate-500 border-b border-slate-800">
                <th className="px-6 py-4 font-bold">#</th>
                <th className="px-6 py-4 font-bold">Symbol</th>
                <th className="px-6 py-4 font-bold">Price</th>
                <th className="px-6 py-4 font-bold">24h Change</th>
                <th className="px-6 py-4 font-bold">Volume</th>
                <th className="px-6 py-4 font-bold">RSI (14)</th>
                <th className="px-6 py-4 font-bold">Volatility</th>
                <th className="px-6 py-4 font-bold text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {MOCK_SCREENER_DATA.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-600/5 transition-colors group">
                  <td className="px-6 py-4 text-slate-600 text-xs">{index + 1}</td>
                  <td className="px-6 py-4 font-bold text-white group-hover:text-blue-400 transition-colors">{item.symbol}</td>
                  <td className="px-6 py-4 font-mono text-sm">${item.price}</td>
                  <td className={`px-6 py-4 text-sm font-bold ${item.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    <div className="flex items-center gap-1">
                      {item.trend === 'up' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                      {item.change}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 font-mono">{item.volume}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        parseInt(item.rsi) > 70 ? 'bg-red-500/10 text-red-500' : 
                        parseInt(item.rsi) < 30 ? 'bg-green-500/10 text-green-500' : 
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {item.rsi}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 font-mono italic">
                    {item.volatility}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-slate-500">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER INFO */}
        <div className="mt-4 flex justify-between items-center px-2 text-[10px] text-slate-600 uppercase tracking-widest">
          <span>Scan speed: 45ms</span>
          <span>Last sync: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}