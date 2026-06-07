import { Link } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, CalendarDays, Fingerprint, Mail,
  Phone, ShieldCheck, User, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/Authcontext';
import { usePortfolio } from '../context/PortfolioContext';
import { fmtDate, fmtUSD, fmtPct } from './ProfilePage/formatters';

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <Icon size={17} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{label}</p>
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{value || '\u2014'}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {subtext && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtext}</p>}
    </div>
  );
}

function maskId(value) {
  if (!value) return '\u2014';
  return `${value.slice(0, 2)}*****${value.slice(-2)}`;
}

export default function ProfileDetailsPage() {
  const { user } = useAuth();
  const { portfolio } = usePortfolio();

  const initials = (user?.username || 'U').slice(0, 2).toUpperCase();
  const totalValue = portfolio?.totalValue ?? 0;
  const totalPnLPercent = portfolio?.totalPnLPercent ?? 0;
  const trades = portfolio?.trades ?? [];
  const positions = portfolio?.positions ?? [];

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-5xl mx-auto">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-sm font-medium mb-6 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} />
          Back to profile
        </Link>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <aside className="rounded-2xl p-6 h-fit" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-900/40 mb-4">
                <span className="text-white font-black text-3xl tracking-tight">{initials}</span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  @{user?.username || 'user'}
                </h1>
                <BadgeCheck size={20} className="text-blue-400" />
              </div>
              <p className="text-sm mt-1 break-all" style={{ color: 'var(--text-muted)' }}>{user?.email || '\u2014'}</p>
              <span className="mt-4 text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full font-bold tracking-wide">
                VERIFIED DEMO TRADER
              </span>
            </div>

            <div className="mt-6">
              <DetailRow icon={CalendarDays} label="Member Since" value={fmtDate(user?.createdAt)} />
              <DetailRow icon={ShieldCheck} label="Two-Factor Authentication" value={user?.twoFactorEnabled ? 'Enabled' : 'Disabled'} />
              <DetailRow icon={Wallet} label="Account Type" value="Paper Trading" />
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <StatCard label="Total Balance" value={fmtUSD(totalValue)} subtext={`${fmtPct(totalPnLPercent)} all time`} />
              <StatCard label="Trades" value={trades.length} subtext="Executed orders" />
              <StatCard label="Open Positions" value={positions.length} subtext="Active holdings" />
            </div>

            <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Personal Information</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Your account identity details are shown here for review.
              </p>
              <DetailRow icon={User} label="Username" value={user?.username} />
              <DetailRow icon={Mail} label="Email Address" value={user?.email} />
              <DetailRow icon={Phone} label="Phone Number" value={user?.phoneNumber} />
              <DetailRow icon={Fingerprint} label="Turkish ID Number" value={maskId(user?.tcKimlikNo)} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
