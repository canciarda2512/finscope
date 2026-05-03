
import {
  ArrowDownRight, ArrowUpRight, ExternalLink, Plus, Star, Trash2
} from 'lucide-react';

export const ASSET_NAMES = {
  BTCUSDT: 'Bitcoin',
  ETHUSDT: 'Ethereum',
  SOLUSDT: 'Solana',
  BNBUSDT: 'BNB',
  XRPUSDT: 'XRP',
  ADAUSDT: 'Cardano',
  DOGEUSDT: 'Dogecoin',
  AVAXUSDT: 'Avalanche',
  LINKUSDT: 'Chainlink',
  DOTUSDT: 'Polkadot',
  TRXUSDT: 'TRON',
  MATICUSDT: 'Polygon',
  LTCUSDT: 'Litecoin',
  BCHUSDT: 'Bitcoin Cash',
  UNIUSDT: 'Uniswap',
  ATOMUSDT: 'Cosmos',
  ETCUSDT: 'Ethereum Classic',
  APTUSDT: 'Aptos',
  ARBUSDT: 'Arbitrum',
  OPUSDT: 'Optimism',
  NEARUSDT: 'NEAR',
  INJUSDT: 'Injective',
  SUIUSDT: 'Sui',
  SEIUSDT: 'Sei',
  FILUSDT: 'Filecoin',
};

export function money(value) {
  const price = Number(value || 0);
  if (price === 0) return '-';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: price >= 100 ? 2 : price >= 1 ? 4 : 6,
    maximumFractionDigits: price >= 100 ? 2 : price >= 1 ? 4 : 6,
  });
}

function compact(value) {
  return Number(value || 0).toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  });
}

export function pct(value) {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
}

function WatchlistRow({ asset, onOpenChart, onRemove }) {
  const up = Number(asset.change24h || 0) >= 0;
  const name = ASSET_NAMES[asset.symbol] || asset.symbol.replace('USDT', '');

  return (
    <tr className="hover:bg-slate-800/40 transition group">
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <Star size={16} className="text-amber-500 fill-amber-500/20 group-hover:fill-amber-500 transition-all" />
          <div>
            <span className="text-white font-bold block leading-none mb-1.5">
              {asset.symbol.replace('USDT', '')}
              <span className="text-slate-600 font-normal text-xs ml-1">/USDT</span>
            </span>
            <span className="text-slate-500 text-xs">{name}</span>
          </div>
        </div>
      </td>
      <td className="px-6 py-5 text-right font-mono font-bold text-white tracking-tighter">
        ${money(asset.price)}
      </td>
      <td className={`px-6 py-5 text-right font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
        <div className="flex items-center justify-end gap-1">
          {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {pct(asset.change24h)}
        </div>
      </td>
      <td className="px-6 py-5 text-right text-slate-400 text-sm font-medium">
        {compact(asset.volume24h)}
      </td>
      <td className="px-6 py-5 text-right">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${asset.lastTickAt ? 'text-emerald-400' : 'text-slate-600'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${asset.lastTickAt ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {asset.lastTickAt ? 'Live' : 'Snapshot'}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={() => onOpenChart(asset.symbol)}
            className="text-slate-500 hover:text-blue-400 transition"
            title="Open Chart"
          >
            <ExternalLink size={18} />
          </button>
          <button
            onClick={() => onRemove(asset.symbol)}
            className="text-slate-500 hover:text-rose-500 transition"
            title="Remove"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function WatchlistPanel({
  assets,
  totalCount,
  loading,
  connected,
  onAddFirst,
  onOpenChart,
  onRemove,
}) {
  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] border-b border-slate-800 bg-slate-900/50">
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4 text-right">Price</th>
              <th className="px-6 py-4 text-right">24h Change</th>
              <th className="px-6 py-4 text-right">24h Volume</th>
              <th className="px-6 py-4 text-right">Live</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {assets.map(asset => (
              <WatchlistRow
                key={asset.symbol}
                asset={asset}
                onOpenChart={onOpenChart}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="px-6 py-16 text-center">
            <p className="text-slate-500 font-medium animate-pulse">Loading watchlist...</p>
          </div>
        )}

        {!loading && assets.length === 0 && totalCount > 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-slate-500 font-medium">No assets found matching your search.</p>
          </div>
        )}

        {!loading && totalCount === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-slate-400 font-medium mb-2">Your watchlist is empty.</p>
            <button
              onClick={onAddFirst}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition mt-2"
            >
              <Plus size={15} /> Add your first asset
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">
        {connected ? 'WebSocket live updates active' : 'Snapshot mode - reconnecting'}
      </p>
    </>
  );
}
