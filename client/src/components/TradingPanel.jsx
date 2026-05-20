
import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import APIClient from '../services/APIClient';

const DEMO_START_BALANCE = 100000;

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatCrypto(value) {
  return Number(value || 0).toFixed(6);
}

export default function TradingPanel({ symbol, currentPrice, selectedPrice }) {
  const [orderTab, setOrderTab] = useState('BUY');
  const [limitSide, setLimitSide] = useState('buy');
  const [inputMode, setInputMode] = useState('usdt'); // 'usdt' | 'crypto'
  const [orderAmount, setOrderAmount] = useState('1000');
  const [sellAllMode, setSellAllMode] = useState(false);
  const [orderPrice, setOrderPrice] = useState('');
  const [limitOrders, setLimitOrders] = useState([]);
  const [portfolioCash, setPortfolioCash] = useState(DEMO_START_BALANCE);
  const [cryptoBalance, setCryptoBalance] = useState(0);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');

  const ticker = symbol.replace('USDT', '');

  useEffect(() => {
    if (selectedPrice) setOrderPrice(selectedPrice);
  }, [selectedPrice]);

  useEffect(() => {
    if (currentPrice && !orderPrice) setOrderPrice(Number(currentPrice).toFixed(2));
  }, [currentPrice, orderPrice]);

  useEffect(() => {
    let cancelled = false;

    const loadTradingState = async () => {
      try {
        const [portfolioRes, ordersRes] = await Promise.all([
          APIClient.get('/portfolio'),
          APIClient.get('/trade/limit'),
        ]);

        if (!cancelled) {
          setPortfolioCash(Number(portfolioRes.data?.cash ?? portfolioRes.data?.balance ?? DEMO_START_BALANCE));
          const positions = portfolioRes.data?.positions || [];
          const pos = positions.find(p => p.symbol === symbol);
          setCryptoBalance(Number(pos?.quantity ?? 0));
          setLimitOrders(ordersRes.data?.orders || []);
        }
      } catch (err) {
        console.error('Trading state load error:', err);
      }
    };

    loadTradingState();
    const intervalId = window.setInterval(loadTradingState, 30000);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, [symbol]);

  const refreshTradingState = async () => {
    const [portfolioRes, ordersRes] = await Promise.all([
      APIClient.get('/portfolio'),
      APIClient.get('/trade/limit'),
    ]);
    setPortfolioCash(Number(portfolioRes.data?.cash ?? portfolioRes.data?.balance ?? DEMO_START_BALANCE));
    const positions = portfolioRes.data?.positions || [];
    const pos = positions.find(p => p.symbol === symbol);
    setCryptoBalance(Number(pos?.quantity ?? 0));
    setLimitOrders(ordersRes.data?.orders || []);
  };

  const handleOrderSubmit = async () => {
    if (orderLoading) return;

    const amount = Number(orderAmount);
    if (!sellAllMode && (!Number.isFinite(amount) || amount <= 0)) {
      setOrderMessage('Enter a valid amount.');
      return;
    }

    setOrderLoading(true);
    setOrderMessage('');

    try {
      const execPrice = orderTab === 'LIMIT' ? Number(orderPrice) : Number(currentPrice);

      const payload = sellAllMode
        ? { symbol, sellAll: true }
        : inputMode === 'crypto'
          ? { symbol, quantity: amount }
          : { symbol, amountUsd: amount };

      if (orderTab === 'LIMIT') {
        if (!Number.isFinite(execPrice) || execPrice <= 0) {
          setOrderMessage('Enter a valid target price.');
          setOrderLoading(false);
          return;
        }
        const res = await APIClient.post('/trade/limit', { ...payload, side: limitSide, targetPrice: execPrice });
        setLimitOrders(prev => [res.data.order, ...prev]);
        setOrderMessage(`Limit ${limitSide} order placed.`);
        window.dispatchEvent(new Event('notification:new'));
      } else {
        const side = orderTab === 'SELL' ? 'sell' : 'buy';
        const res = await APIClient.post('/trade/market', { ...payload, side });
        setOrderMessage(`${String(res.data.trade.type).toUpperCase()} filled at $${formatMoney(res.data.trade.price)}.`);
        window.dispatchEvent(new Event('notification:new'));
      }

      await refreshTradingState();
    } catch (err) {
      console.error('Order submit error:', err);
      setOrderMessage(err.response?.data?.message || 'Order could not be submitted.');
    } finally {
      setOrderLoading(false);
    }
  };

  const cancelLimitOrder = async (id) => {
    try {
      await APIClient.delete(`/trade/limit/${id}`);
      setLimitOrders(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error('Limit order cancel error:', err);
      setOrderMessage(err.response?.data?.message || 'Order could not be cancelled.');
    }
  };

  const execPrice = orderTab === 'LIMIT' ? Number(orderPrice) : Number(currentPrice);
  const amount = Number(orderAmount);

  const estCrypto = inputMode === 'usdt' ? (execPrice > 0 ? amount / execPrice : 0) : amount;
  const estUsdt = inputMode === 'crypto' ? amount * execPrice : amount;

  const isSell = orderTab === 'SELL' || (orderTab === 'LIMIT' && limitSide === 'sell');
  const submitTone = isSell ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white';
  const submitLabel = orderLoading
    ? 'PROCESSING...'
    : orderTab === 'SELL'
      ? `SELL ${ticker}`
      : orderTab === 'LIMIT'
        ? `PLACE LIMIT ${limitSide.toUpperCase()}`
        : `BUY ${ticker}`;

  return (
    <>
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Order Panel</div>

        {/* BUY / LIMIT / SELL tabs */}
        <div className="flex gap-1 mb-3">
          {['BUY', 'LIMIT', 'SELL'].map(tab => (
            <button key={tab} onClick={() => { setOrderTab(tab); setSellAllMode(false); }}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold transition ${orderTab === tab
                ? tab === 'BUY' ? 'bg-green-600 text-white'
                  : tab === 'SELL' ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Limit buy/sell toggle */}
        {orderTab === 'LIMIT' && (
          <div className="flex gap-1 mb-2">
            {[{ value: 'buy', label: 'Limit Buy' }, { value: 'sell', label: 'Limit Sell' }].map(opt => (
              <button key={opt.value} onClick={() => setLimitSide(opt.value)}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition ${limitSide === opt.value
                  ? opt.value === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Amount input with inline currency selector */}
        <div className="mb-2">
          <div className="text-[10px] text-slate-500 mb-1">Amount</div>
          <div className="flex rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)' }}>
            <input
              type="text"
              inputMode="decimal"
              value={orderAmount}
              onChange={e => setOrderAmount(e.target.value)}
              className="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <div className="flex flex-col items-center justify-center px-2" style={{ borderLeft: '1px solid var(--border-secondary)' }}>
              <button onClick={() => { setInputMode('usdt'); setOrderAmount(''); }} className={`leading-none transition ${inputMode === 'usdt' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                <ChevronUp size={11} />
              </button>
              <span className="text-[9px] font-bold px-0.5" style={{ color: 'var(--text-muted)' }}>
                {inputMode === 'usdt' ? 'USDT' : ticker}
              </span>
              <button onClick={() => { setInputMode('crypto'); setOrderAmount(''); }} className={`leading-none transition ${inputMode === 'crypto' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                <ChevronDown size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Limit target price */}
        {orderTab === 'LIMIT' && (
          <div className="mb-2">
            <div className="text-[10px] text-slate-500 mb-1">Target Price</div>
            <input
              type="number"
              value={orderPrice}
              onChange={e => setOrderPrice(e.target.value)}
              className="w-full rounded px-2 py-1.5 text-xs outline-none transition"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
            />
          </div>
        )}

        {/* Balance info */}
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Balance</span>
          <span className="text-white font-mono">${formatMoney(portfolioCash)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>{ticker} Balance</span>
          <span className="text-white font-mono">{formatCrypto(cryptoBalance)}</span>
        </div>

        {/* Estimated conversion */}
        <div className="flex justify-between text-[10px] text-slate-500 mb-3">
          {inputMode === 'usdt' ? (
            <>
              <span>Est. {ticker}</span>
              <span className="text-white font-mono">{estCrypto > 0 ? estCrypto.toFixed(6) : '-'}</span>
            </>
          ) : (
            <>
              <span>Est. USDT</span>
              <span className="text-white font-mono">{estUsdt > 0 ? `$${formatMoney(estUsdt)}` : '-'}</span>
            </>
          )}
        </div>

        {/* All Balance button for sell */}
        {isSell && cryptoBalance > 0 && (
          <button onClick={() => setSellAllMode(v => !v)}
            className={`w-full py-1 rounded text-[10px] font-semibold mb-2 transition ${
              sellAllMode
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            {sellAllMode ? `All Balance (${cryptoBalance.toFixed(6)} ${ticker})` : 'All Balance'}
          </button>
        )}

        {orderMessage && (
          <div className="text-[10px] rounded px-2 py-1 mb-2" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
            {orderMessage}
          </div>
        )}

        <button onClick={handleOrderSubmit} disabled={orderLoading}
          className={`w-full py-2 rounded-lg text-xs font-bold transition disabled:opacity-60 disabled:cursor-not-allowed ${submitTone}`}>
          {submitLabel}
        </button>
      </div>

      {/* Limit orders list */}
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Limit Orders</div>
        {limitOrders.length === 0 ? (
          <div className="text-[10px] text-slate-600">No open orders</div>
        ) : limitOrders.map(order => (
          <div key={order.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
            <div>
              <div className={`text-[10px] font-bold ${order.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {String(order.type).toUpperCase()} {order.symbol?.replace('USDT', '')} @ ${formatMoney(order.targetPrice)}
              </div>
              <div className="text-[10px] text-slate-500">{Number(order.quantity).toFixed(6)} units</div>
            </div>
            <button onClick={() => cancelLimitOrder(order.id)}
              className="text-[10px] px-2 py-0.5 rounded transition"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
