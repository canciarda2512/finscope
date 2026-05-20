import { useState } from 'react';
import { Bell } from 'lucide-react';

function SettingsRow({ icon: Icon, title, desc, control }) {
  return (
    <div className="flex items-center justify-between py-4 last:border-0" style={{ borderBottom: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <Icon size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
        </div>
      </div>
      <div className="flex-shrink-0 ml-4">{control}</div>
    </div>
  );
}

function Toggle({ on = false, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full transition-all relative ${on ? 'bg-blue-500' : 'bg-[var(--bg-tertiary)]'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

const NOTIF_DEFAULTS = { tradeExecutions: true, priceAlerts: true, limitOrderFills: false };

export default function SettingsTab({ user }) {
  const storageKey = `finscope_notif_${user?.id || 'guest'}`;

  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return { ...NOTIF_DEFAULTS, ...saved };
    } catch {
      return { ...NOTIF_DEFAULTS };
    }
  });

  const update = (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-6">Notifications</h3>
        <SettingsRow icon={Bell} title="Trade Executions" desc="Get notified when your trades are filled"
          control={<Toggle on={prefs.tradeExecutions} onChange={v => update('tradeExecutions', v)} label="Trade Executions" />} />
        <SettingsRow icon={Bell} title="Price Alerts" desc="Receive alerts when price targets are hit"
          control={<Toggle on={prefs.priceAlerts} onChange={v => update('priceAlerts', v)} label="Price Alerts" />} />
        <SettingsRow icon={Bell} title="Limit Order Fills" desc="Alerts when limit orders execute"
          control={<Toggle on={prefs.limitOrderFills} onChange={v => update('limitOrderFills', v)} label="Limit Order Fills" />} />
      </div>
    </div>
  );
}
