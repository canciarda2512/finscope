import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';
import APIClient from '../services/APIClient';
import TokenManager from '../services/TokenManager';

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);

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
    <nav className="bg-[#0f172a] border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-[100] shadow-md">

      {/* LEFT: Logo + Nav links */}
      <div className="flex items-center gap-10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
            <TrendingUp size={20} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tighter italic">FinScope</span>
        </Link>

        {isAuthenticated && (
          <div className="hidden lg:flex gap-6 items-center mt-1">
            <NavLink to="/" className={navLinkClass}>Chart</NavLink>
            <NavLink to="/portfolio" className={navLinkClass}>Portfolio</NavLink>
            <NavLink to="/watchlist" className={navLinkClass}>Watchlist</NavLink>
            <NavLink to="/screener" className={navLinkClass}>Screener</NavLink>
            <NavLink to="/strategy" className={navLinkClass}>Strategy</NavLink>
            <NavLink to="/multi-chart" className={navLinkClass}>Multi-chart</NavLink>
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-5">
        <div className="hidden md:flex items-center gap-4 text-slate-400 mr-2 border-r border-slate-700 pr-5">
          <Search size={18} className="hover:text-white cursor-pointer transition-colors" />

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
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full shadow-inner">
              <User size={14} className="text-blue-400" />
              <span className="text-slate-200 text-xs font-semibold">
                @{user?.username || 'user'}
              </span>
            </div>
            <button
              onClick={logout}
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
      </div>
    </nav>
  );
}
