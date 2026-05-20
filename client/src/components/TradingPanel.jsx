
import { useEffect, useState } from 'react';
import APIClient from '../services/APIClient';
import { usePortfolio } from '../context/PortfolioContext';

const DEMO_START_BALANCE = 100000;

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function TradingPanel({ symbol, currentPrice, selectedPrice }) {
  const { portfolio, refresh: refreshPortfolio } = usePortfolio();
  const [orderTab, setOrderTab] = useState('BUY');
  const [limitSide, setLimitSide] = useState('buy');
  const [orderAmount, setOrderAmount] = useState('1000');
  const [orderPrice, setOrderPrice] = useState('');
  const [limitOrders, setLimitOrders] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');

  const portfolioCash = Number(portfolio?.cash ?? portfolio?.balance ?? DEMO_START_BALANCE);

  useEffect(() => {
    if (selectedPrice) {
      setOrderPrice(selectedPrice);
    }
  }, [selectedPrice]);

  useEffect(() => {
    if (currentPrice && !orderPrice) {
      setOrderPrice(Number(currentPrice).toFixed(2));
    }
  }, [currentPrice, orderPrice]);

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      try {
        const res = await APIClient.get('/trade/limit');
        if (!cancelled) setLimitOrders(res.data?.orders || []);
      } catch (err) {
        console.error('Limit orders load error:', err);
      }
    };

    loadOrders();
    const intervalId = window.setInterval(loadOrders, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const refreshTradingState = async () => {
    refreshPortfolio();
    try {
      const res = await APIClient.get('/trade/limit');
      setLimitOrders(res.data?.orders || []);
    } catch (err) {
      console.error('Limit orders refresh error:', err);
    }
  };

  const handleOrderSubmit = async () => {
    if (orderLoading) return;

    const amountUsd = Number(orderAmount);
    const targetPrice = Number(orderPrice);

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      setOrderMessage('Enter a valid amount.');
      return;
    }

    setOrderLoading(true);
    setOrderMessage('');

    try {
      if (orderTab === 'LIMIT') {
        if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
          setOrderMessage('Enter a valid target price.');
          return;
        }

        const res = await APIClient.post('/trade/limit', {
          symbol,
          side: limitSide,
          amountUsd,
          targetPrice,
        });

        setLimitOrders(prev => [res.data.order, ...prev]);
        setOrderMessage(`Limit ${limitSide} order placed.`);
        window.dispatchEvent(new Event('notification:new'));
      } else {
        const res = await APIClient.post('/trade/market', {
          symbol,
          side: orderTab === 'SELL' ? 'sell' : 'buy',
          amountUsd,
        });

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

  const submitTone = orderTab === 'SELL' || (orderTab === 'LIMIT' && limitSide === 'sell')
    ? 'bg-red-600 hover:bg-red-500 text-white'
    : 'bg-green-600 hover:bg-green-500 text-white';
  const estimatedQuantityPrice = orderTab === 'LIMIT' ? Number(orderPrice) : Number(currentPrice);
  const estimatedQuantity = estimatedQuantityPrice > 0 ? Number(orderAmount) / estimatedQuantityPrice : 0;
  const submitLabel = orderLoading
    ? 'PROCESSING...'
    : orderTab === 'SELL'
      ? `SELL ${symbol.replace('USDT', '')}`
      : orderTab === 'LIMIT'
        ? `PLACE LIMIT ${limitSide.toUpperCase()}`
        : `BUY ${symbol.replace('USDT', '')}`;

  return (
    <>
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Order Panel</div>
        <div className="flex gap-1 mb-3">
          {['BUY', 'LIMIT', 'SELL'].map(tab => (
            <button key={tab} onClick={() => setOrderTab(tab)}
              aria-pressed={orderTab === tab}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold transition ${orderTab === tab
                ? tab === 'BUY' ? 'bg-green-600 text-white'
                  : tab === 'SELL' ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                : 'opacity-60'}`}>
              {tab}
            </button>
          ))}
        </div>

        {orderTab === 'LIMIT' && (
          <div className="flex gap-1 mb-2">
            {[
              { value: 'buy', label: 'Limit Buy' },
              { value: 'sell', label: 'Limit Sell' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setLimitSide(option.value)}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition ${
                  limitSide === option.value
                    ? option.value === 'buy'
                      ? 'bg-green-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'opacity-60'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="mb-2">
          <label htmlFor="order-amount" className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Amount (USDT)</label>
          <input
            id="order-amount"
            type="number"
            value={orderAmount}
            onChange={e => setOrderAmount(e.target.value)}
            aria-label="Order amount in USDT"
            className="w-full rounded px-2 py-1.5 text-xs outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
          />
        </div>

        {orderTab === 'LIMIT' && (
          <div className="mb-2">
            <label htmlFor="target-price" className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Target Price</label>
            <input
              id="target-price"
              type="number"
              value={orderPrice}
              onChange={e => setOrderPrice(e.target.value)}
              aria-label="Limit order target price"
              className="w-full rounded px-2 py-1.5 text-xs outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' }}
            />
          </div>
        )}

        <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
          <span>Balance</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>${formatMoney(portfolioCash)}</span>
        </div>
        <div className="flex justify-between text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          <span>Est. {symbol.replace('USDT', '')}</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
            {estimatedQuantity > 0 ? estimatedQuantity.toFixed(5) : '-'}
          </span>
        </div>

        {orderMessage && (
          <div role="status" aria-live="polite" className="text-[10px] rounded px-2 py-1 mb-2" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
            {orderMessage}
          </div>
        )}

        <button
          onClick={handleOrderSubmit}
          disabled={orderLoading}
          className={`w-full py-2 rounded-lg text-xs font-bold transition disabled:opacity-60 disabled:cursor-not-allowed ${submitTone}`}
        >
          {submitLabel}
        </button>
      </div>

      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Limit Orders</div>
        {limitOrders.length === 0 ? (
          <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>No open orders</div>
        ) : limitOrders.map(order => (
          <div key={order.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
            <div>
              <div className={`text-[10px] font-bold ${order.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {String(order.type).toUpperCase()} {order.symbol?.replace('USDT', '')} @ ${formatMoney(order.targetPrice)}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{Number(order.quantity).toFixed(6)} units</div>
            </div>
            <button
              onClick={() => cancelLimitOrder(order.id)}
              aria-label={`Cancel ${String(order.type).toUpperCase()} order for ${order.symbol}`}
              className="text-[10px] px-2 py-0.5 rounded transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
