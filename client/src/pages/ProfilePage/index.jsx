import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/Authcontext';
import { usePortfolio } from '../../context/PortfolioContext';
import {
  BadgeCheck, Edit2, TrendingUp, TrendingDown,
  BarChart3, Wallet, Clock, Shield, Settings,
  CheckCircle2, Award,
} from 'lucide-react';
import { fmtUSD, fmtPct, fmtDate } from './formatters';
import OverviewTab from './OverviewTab';
import PortfolioTab from './PortfolioTab';
import TransactionsTab from './TransactionsTab';
import SecurityTab from './SecurityTab';
import SettingsTab from './SettingsTab';

const TABS = [
  { id: 'overview',      label: 'Overview',      Icon: BarChart3 },
  { id: 'portfolio',     label: 'Portfolio',     Icon: Wallet    },
  { id: 'transactions',  label: 'Transactions',  Icon: Clock     },
  { id: 'security',      label: 'Security',      Icon: Shield    },
  { id: 'settings',      label: 'Settings',      Icon: Settings  },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const { portfolio: portfolioData, loading } = usePortfolio();
  const navigate = useNavigate();
  const [activeTab, setActiveTab]         = useState('overview');
  const [twoFAEnabled, setTwoFAEnabled]   = useState(() => !!user?.twoFactorEnabled);

  const totalValue    = portfolioData?.totalValue    ?? 0;
  const totalPnL      = portfolioData?.totalPnL      ?? 0;
  const totalPnLPct   = portfolioData?.totalPnLPercent ?? 0;
  const positions     = portfolioData?.positions      ?? [];
  const trades        = portfolioData?.trades         ?? [];
  const pnlUp         = totalPnL >= 0;

  const initials = (user?.username || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>

      {/* Hero banner */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-purple-900/30" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute top-4 left-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -top-8 right-1/3 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-6 items-start -mt-16 mb-8">

          {/* Avatar */}
          <div className="relative flex-shrink-0 z-10">
            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600
              flex items-center justify-center shadow-2xl shadow-blue-900/50" style={{ borderWidth: '4px', borderColor: 'var(--bg-primary)' }}>
              <span className="text-white font-black text-3xl tracking-tight">{initials}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile/details')}
              aria-label="View profile details"
              title="View profile details"
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 hover:bg-blue-400 rounded-xl
              flex items-center justify-center transition-colors shadow-lg"
              style={{ borderWidth: '2px', borderColor: 'var(--bg-primary)' }}
            >
              <Edit2 size={13} className="text-white" />
            </button>
            <div className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full" style={{ borderWidth: '2px', borderColor: 'var(--bg-primary)' }} />
          </div>

          {/* User info */}
          <div className="flex-1 mt-16 md:mt-20">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                @{user?.username || 'user'}
              </h1>
              <BadgeCheck size={20} className="text-blue-400" />
              <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30
                px-2.5 py-0.5 rounded-full font-bold tracking-wide">VERIFIED</span>
            </div>
            <p className="text-[var(--text-muted)] text-sm">{user?.email || '\u2014'}</p>
            <div className="flex flex-wrap gap-4 mt-2">
              <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                <CheckCircle2 size={11} className="text-green-500" />
                Member since {fmtDate(user?.createdAt)}
              </span>
              <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                <Award size={11} className="text-amber-500" />
                Demo Trader
              </span>
            </div>
          </div>

          {/* Account summary cards */}
          <div className="md:mt-16 flex flex-wrap gap-3">
            <div className="rounded-2xl px-5 py-4 min-w-[165px]
              ring-1 ring-blue-500/10 transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-2">Total Balance</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{fmtUSD(totalValue)}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${pnlUp ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {pnlUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {fmtPct(totalPnLPct)} all time
              </div>
            </div>

            <div className={`rounded-2xl px-5 py-4 min-w-[145px] transition-colors
              ${pnlUp ? 'ring-1 ring-green-500/10' : 'ring-1 ring-red-500/10'}`}
              style={{ backgroundColor: 'var(--bg-secondary)', border: pnlUp ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-2">Total PNL</p>
              <p className={`text-xl font-bold ${pnlUp ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {pnlUp ? '+' : ''}{fmtUSD(totalPnL)}
              </p>
              <p className="text-[11px] text-[var(--text-dim)] mt-1">vs $100K start</p>
            </div>

            <div className="rounded-2xl px-5 py-4 min-w-[130px]
              transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-2">Activity</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{trades.length}</p>
              <p className="text-[11px] text-[var(--text-dim)] mt-1">{positions.length} open positions</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-px" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap"
                style={{
                  borderColor: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-text)' : 'var(--text-muted)',
                }}>
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview'     && <OverviewTab data={portfolioData} loading={loading} />}
        {activeTab === 'portfolio'    && <PortfolioTab data={portfolioData} />}
        {activeTab === 'transactions' && <TransactionsTab data={portfolioData} />}
        {activeTab === 'security'     && <SecurityTab user={user} twoFAEnabled={twoFAEnabled} onTwoFAChange={setTwoFAEnabled} />}
        {activeTab === 'settings'     && <SettingsTab user={user} />}
      </div>
    </div>
  );
}
