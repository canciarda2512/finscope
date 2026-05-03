import { useEffect, useState } from 'react';
import APIClient from '../services/APIClient';
import { useAuth } from '../context/AuthContext';

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
    <div className="flex items-center justify-between text-[10px] py-1 border-b border-slate-800 last:border-0">
      <div>
        <div className="font-bold text-white">
          {alert.symbol} {alert.condition} ${formatPrice(alert.targetPrice)}
        </div>
        <div className={triggered ? 'text-orange-400' : 'text-slate-500'}>
          {triggered ? `Triggered${triggeredAt ? ` - ${triggeredAt}` : ''}` : 'Active'}
        </div>
      </div>

      <button
        onClick={() => onDelete(alert.id)}
        disabled={deleting}
        className="text-red-400 hover:text-red-300 disabled:text-slate-600 disabled:cursor-not-allowed"
        title="Delete alert"
      >
        {deleting ? '...' : 'x'}
      </button>
    </div>
  );
}

export default function AlertPanel({ symbol, currentPrice }) {
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [condition, setCondition] = useState('>');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

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
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase">
          Price Alerts
        </div>
        {currentPrice && (
          <div className="text-[10px] text-slate-500 font-mono">
            ${formatPrice(currentPrice)}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-[10px] text-slate-600 mb-2">Loading...</div>
      )}

      {!isAuthenticated && (
        <div className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-900 rounded px-2 py-1 mb-2">
          Alertleri kullanmak icin giris yapin.
        </div>
      )}

      {error && (
        <div className="text-[10px] text-red-400 bg-red-950/40 border border-red-900 rounded px-2 py-1 mb-2">
          {error}
        </div>
      )}

      {!loading && isAuthenticated && alerts.length === 0 && (
        <div className="text-[10px] text-slate-600 mb-2">Henuz alert yok.</div>
      )}

      {triggeredAlerts.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-bold uppercase text-orange-400 mb-1">
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
          <div className="text-[9px] font-bold uppercase text-slate-500 mb-1">
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
          className="bg-slate-800 border border-slate-700 rounded px-1 py-1 text-[10px] text-white disabled:text-slate-500"
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
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] text-white outline-none disabled:text-slate-500"
        />

        <button
          onClick={addAlert}
          disabled={!canSubmit}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[10px] px-2 py-1 rounded font-bold"
        >
          {saving ? '...' : '+'}
        </button>
      </div>
    </div>
  );
}
