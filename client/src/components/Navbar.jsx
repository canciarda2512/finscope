import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/Authcontext';
import { useTheme } from '../context/ThemeContext';
import {
  TrendingUp, User, LogOut, Bell, Zap, Settings, CheckCheck, X,
  BarChart3, Eye, ListFilter, Cpu, LayoutGrid, Sun, Moon, Menu,
} from 'lucide-react';
import APIClient from '../services/APIClient';
import WebSocketClient from '../services/WebSocketClient';

function relativeTime(dateStr) {
  if (!dateStr) return '';
  // ClickHouse timestamps are UTC but lack a 'Z' suffix — append it so the
  // browser doesn't interpret them as local time (which caused "3h ago" on new notifications).
  const normalized = String(dateStr).endsWith('Z') ? dateStr : `${String(dateStr).trim().replace(' ', 'T')}Z`;
  const diff = Date.now() - new Date(normalized).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_CONFIG = {
  trade_executed: { icon: <TrendingUp size={12} />, color: 'var(--accent-text)', bg: 'var(--accent-muted)' },
  limit_order_triggered: { icon: <Zap size={12} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  limit_order_created: { icon: <Zap size={12} />, color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  price_alert_triggered: { icon: <Bell size={12} />, color: 'var(--red)', bg: 'var(--red-muted)' },
  strategy_event: { icon: <Settings size={12} />, color: 'var(--accent-text)', bg: 'var(--accent-muted)' },
};

function typeConfig(type) {
  return TYPE_CONFIG[type] ?? { icon: <Bell size={12} />, color: 'var(--text-muted)', bg: 'var(--bg-hover)' };
}

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
        if ((res.data.unreadCount ?? 0) > 0) APIClient.put('/notifications/read-all').catch(() => {});
      } catch (_) { if (!cancelled) setNotifications([]); }
      finally { if (!cancelled) setLoading(false); }
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
    <div className="flex flex-col" style={{ maxHeight: '420px' }} role="region" aria-labelledby="notif-heading">
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <span id="notif-heading" className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>Notifications</span>
        <button onClick={onClose} className="p-1 rounded transition" style={{ color: 'var(--text-muted)' }} aria-label="Close notifications"><X size={13} /></button>
      </div>
      <div className="overflow-y-auto flex-1" role="list" aria-label="Notification list">
        {loading ? (
          <div className="px-4 py-8 text-center text-xs animate-pulse" style={{ color: 'var(--text-dim)' }} role="status">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center" role="status">
            <Bell size={20} className="mx-auto mb-2" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No notifications yet</p>
          </div>
        ) : notifications.map(notif => {
          const cfg = typeConfig(notif.type);
          const unread = Number(notif.isRead) === 0;
          return (
            <div key={notif.id} role="listitem" aria-label={`${unread ? 'Unread: ' : ''}${notif.title} — ${notif.message}`}
              className="flex gap-2.5 px-4 py-2.5 last:border-0 transition"
              style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: unread ? 'var(--bg-hover)' : 'transparent' }}>
              <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: cfg.bg }} aria-hidden="true">
                <span style={{ color: cfg.color }}>{cfg.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold leading-tight" style={{ color: unread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{notif.title}</span>
                  {unread && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1" style={{ backgroundColor: 'var(--accent)' }} />}
                </div>
                <p className="text-[10px] mt-0.5 leading-snug truncate" style={{ color: 'var(--text-muted)' }}>{notif.message}</p>
                <span className="text-[9px] mt-0.5 block" style={{ color: 'var(--text-dim)' }}>{relativeTime(notif.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {notifications.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-1 text-[9px]" style={{ borderTop: '1px solid var(--border-primary)', color: 'var(--text-dim)' }}>
          <CheckCheck size={10} /> All marked as read on open
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { setUnreadCount(0); return; }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await APIClient.get('/notifications/count');
        if (!cancelled) setUnreadCount(res.data.unreadCount ?? 0);
      } catch (_) {}
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    const onNew = () => { if (!cancelled) fetchCount(); };
    window.addEventListener('notification:new', onNew);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener('notification:new', onNew); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return WebSocketClient.subscribe((msg) => {
      if (msg.type !== 'notification:new') return;
      setUnreadCount(count => count + 1);
      window.dispatchEvent(new CustomEvent('notification:new', { detail: { notification: msg.notification } }));
    });
  }, [isAuthenticated]);

  const handleBellClick = () => {
    if (!dropdownOpen) { setUnreadCount(0); setDropdownOpen(true); }
    else setDropdownOpen(false);
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    const onMouseDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && bellRef.current && !bellRef.current.contains(e.target)) setDropdownOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setDropdownOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onMouseDown); document.removeEventListener('keydown', onKey); };
  }, [dropdownOpen]);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const navItems = [
    { to: '/', icon: <BarChart3 size={13} />, label: 'Chart', end: true, alwaysShow: true },
    { to: '/portfolio', icon: <TrendingUp size={13} />, label: 'Portfolio' },
    { to: '/watchlist', icon: <Eye size={13} />, label: 'Watchlist' },
    { to: '/screener', icon: <ListFilter size={13} />, label: 'Screener' },
    { to: '/strategy', icon: <Cpu size={13} />, label: 'Strategy' },
    { to: '/multi-chart', icon: <LayoutGrid size={13} />, label: 'Multi-Chart' },
  ].filter(item => item.alwaysShow || isAuthenticated);

  return (
    <>
    <nav aria-label="Main navigation" className="px-4 py-0 flex items-center justify-between sticky top-0 z-[100] h-11"
      style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>

      {/* LEFT */}
      <div className="flex items-center gap-1">
        {/* Mobile hamburger */}
        <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 rounded-md transition mr-1"
          style={{ color: 'var(--text-muted)' }} title="Menu"
          aria-label="Open navigation menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-menu">
          <Menu size={18} aria-hidden="true" />
        </button>

        <Link to="/" className="flex items-center gap-1.5 mr-4 group">
          <div className="w-6 h-6 rounded flex items-center justify-center transition-colors" style={{ backgroundColor: 'var(--accent)' }}>
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>FinScope</span>
        </Link>

        <div className="hidden md:flex items-center gap-0.5">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide transition-all"
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
                color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
              })}>
              {item.icon} {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button onClick={toggleTheme} className="p-1.5 rounded-md transition"
          style={{ color: 'var(--text-muted)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>

        {isAuthenticated && (
          <div className="relative">
            <button ref={bellRef} onClick={handleBellClick} className="relative p-1.5 rounded-md transition"
              style={{ color: 'var(--text-muted)' }} title="Notifications"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={dropdownOpen} aria-haspopup="true">
              <Bell size={15} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white leading-none"
                  style={{ backgroundColor: 'var(--red)' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {dropdownOpen && (
              <div ref={dropdownRef} role="dialog" aria-label="Notifications" className="absolute right-0 top-full mt-1 w-72 rounded-lg shadow-2xl overflow-hidden z-[200]"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                <NotificationDropdown onClose={() => setDropdownOpen(false)} />
              </div>
            )}
          </div>
        )}

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <NavLink to="/profile" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md transition"
              style={{ backgroundColor: 'var(--accent-muted)', border: '1px solid var(--accent-ring)' }}
              title="Profile">
              <User size={12} style={{ color: 'var(--accent-text)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>@{user?.username || 'user'}</span>
            </NavLink>
            <button onClick={logout} className="hidden sm:block p-1.5 rounded-md transition" style={{ color: 'var(--text-dim)' }} title="Sign out" aria-label="Sign out">
              <LogOut size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <NavLink to="/login" className="px-3 py-1 text-[11px] font-semibold rounded-md transition"
              style={{ color: 'var(--text-muted)' }}>Sign In</NavLink>
            <NavLink to="/register" className="hidden sm:block px-3 py-1 text-[11px] font-semibold text-white rounded-md transition"
              style={{ backgroundColor: 'var(--accent)' }}>Sign Up Free</NavLink>
          </div>
        )}
      </div>
    </nav>

    {/* Mobile slide-out menu */}
    {mobileMenuOpen && (
      <div id="mobile-menu" className="fixed inset-0 z-[200] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />

        {/* Drawer */}
        <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col shadow-2xl"
          style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-primary)' }}>

          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 h-11"
            style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                <TrendingUp size={14} className="text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>FinScope</span>
            </Link>
            <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-md transition"
              style={{ color: 'var(--text-muted)' }} aria-label="Close navigation menu">
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Nav links */}
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-0.5"
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                })}>
                {item.icon} {item.label}
              </NavLink>
            ))}
          </div>

          {/* Drawer footer */}
          <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
            {isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition"
                  style={{ backgroundColor: 'var(--accent-muted)', border: '1px solid var(--accent-ring)' }}>
                  <User size={14} style={{ color: 'var(--accent-text)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>@{user?.username || 'user'}</span>
                </NavLink>
                <button onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition w-full"
                  style={{ color: 'var(--text-muted)' }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <NavLink to="/login" onClick={() => setMobileMenuOpen(false)}
                  className="text-center px-3 py-2 text-xs font-semibold rounded-lg transition"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border-primary)' }}>Sign In</NavLink>
                <NavLink to="/register" onClick={() => setMobileMenuOpen(false)}
                  className="text-center px-3 py-2 text-xs font-semibold text-white rounded-lg transition"
                  style={{ backgroundColor: 'var(--accent)' }}>Sign Up Free</NavLink>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
