import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import APIClient from '../services/APIClient';
import WatchlistPanel, { ASSET_NAMES, money, pct } from '../components/WatchlistPanel';

function mergeLivePrice(asset, livePrice, liveVolume) {
  const price24hAgo = Number(asset.price24hAgo || 0);
  const change24h = price24hAgo > 0
    ? ((livePrice - price24hAgo) / price24hAgo) * 100
    : asset.change24h;

  return {
    ...asset,
    price: livePrice,
    change24h,
    liveVolume: liveVolume ?? asset.liveVolume,
    lastTickAt: new Date().toISOString(),
  };
}

function AddAssetModal({ watchedSymbols, onAdd, onClose }) {
  const [modalSearch, setModalSearch] = useState('');
  const [modalSymbols, setModalSymbols] = useState([]);
  const [modalLoading, setModalLoading] = useState(true);
  const [addingSymbol, setAddingSymbol] = useState('');
  const [addedSet, setAddedSet] = useState(new Set(watchedSymbols));
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();

    const load = async () => {
      try {
        const res = await APIClient.get('/watchlist/symbols');
        setModalSymbols(res.data.symbols || []);
      } catch (err) {
        console.error('Modal symbols load error:', err);
      } finally {
        setModalLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const term = modalSearch.trim().toLowerCase();

    return modalSymbols.filter(item => {
      if (addedSet.has(item.symbol)) return false;
      if (!term) return true;

      const base = item.symbol.replace('USDT', '').toLowerCase();
      const name = (ASSET_NAMES[item.symbol] || '').toLowerCase();
      return base.includes(term) || name.includes(term) || item.symbol.toLowerCase().includes(term);
    });
  }, [modalSymbols, modalSearch, addedSet]);

  const handleAdd = async (symbol) => {
    if (addingSymbol) return;

    setAddingSymbol(symbol);
    try {
      await onAdd(symbol);
      setAddedSet(prev => new Set([...prev, symbol]));
    } finally {
      setAddingSymbol('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md flex flex-col shadow-2xl"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-bold text-base">Add Asset</h2>
            <p className="text-slate-500 text-xs mt-0.5">Binance USDT pairs sorted by volume</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search symbol or name..."
              value={modalSearch}
              onChange={event => setModalSearch(event.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500 text-white transition placeholder-slate-600"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {modalLoading ? (
            <div className="text-center text-slate-500 py-12 text-sm animate-pulse">
              Loading Binance pairs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-slate-600 py-12 text-sm">
              No results found
            </div>
          ) : filtered.map(item => {
            const up = Number(item.change24h) >= 0;
            const base = item.symbol.replace('USDT', '');
            const name = ASSET_NAMES[item.symbol];
            const isAdding = addingSymbol === item.symbol;

            return (
              <button
                key={item.symbol}
                onClick={() => handleAdd(item.symbol)}
                disabled={!!addingSymbol}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/60 transition border-b border-slate-800/40 last:border-0 disabled:opacity-60 text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-slate-400">{base.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-bold text-sm leading-none">{base}</div>
                    {name && <div className="text-slate-500 text-[11px] mt-0.5">{name}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-white font-mono text-xs">${money(item.price)}</div>
                    <div className={`text-[10px] font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pct(item.change24h)}
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition flex-shrink-0
                    ${isAdding
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-500 group-hover:border-blue-500 group-hover:text-blue-400'
                    }`}
                  >
                    {isAdding ? <span className="text-[9px] animate-spin">...</span> : <Plus size={13} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-2.5 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-600">
            {modalLoading ? '...' : `${filtered.length} available`}
          </span>
          <span className="text-[10px] text-slate-600">Click to add - ESC to close</span>
        </div>
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadWatchlist = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError('');

    try {
      const res = await APIClient.get('/watchlist');
      setAssets(res.data.assets || []);
    } catch (err) {
      console.error('Watchlist load error:', err);
      setError(err.response?.data?.message || 'Watchlist could not be loaded.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlist(true);
    const intervalId = window.setInterval(() => loadWatchlist(false), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (socketRef.current) socketRef.current.close();

    const socket = new WebSocket('ws://localhost:4000');
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const kline = msg.k;
        if (!msg.s || !kline) return;

        const livePrice = Number(kline.c);
        const liveVolume = Number(kline.q || kline.v || 0);
        if (!Number.isFinite(livePrice) || livePrice <= 0) return;

        setAssets(prev => prev.map(asset => (
          asset.symbol === msg.s
            ? mergeLivePrice(asset, livePrice, liveVolume)
            : asset
        )));
      } catch (err) {
        console.warn('Watchlist websocket parse error:', err);
      }
    };

    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const watchedSymbols = useMemo(() => new Set(assets.map(asset => asset.symbol)), [assets]);

  const filteredList = assets.filter(asset => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    const name = ASSET_NAMES[asset.symbol] || '';
    return asset.symbol.toLowerCase().includes(term) || name.toLowerCase().includes(term);
  });

  const addSymbol = async (symbol) => {
    try {
      const res = await APIClient.post('/watchlist', { symbol });
      setAssets(prev => {
        const withoutDuplicate = prev.filter(asset => asset.symbol !== symbol);
        return [...withoutDuplicate, res.data.asset].sort((a, b) => a.symbol.localeCompare(b.symbol));
      });
    } catch (err) {
      console.error('Watchlist add error:', err);
      setError(err.response?.data?.message || 'Symbol could not be added.');
    }
  };

  const removeSymbol = async (symbol) => {
    setError('');

    try {
      await APIClient.delete(`/watchlist/${symbol}`);
      setAssets(prev => prev.filter(asset => asset.symbol !== symbol));
    } catch (err) {
      console.error('Watchlist delete error:', err);
      setError(err.response?.data?.message || 'Symbol could not be removed.');
    }
  };

  return (
    <div className="bg-slate-950 min-h-screen p-6 text-slate-200">
      {showModal && (
        <AddAssetModal
          watchedSymbols={watchedSymbols}
          onAdd={addSymbol}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Watchlist</h1>
            <p className="text-slate-500 text-sm mt-1">
              Scan live prices, 24h change, and volume for the assets you follow.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search assets..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-blue-500 transition text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition"
                title="Add asset"
              >
                <Plus size={16} />
                Add Asset
              </button>
              <button
                onClick={() => loadWatchlist(true)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 hover:border-blue-500 px-3 text-slate-300 transition"
                title="Refresh snapshot"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200 ml-4">
              <X size={14} />
            </button>
          </div>
        )}

        <WatchlistPanel
          assets={filteredList}
          totalCount={assets.length}
          loading={loading}
          connected={connected}
          onAddFirst={() => setShowModal(true)}
          onOpenChart={(symbol) => navigate(`/?symbol=${symbol}`)}
          onRemove={removeSymbol}
        />
      </div>
    </div>
  );
}
