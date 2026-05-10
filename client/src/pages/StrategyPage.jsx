
import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, Power, PowerOff, ChevronDown } from 'lucide-react';
import APIClient from '../services/APIClient';

const CONDITION_TYPES = [
  { value: 'indicator', label: 'Technical Indicator' },
  { value: 'price', label: 'Price Threshold' },
  { value: 'volume', label: 'Volume Condition' },
  { value: 'time', label: 'Time-Based' },
];

const INDICATOR_OPTIONS = [
  'RSI14', 'SMA20', 'SMA50', 'EMA12', 'EMA26', 'MACD',
  'BB_UPPER', 'BB_MIDDLE', 'BB_LOWER',
];

const PRICE_PARAMS = [
  { value: 'close', label: 'Close Price' },
  { value: 'open', label: 'Open Price' },
  { value: 'high', label: 'High Price' },
  { value: 'low', label: 'Low Price' },
];

const OPERATORS = ['>', '<', '>=', '<='];

const ACTION_TYPES = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'sell_all', label: 'Sell All' },
  { value: 'close_position', label: 'Close Position' },
];

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
];

function emptyCondition() {
  return { type: 'indicator', parameter: 'RSI14', operator: '<', value: 30 };
}
function emptyAction() {
  return { type: 'buy', quantity: 0.01 };
}

export default function StrategyPage() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [conditions, setConditions] = useState([emptyCondition()]);
  const [actions, setActions] = useState([emptyAction()]);
  const [creating, setCreating] = useState(false);

  // Backtest
  const [backtesting, setBacktesting] = useState(null);
  const [btSymbol, setBtSymbol] = useState('BTCUSDT');
  const [btDays, setBtDays] = useState(180);
  const [btResult, setBtResult] = useState(null);

  const fetchStrategies = async () => {
    try {
      const { data } = await APIClient.get('/strategy');
      setStrategies(data.strategies || []);
    } catch {
      setError('Failed to load strategies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStrategies(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await APIClient.post('/strategy', { name, conditions, actions });
      setName('');
      setConditions([emptyCondition()]);
      setActions([emptyAction()]);
      setShowCreate(false);
      fetchStrategies();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create strategy.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await APIClient.delete(`/strategy/${id}`);
      setStrategies(s => s.filter(x => x.id !== id));
    } catch {
      setError('Failed to delete strategy.');
    }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await APIClient.post(`/strategy/${id}/${isActive ? 'deactivate' : 'activate'}`);
      fetchStrategies();
    } catch {
      setError('Failed to toggle strategy.');
    }
  };

  const handleBacktest = async (id) => {
    setBacktesting(id);
    setBtResult(null);
    try {
      const { data } = await APIClient.post(`/strategy/${id}/backtest`, {
        symbol: btSymbol,
        days: btDays,
      });
      setBtResult(data);
      fetchStrategies();
    } catch (err) {
      setError(err.response?.data?.message || 'Backtest failed.');
    } finally {
      setBacktesting(null);
    }
  };

  // ── Condition/Action list helpers ──
  const updateCondition = (i, field, val) => {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  };
  const updateAction = (i, field, val) => {
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  };

  // ── Drag and drop for conditions ──
  const [dragIdx, setDragIdx] = useState(null);

  const onDragStart = (i) => setDragIdx(i);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (i) => {
    if (dragIdx === null || dragIdx === i) return;
    setConditions(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(i, 0, moved);
      return copy;
    });
    setDragIdx(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-400">Loading strategies...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Strategy Builder</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
        >
          <Plus size={16} /> New Strategy
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* ── Create Form ── */}
      {showCreate && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 space-y-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Strategy name"
            className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm"
          />

          {/* Conditions */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Conditions (drag to reorder)</h3>
            {conditions.map((c, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(i)}
                className="flex items-center gap-2 mb-2 bg-zinc-900 p-2 rounded-lg border border-zinc-700 cursor-grab"
              >
                <select value={c.type} onChange={e => updateCondition(i, 'type', e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs">
                  {CONDITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {c.type === 'indicator' && (
                  <select value={c.parameter} onChange={e => updateCondition(i, 'parameter', e.target.value)}
                    className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs">
                    {INDICATOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {c.type === 'price' && (
                  <select value={c.parameter} onChange={e => updateCondition(i, 'parameter', e.target.value)}
                    className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs">
                    {PRICE_PARAMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                )}
                {c.type === 'volume' && (
                  <span className="text-xs text-zinc-400 px-2">Volume</span>
                )}
                {c.type === 'time' && (
                  <span className="text-xs text-zinc-400 px-2">Hour (UTC)</span>
                )}

                <select value={c.operator} onChange={e => updateCondition(i, 'operator', e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs w-16">
                  {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>

                <input type="number" value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs w-24" />

                <button onClick={() => setConditions(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-300 p-1" disabled={conditions.length <= 1}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => setConditions(prev => [...prev, emptyCondition()])}
              className="text-xs text-blue-400 hover:text-blue-300">+ Add condition</button>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Actions</h3>
            {actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 bg-zinc-900 p-2 rounded-lg border border-zinc-700">
                <select value={a.type} onChange={e => updateAction(i, 'type', e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs">
                  {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {(a.type === 'buy' || a.type === 'sell') && (
                  <input type="number" value={a.quantity} onChange={e => updateAction(i, 'quantity', e.target.value)}
                    placeholder="Quantity" step="0.001"
                    className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-xs w-28" />
                )}

                <button onClick={() => setActions(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-300 p-1" disabled={actions.length <= 1}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => setActions(prev => [...prev, emptyAction()])}
              className="text-xs text-blue-400 hover:text-blue-300">+ Add action</button>
          </div>

          <button onClick={handleCreate} disabled={creating || !name.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-600 text-white rounded-lg text-sm">
            {creating ? 'Creating...' : 'Create Strategy'}
          </button>
        </div>
      )}

      {/* ── Strategy List ── */}
      {strategies.length === 0 && !showCreate && (
        <div className="text-center text-zinc-500 py-12">No strategies yet. Create one to get started.</div>
      )}

      {strategies.map(s => (
        <div key={s.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">{s.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive ? 'bg-green-500/20 text-green-400' : 'bg-zinc-600/30 text-zinc-400'}`}>
                {s.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleToggle(s.id, s.isActive)}
                className={`p-2 rounded-lg text-sm ${s.isActive ? 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/30' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}
                title={s.isActive ? 'Deactivate' : 'Activate'}>
                {s.isActive ? <PowerOff size={16} /> : <Power size={16} />}
              </button>
              <button onClick={() => handleDelete(s.id)}
                className="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Conditions summary */}
          <div className="text-xs text-zinc-400 space-y-1">
            <div className="font-semibold text-zinc-300">Conditions:</div>
            {(s.conditions || []).map((c, i) => (
              <div key={i} className="pl-3">
                {c.type === 'indicator' && `${c.parameter} ${c.operator} ${c.value}`}
                {c.type === 'price' && `${c.parameter} price ${c.operator} $${c.value}`}
                {c.type === 'volume' && `Volume ${c.operator} ${Number(c.value).toLocaleString()}`}
                {c.type === 'time' && `Hour (UTC) ${c.operator} ${c.value}`}
              </div>
            ))}
            <div className="font-semibold text-zinc-300 mt-1">Actions:</div>
            {(s.actions || []).map((a, i) => (
              <div key={i} className="pl-3">
                {a.type === 'buy' && `Buy ${a.quantity}`}
                {a.type === 'sell' && `Sell ${a.quantity}`}
                {a.type === 'sell_all' && 'Sell All'}
                {a.type === 'close_position' && 'Close Position'}
              </div>
            ))}
          </div>

          {/* Backtest controls */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-700">
            <select value={btSymbol} onChange={e => setBtSymbol(e.target.value)}
              className="bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-white text-xs">
              {SYMBOLS.map(sym => <option key={sym} value={sym}>{sym.replace('USDT', '/USDT')}</option>)}
            </select>
            <select value={btDays} onChange={e => setBtDays(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-white text-xs">
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
            </select>
            <button onClick={() => handleBacktest(s.id)}
              disabled={backtesting === s.id}
              className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-600 text-white rounded-lg text-xs">
              <Play size={12} /> {backtesting === s.id ? 'Running...' : 'Backtest'}
            </button>
          </div>

          {/* Backtest results */}
          {(btResult && backtesting === null && s.lastBacktestResult) && (
            <BacktestResults result={s.lastBacktestResult} />
          )}
          {s.lastBacktestResult && !btResult && (
            <BacktestResults result={s.lastBacktestResult} />
          )}
        </div>
      ))}
    </div>
  );
}

function BacktestResults({ result }) {
  if (!result) return null;
  const r = typeof result === 'string' ? tryParse(result) : result;
  if (!r) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-2">
      <h4 className="text-sm font-semibold text-zinc-300">Backtest Results</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <Stat label="Total Return" value={`${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn}%`}
          color={r.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Stat label="Win Rate" value={`${r.winRate}%`} color="text-blue-400" />
        <Stat label="Max Drawdown" value={`${r.maxDrawdown}%`} color="text-orange-400" />
        <Stat label="Sharpe Ratio" value={r.sharpeRatio} color="text-purple-400" />
        <Stat label="Final Balance" value={`$${Number(r.finalBalance || 0).toLocaleString()}`} color="text-white" />
        <Stat label="Total Trades" value={r.totalTrades} color="text-zinc-300" />
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className={`font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
