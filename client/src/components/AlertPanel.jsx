import { useEffect, useState } from 'react';
import APIClient from '../services/APIClient';
import { useAuth } from '../context/Authcontext';

function isTriggered(alert) {
  return alert.triggered === 1 || alert.triggered === '1' || alert.triggered === true;
}

function formatPrice(value) {
  const price = Number(value);
  return Number.isFinite(price)
    ? price.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : value;
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('tr-TR');
}

function AlertRow({ alert, deleting, onDelete }) {
  const triggered = isTriggered(alert);
  const triggeredAt = formatDate(alert.missedAt || alert.triggeredAt);

  return (
    <div className="flex items-center justify-between text-[10px] py-1 last:border-0" style={{ borderBottom: '1px solid var(--border-primary)' }}>
      <div>
        <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
          {alert.symbol} {alert.condition} ${formatPrice(alert.targetPrice)}
        </div>
        <div style={{ color: triggered ? '#f97316' : 'var(--text-muted)' }}>
          {triggered ? `Triggered${triggeredAt ? ` - ${triggeredAt}` : ''}` : 'Active'}
        </div>
      </div>

      <button
        onClick={() => onDelete(alert.id)}
        disabled={deleting}
        className="disabled:cursor-not-allowed"
        style={{ color: deleting ? 'var(--text-dim)' : 'var(--red)' }}
        title="Delete alert"
      >
        {deleting ? '...' : 'x'}
      </button>
    </div>
  );
}

export default function AlertPanel({ symbol, currentPrice, pendingPrice, onPendingPriceConsumed }) {
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [condition, setCondition] = useState('>');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  // Pre-fill from right-click context menu
  useEffect(() => {
    if (pendingPrice && Number.isFinite(pendingPrice)) {
      setTargetPrice(pendingPrice.toFixed(2));
      setCondition(currentPrice && pendingPrice > currentPrice ? '>' : '<');
      onPendingPriceConsumed?.();
    }
  }, [pendingPrice]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAlerts([]);
      return;
    }

    let cancelled = false;

    const loadAlerts = (showLoading = false) => {
      if (showLoading) setLoading(true);
      setError('');

      APIClient.get('/alerts')
        .then(res => {
          if (!cancelled) setAlerts(res.data.alerts || []);
        })
        .catch(err => {
          if (!cancelled) {
            console.error('Alert load error:', err);
            setError(err.response?.data?.message || 'Alertler yuklenemedi.');
          }
        })
        .finally(() => {
          if (!cancelled && showLoading) setLoading(false);
        });
    };

    loadAlerts(true);
    const intervalId = window.setInterval(() => loadAlerts(false), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  const addAlert = async () => {
    const price = Number(targetPrice);
    if (!isAuthenticated || saving || !Number.isFinite(price) || price <= 0) return;

    setSaving(true);
    setError('');

    try {
      const res = await APIClient.post('/alerts', {
        symbol,
        condition,
        targetPrice: price,
      });

      setAlerts(prev => [res.data.alert, ...prev]);
      setTargetPrice('');
    } catch (err) {
      console.error('Alert create error:', err);
      setError(err.response?.data?.message || 'Alert olusturulamadi.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAlert = async (id) => {
    if (deletingId) return;

    setDeletingId(id);
    setError('');

    try {
      await APIClient.delete(`/alerts/${id}`);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Alert delete error:', err);
      setError(err.response?.data?.message || 'Alert silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const activeAlerts = alerts.filter(alert => !isTriggered(alert));
  const triggeredAlerts = alerts.filter(isTriggered);
  const canSubmit = isAuthenticated && !saving && Number(targetPrice) > 0;

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
          Price Alerts
        </div>
        {currentPrice && (
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            ${formatPrice(currentPrice)}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-[10px] mb-2" style={{ color: 'var(--text-dim)' }}>Loading...</div>
      )}

      {!isAuthenticated && (
        <div className="text-[10px] rounded px-2 py-1 mb-2" style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          Sign in to use price alerts.
        </div>
      )}

      {error && (
        <div className="text-[10px] rounded px-2 py-1 mb-2" style={{ color: 'var(--red)', backgroundColor: 'var(--red-muted)', border: '1px solid var(--red)' }}>
          {error}
        </div>
      )}

      {!loading && isAuthenticated && alerts.length === 0 && (
        <div className="text-[10px] mb-2" style={{ color: 'var(--text-dim)' }}>No alerts yet.</div>
      )}

      {triggeredAlerts.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-bold uppercase mb-1" style={{ color: '#f97316' }}>
            Triggered While Away
          </div>
          {triggeredAlerts.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              deleting={deletingId === alert.id}
              onDelete={deleteAlert}
            />
          ))}
        </div>
      )}

      {activeAlerts.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
            Active
          </div>
          {activeAlerts.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              deleting={deletingId === alert.id}
              onDelete={deleteAlert}
            />
          ))}
        </div>
      )}

      <div className="flex gap-1 mt-2">
        <select
          value={condition}
          onChange={e => setCondition(e.target.value)}
          disabled={!isAuthenticated || saving}
          className="rounded px-1 py-1 text-[10px] outline-none disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
        >
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
        </select>

        <input
          type="number"
          placeholder="Price"
          value={targetPrice}
          onChange={e => setTargetPrice(e.target.value)}
          disabled={!isAuthenticated || saving}
          className="flex-1 rounded px-2 py-1 text-[10px] outline-none disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
        />

        <button
          onClick={addAlert}
          disabled={!canSubmit}
          className="text-white text-[10px] px-2 py-1 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {saving ? '...' : '+'}
        </button>
      </div>
    </div>
  );
}
