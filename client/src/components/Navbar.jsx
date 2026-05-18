import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Authcontext';
import {
  TrendingUp,
  User,
  LogOut,
  Bell,
  Search,
  Zap,
  TrendingUp as TradeIcon,
  Settings,
  CheckCheck,
  X,
  Flame,
  Sun,
  Moon,
} from 'lucide-react';
import APIClient from '../services/APIClient';
import TokenManager from '../services/TokenManager';
import { useTheme } from '../context/ThemeContext';

// ── Coin metadata ──
const COIN_META = {
  BTCUSDT:  { name: 'Bitcoin',          base: 'BTC'  },
  ETHUSDT:  { name: 'Ethereum',         base: 'ETH'  },
  BNBUSDT:  { name: 'BNB',              base: 'BNB'  },
  SOLUSDT:  { name: 'Solana',           base: 'SOL'  },
  XRPUSDT:  { name: 'XRP',             base: 'XRP'  },
  ADAUSDT:  { name: 'Cardano',          base: 'ADA'  },
  DOGEUSDT: { name: 'Dogecoin',         base: 'DOGE' },
  AVAXUSDT: { name: 'Avalanche',        base: 'AVAX' },
  LINKUSDT: { name: 'Chainlink',        base: 'LINK' },
  DOTUSDT:  { name: 'Polkadot',         base: 'DOT'  },
  TRXUSDT:  { name: 'TRON',             base: 'TRX'  },
  MATICUSDT:{ name: 'Polygon',          base: 'MATIC'},
  LTCUSDT:  { name: 'Litecoin',         base: 'LTC'  },
  BCHUSDT:  { name: 'Bitcoin Cash',     base: 'BCH'  },
  UNIUSDT:  { name: 'Uniswap',          base: 'UNI'  },
  ATOMUSDT: { name: 'Cosmos',           base: 'ATOM' },
  ETCUSDT:  { name: 'Ethereum Classic', base: 'ETC'  },
  FILUSDT:  { name: 'Filecoin',         base: 'FIL'  },
  APTUSDT:  { name: 'Aptos',            base: 'APT'  },
  ARBUSDT:  { name: 'Arbitrum',         base: 'ARB'  },
  OPUSDT:   { name: 'Optimism',         base: 'OP'   },
  NEARUSDT: { name: 'NEAR Protocol',    base: 'NEAR' },
  INJUSDT:  { name: 'Injective',        base: 'INJ'  },
  SUIUSDT:  { name: 'Sui',              base: 'SUI'  },
  SEIUSDT:  { name: 'Sei',              base: 'SEI'  },
};

const HOT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
const ALL_SYMBOLS  = Object.keys(COIN_META);

function formatPrice(p) {
  if (p == null) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(4);
  return p.toFixed(6);
}

// ── Search Modal ──
function SearchModal({ onClose }) {
  const [query, setQuery]   = useState('');
  const [prices, setPrices] = useState({});
  const inputRef            = useRef(null);
  const navigate            = useNavigate();

  // Auto-focus
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fetch live prices from screener
  useEffect(() => {
    let cancelled = false;
    APIClient.get('/screener', { params: { tab: 'highest-volume', limit: 25 } })
      .then(res => {
        if (cancelled) return;
        const map = {};
        for (const item of res.data?.symbols ?? []) {
          map[item.symbol] = { price: item.currentPrice, change24h: item.change24h };
        }
        setPrices(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleSelect = useCallback((sym) => {
    navigate(`/?symbol=${sym}`);
    onClose();
  }, [navigate, onClose]);

  const q = query.toUpperCase().trim();
  const filtered = q
    ? ALL_SYMBOLS.filter(s =>
        s.includes(q) ||
        COIN_META[s].base.includes(q) ||
        COIN_META[s].name.toUpperCase().includes(q)
      )
    : ALL_SYMBOLS;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20 px-4"
      onMouseDown={onClose}
    >
      {/* Modal card */}
      <div
        className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search size={16} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search crypto (BTC, Ethereum...)"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Hot Trading section — only shown when not searching */}
        {!q && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Flame size={12} className="text-orange-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Hot Trading</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {HOT_SYMBOLS.map(sym => {
                const meta = COIN_META[sym];
                return (
                  <button
                    key={sym}
                    onClick={() => handleSelect(sym)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-blue-600/20 hover:border-blue-500/40 border border-slate-700 transition-all group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-blue-300">{meta.base}</span>
                    {prices[sym]?.change24h != null && (
                      <span className={`text-[10px] font-semibold ${prices[sym].change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {prices[sym].change24h >= 0 ? '+' : ''}{prices[sym].change24h.toFixed(2)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="mx-4 my-1 border-t border-slate-800" />

        {/* Results list */}
        <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-xs">No results for "{query}"</div>
          ) : (
            <ul>
              {filtered.map(sym => {
                const meta   = COIN_META[sym];
                const px     = prices[sym];
                const change = px?.change24h;
                return (
                  <li key={sym}>
                    <button
                      onClick={() => handleSelect(sym)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/60 transition-colors group"
                    >
                      {/* Left: base + name */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-blue-300">
                          {meta.base.slice(0, 3)}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                            {meta.base}<span className="text-slate-500 font-normal">/USDT</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{meta.name}</div>
                        </div>
                      </div>

                      {/* Right: price + change */}
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">
                          {px ? `$${formatPrice(px.price)}` : <span className="text-slate-700 text-xs">loading…</span>}
                        </div>
                        {change != null && (
                          <div className={`text-[11px] font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Relative time helper ──
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Notification type display config ──
const TYPE_CONFIG = {
  trade_executed: {
    icon: <TradeIcon size={13} />,
    color: 'text-blue-400',
    ring: 'bg-blue-500/15 ring-blue-500/20',
  },
  limit_order_triggered: {
    icon: <Zap size={13} />,
    color: 'text-amber-400',
    ring: 'bg-amber-500/15 ring-amber-500/20',
  },
  limit_order_created: {
    icon: <Zap size={13} />,
    color: 'text-cyan-400',
    ring: 'bg-cyan-500/15 ring-cyan-500/20',
  },
  price_alert_triggered: {
    icon: <Bell size={13} />,
    color: 'text-red-400',
    ring: 'bg-red-500/15 ring-red-500/20',
  },
  strategy_event: {
    icon: <Settings size={13} />,
    color: 'text-purple-400',
    ring: 'bg-purple-500/15 ring-purple-500/20',
  },
};

function typeConfig(type) {
  return TYPE_CONFIG[type] ?? {
    icon: <Bell size={13} />,
    color: 'text-slate-400',
    ring: 'bg-slate-500/15 ring-slate-500/20',
  };
}

// ── Notification Dropdown ──
function NotificationDropdown({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await APIClient.get('/notifications');
        if (cancelled) return;
        setNotifications(res.data.notifications || []);

        // Mark all as read when dropdown opens
        if ((res.data.unreadCount ?? 0) > 0) {
          APIClient.put('/notifications/read-all').catch(() => {});
        }
      } catch (_) {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onNew = (event) => {
      const notification = event.detail?.notification;
      if (!notification?.id) return;

      setNotifications(prev => {
        if (prev.some(item => item.id === notification.id)) return prev;
        return [notification, ...prev];
      });

      APIClient.put('/notifications/read-all').catch(() => {});
    };

    window.addEventListener('notification:new', onNew);
    return () => window.removeEventListener('notification:new', onNew);
  }, []);

  return (
    <div className="flex flex-col" style={{ maxHeight: '480px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className="text-white font-bold text-sm">Notifications</span>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition"
        >
          <X size={14} />
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="px-4 py-10 text-center text-slate-600 text-xs animate-pulse">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell size={24} className="text-slate-700 mx-auto mb-2" />
            <p className="text-slate-600 text-xs">No notifications yet</p>
            <p className="text-slate-700 text-[10px] mt-1">
              Trade executions and limit order fills will appear here
            </p>
          </div>
        ) : notifications.map(notif => {
          const cfg = typeConfig(notif.type);
          const unread = Number(notif.isRead) === 0;
          return (
            <div
              key={notif.id}
              className={`flex gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0 transition
                ${unread ? 'bg-slate-800/20' : 'hover:bg-slate-800/10'}`}
            >
              {/* Type icon */}
              <div className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full ring-1 flex items-center justify-center ${cfg.ring}`}>
                <span className={cfg.color}>{cfg.icon}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[11px] font-bold leading-tight ${unread ? 'text-white' : 'text-slate-300'}`}>
                    {notif.title}
                  </span>
                  {unread && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug truncate">
                  {notif.message}
                </p>
                <span className="text-[10px] text-slate-600 mt-1 block">
                  {relativeTime(notif.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-1 text-[10px] text-slate-600">
          <CheckCheck size={11} />
          <span>All marked as read on open</span>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleSearchClose = useCallback(() => setSearchOpen(false), []);

  // ── Poll unread count every 30 sec ──
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await APIClient.get('/notifications/count');
        if (!cancelled) setUnreadCount(res.data.unreadCount ?? 0);
      } catch (err) {
        console.error('[Navbar] Failed to fetch notification count:', err?.response?.status, err?.message);
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, 30000);

    // Immediate refresh when a notification is created (dispatched by trade handlers)
    const onNew = () => { if (!cancelled) fetchCount(); };
    window.addEventListener('notification:new', onNew);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('notification:new', onNew);
    };
  }, [isAuthenticated]);

  // Live notification push channel. Badge polling remains as a fallback.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const token = TokenManager.getAccessToken();
    if (!token) return undefined;

    const socket = new WebSocket(`ws://localhost:4000?token=${encodeURIComponent(token)}`);

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'notification:new') return;

        setUnreadCount(count => count + 1);
        window.dispatchEvent(new CustomEvent('notification:new', {
          detail: { notification: msg.notification },
        }));
      } catch (err) {
        console.warn('[Navbar] Notification WS parse error:', err);
      }
    };

    socket.onerror = (err) => {
      console.warn('[Navbar] Notification WebSocket error:', err);
    };

    return () => socket.close();
  }, [isAuthenticated]);

  // ── Reset badge when dropdown opens ──
  const handleBellClick = () => {
    if (!dropdownOpen) {
      setUnreadCount(0);
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  };

  // ── Click outside to close ──
  useEffect(() => {
    if (!dropdownOpen) return;
    const onMouseDown = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setDropdownOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [dropdownOpen]);

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-all pb-2 border-b-2 flex items-center gap-2 ${
      isActive
        ? 'text-blue-500 border-blue-500'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`;

  const authLinkClass = ({ isActive }) =>
    `px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-800'
    }`;

  return (
    <>
    <nav className="bg-[#0f172a] border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-[100] shadow-md">

      {/* LEFT: Logo + Nav links */}
      <div className="flex items-center gap-10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
            <TrendingUp size={20} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tighter italic">FinScope</span>
        </Link>

        <div className="hidden lg:flex gap-6 items-center mt-1">
          {isAuthenticated ? (
            <>
              <NavLink to="/"           className={navLinkClass}>Chart</NavLink>
              <NavLink to="/portfolio"  className={navLinkClass}>Portfolio</NavLink>
              <NavLink to="/watchlist"  className={navLinkClass}>Watchlist</NavLink>
              <NavLink to="/screener"   className={navLinkClass}>Screener</NavLink>
              <NavLink to="/strategy"   className={navLinkClass}>Strategy</NavLink>
              <NavLink to="/multi-chart" className={navLinkClass}>Multi-chart</NavLink>
            </>
          ) : (
            <NavLink to="/chart" className={navLinkClass}>Live Charts</NavLink>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-5">
        <div className="hidden md:flex items-center gap-4 text-slate-400 mr-2 border-r border-slate-700 pr-5">
          <button
            onClick={() => setSearchOpen(o => !o)}
            className="p-1 hover:text-white transition-colors"
            title="Search crypto"
          >
            <Search size={18} />
          </button>

          {/* ── Notification Bell ── */}
          <div className="relative">
            <button
              ref={bellRef}
              onClick={isAuthenticated ? handleBellClick : undefined}
              className="relative p-1 text-slate-400 hover:text-white transition-colors"
              title="Notifications"
            >
              <Bell size={18} />
              {isAuthenticated && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {dropdownOpen && isAuthenticated && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-full mt-2 w-80 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[200]"
              >
                <NotificationDropdown onClose={() => setDropdownOpen(false)} />
              </div>
            )}
          </div>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            <Link to="/profile" className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full shadow-inner hover:border-blue-500/50 hover:bg-slate-700 transition-all">
              <User size={14} className="text-blue-400" />
              <span className="text-slate-200 text-xs font-semibold">
                @{user?.username || 'user'}
              </span>
            </Link>
            <button
              onClick={logout}
              title="Log out"
              className="p-2 text-slate-500 hover:text-red-400 transition-all hover:scale-110"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <NavLink to="/login" className={authLinkClass}>Login</NavLink>
            <NavLink to="/register" className={authLinkClass}>Register</NavLink>
          </div>
        )}

        {/* ── Theme toggle ── */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="ml-1 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          {theme === 'dark'
            ? <Sun size={18} className="text-amber-400" />
            : <Moon size={18} className="text-slate-600" />
          }
        </button>
      </div>
    </nav>

    {searchOpen && <SearchModal onClose={handleSearchClose} />}
    </>
  );
}
