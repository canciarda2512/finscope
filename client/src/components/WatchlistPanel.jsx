
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

function Sparkline({ data, up, width = 80, height = 28 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={up ? 'var(--green)' : 'var(--red)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WatchlistRow({ asset, onOpenChart, onRemove }) {
  const up = Number(asset.change24h || 0) >= 0;
  const name = ASSET_NAMES[asset.symbol] || asset.symbol.replace('USDT', '');

  return (
    <tr className="transition group" style={{ borderBottom: '1px solid var(--border-primary)' }}>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <Star size={16} className="text-amber-500 fill-amber-500/20 group-hover:fill-amber-500 transition-all" />
          <div>
            <span className="font-bold block leading-none mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {asset.symbol.replace('USDT', '')}
              <span className="font-normal text-xs ml-1" style={{ color: 'var(--text-dim)' }}>/USDT</span>
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{name}</span>
          </div>
        </div>
      </td>
      <td className="px-6 py-5 text-right font-mono font-bold tracking-tighter" style={{ color: 'var(--text-primary)' }}>
        ${money(asset.price)}
      </td>
      <td className={`px-6 py-5 text-right font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
        <div className="flex items-center justify-end gap-1">
          {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {pct(asset.change24h)}
        </div>
      </td>
      <td className="px-6 py-5 text-right text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
        {compact(asset.volume24h)}
      </td>
      <td className="px-6 py-5">
        <Sparkline data={asset.sparkline} up={up} />
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
            className="transition" style={{ color: 'var(--text-muted)' }}
            title="Open Chart"
          >
            <ExternalLink size={18} />
          </button>
          <button
            onClick={() => onRemove(asset.symbol)}
            className="transition" style={{ color: 'var(--text-muted)' }}
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
      <div className="rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase font-bold tracking-[0.15em]" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4 text-right">Price</th>
              <th className="px-6 py-4 text-right">24h Change</th>
              <th className="px-6 py-4 text-right">24h Volume</th>
              <th className="px-6 py-4">7d Chart</th>
              <th className="px-6 py-4 text-right">Live</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
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
            <p className="font-medium animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading watchlist...</p>
          </div>
        )}

        {!loading && assets.length === 0 && totalCount > 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>No assets found matching your search.</p>
          </div>
        )}

        {!loading && totalCount === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Your watchlist is empty.</p>
            <button
              onClick={onAddFirst}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold transition mt-2"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus size={15} /> Add your first asset
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
        {connected ? 'WebSocket live updates active' : 'Snapshot mode - reconnecting'}
      </p>
    </>
  );
}
