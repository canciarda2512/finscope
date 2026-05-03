
import { useEffect, useState } from 'react';
import APIClient from '../services/APIClient';

const DEMO_START_BALANCE = 100000;

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function TradingPanel({ symbol, currentPrice, selectedPrice }) {
  const [orderTab, setOrderTab] = useState('BUY');
  const [limitSide, setLimitSide] = useState('buy');
  const [orderAmount, setOrderAmount] = useState('1000');
  const [orderPrice, setOrderPrice] = useState('');
  const [limitOrders, setLimitOrders] = useState([]);
  const [portfolioCash, setPortfolioCash] = useState(DEMO_START_BALANCE);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');

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

    const loadTradingState = async () => {
      try {
        const [portfolioRes, ordersRes] = await Promise.all([
          APIClient.get('/portfolio'),
          APIClient.get('/trade/limit'),
        ]);

        if (!cancelled) {
          setPortfolioCash(Number(portfolioRes.data?.cash ?? portfolioRes.data?.balance ?? DEMO_START_BALANCE));
          setLimitOrders(ordersRes.data?.orders || []);
        }
      } catch (err) {
        console.error('Trading state load error:', err);
      }
    };

    loadTradingState();
    const intervalId = window.setInterval(loadTradingState, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const refreshTradingState = async () => {
    const [portfolioRes, ordersRes] = await Promise.all([
      APIClient.get('/portfolio'),
      APIClient.get('/trade/limit'),
    ]);

    setPortfolioCash(Number(portfolioRes.data?.cash ?? portfolioRes.data?.balance ?? DEMO_START_BALANCE));
    setLimitOrders(ordersRes.data?.orders || []);
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
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-3">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Order Panel</div>
        <div className="flex gap-1 mb-3">
          {['BUY', 'LIMIT', 'SELL'].map(tab => (
            <button key={tab} onClick={() => setOrderTab(tab)}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold transition ${orderTab === tab
                ? tab === 'BUY' ? 'bg-green-600 text-white'
                  : tab === 'SELL' ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
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
                    : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="mb-2">
          <div className="text-[10px] text-slate-500 mb-1">Amount (USDT)</div>
          <input
            type="number"
            value={orderAmount}
            onChange={e => setOrderAmount(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>

        {orderTab === 'LIMIT' && (
          <div className="mb-2">
            <div className="text-[10px] text-slate-500 mb-1">Target Price</div>
            <input
              type="number"
              value={orderPrice}
              onChange={e => setOrderPrice(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Balance</span>
          <span className="text-white font-mono">${formatMoney(portfolioCash)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-3">
          <span>Est. {symbol.replace('USDT', '')}</span>
          <span className="text-white font-mono">
            {estimatedQuantity > 0 ? estimatedQuantity.toFixed(5) : '-'}
          </span>
        </div>

        {orderMessage && (
          <div className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 rounded px-2 py-1 mb-2">
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

      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-3">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Limit Orders</div>
        {limitOrders.length === 0 ? (
          <div className="text-[10px] text-slate-600">No open orders</div>
        ) : limitOrders.map(order => (
          <div key={order.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
            <div>
              <div className={`text-[10px] font-bold ${order.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {String(order.type).toUpperCase()} {order.symbol?.replace('USDT', '')} @ ${formatMoney(order.targetPrice)}
              </div>
              <div className="text-[10px] text-slate-500">{Number(order.quantity).toFixed(6)} units</div>
            </div>
            <button
              onClick={() => cancelLimitOrder(order.id)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-400 transition"
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
