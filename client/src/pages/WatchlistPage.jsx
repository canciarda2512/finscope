import { useState } from 'react';
import { Search, Star, ArrowUpRight, ArrowDownRight, Trash2, ExternalLink } from 'lucide-react';

const MOCK_WATCHLIST = [
  { id: '1', symbol: 'BTCUSDT', name: 'Bitcoin', price: '64,250.00', change: '+1.2%', up: true, volume: '24.5B' },
  { id: '2', symbol: 'ETHUSDT', name: 'Ethereum', price: '3,450.50', change: '-0.8%', up: false, volume: '12.1B' },
  { id: '3', symbol: 'SOLUSDT', name: 'Solana', price: '145.20', change: '+5.4%', up: true, volume: '3.2B' },
  { id: '4', symbol: 'BNBUSDT', name: 'Binance Coin', price: '580.10', change: '+0.1%', up: true, volume: '1.8B' },
];

export default function WatchlistPage() {
  const [search, setSearch] = useState('');
  const [watchlist, setWatchlist] = useState(MOCK_WATCHLIST);

  const filteredList = watchlist.filter(coin => 
    coin.name.toLowerCase().includes(search.toLowerCase()) || 
    coin.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-950 min-h-screen p-6 text-slate-200">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Watchlist</h1>
            <p className="text-slate-500 text-sm mt-1">Track the real-time performance of your favorite assets.</p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder="Search assets (BTC, Ethereum...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-blue-500 transition text-sm"
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] border-b border-slate-800 bg-slate-900/50">
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4 text-right">24h Change</th>
                <th className="px-6 py-4 text-right">Volume</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredList.map((coin) => (
                <tr key={coin.id} className="hover:bg-slate-800/40 transition group cursor-pointer">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <Star size={16} className="text-amber-500 fill-amber-500/20 group-hover:fill-amber-500 transition-all" />
                      <div>
                        <span className="text-white font-bold block leading-none mb-1.5">{coin.symbol}</span>
                        <span className="text-slate-500 text-xs">{coin.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-mono font-bold text-white tracking-tighter">
                    ${coin.price}
                  </td>
                  <td className={`px-6 py-5 text-right font-bold ${coin.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {coin.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {coin.change}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right text-slate-400 text-sm font-medium">
                    {coin.volume}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button className="text-slate-500 hover:text-blue-400 transition" title="Open Chart">
                        <ExternalLink size={18} />
                      </button>
                      <button className="text-slate-500 hover:text-rose-500 transition" title="Remove">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredList.length === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="text-slate-500 font-medium">No assets found matching your search.</p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">
          Data updates automatically every 5 seconds
        </p>
      </div>
    </div>
  );
}