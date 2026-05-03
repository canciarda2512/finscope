import { Router } from 'express';
import {
  cancelLimitOrder,
  createLimitOrder,
  executeTrade,
  getLatestPrice,
  getOpenLimitOrders,
} from '../services/PortfolioService.js';
import { createNotification } from '../services/NotificationService.js';

const router = Router();

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

router.post('/market', async (req, res, next) => {
  try {
    const userId = req.userId;
    const symbol = String(req.body.symbol || '').toUpperCase();
    const side = String(req.body.side || 'buy').toLowerCase();
    const amountUsd = toNumber(req.body.amountUsd);
    const requestedQuantity = toNumber(req.body.quantity);
    const latestPrice = await getLatestPrice(symbol);

    if (!latestPrice) {
      return res.status(422).json({ message: 'No live price is available for this symbol yet.' });
    }

    const quantity = requestedQuantity > 0
      ? requestedQuantity
      : amountUsd / latestPrice;

    const trade = await executeTrade({
      userId,
      symbol,
      type: side,
      price: latestPrice,
      quantity,
    });

    // Fire-and-forget — notification failure must not affect trade response
    createNotification({
      userId,
      type: 'trade_executed',
      title: `Market ${side === 'buy' ? 'Buy' : 'Sell'} Executed`,
      message: `${side.toUpperCase()} ${quantity.toFixed(6)} ${symbol.replace('USDT', '')} at $${latestPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      symbol,
    }).catch(err => console.error('Notification error (market trade):', err.message));

    return res.json({ trade });
  } catch (err) {
    if (err.message) return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.post('/limit', async (req, res, next) => {
  try {
    const userId = req.userId;
    const symbol = String(req.body.symbol || '').toUpperCase();
    const side = String(req.body.side || 'buy').toLowerCase();
    const targetPrice = toNumber(req.body.targetPrice);
    const amountUsd = toNumber(req.body.amountUsd);
    const requestedQuantity = toNumber(req.body.quantity);
    const quantity = requestedQuantity > 0
      ? requestedQuantity
      : amountUsd / targetPrice;

    const order = await createLimitOrder({
      userId,
      symbol,
      type: side,
      targetPrice,
      quantity,
    });

    // Fire-and-forget - limit order creation should also show in the navbar.
    createNotification({
      userId,
      type: 'limit_order_created',
      title: `Limit ${side === 'buy' ? 'Buy' : 'Sell'} Placed`,
      message: `${side.toUpperCase()} ${quantity.toFixed(6)} ${symbol.replace('USDT', '')} at target $${targetPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      symbol,
    }).catch(err => console.error('Notification error (limit order create):', err.message));

    return res.json({ order });
  } catch (err) {
    if (err.message) return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.delete('/limit/:id', async (req, res, next) => {
  try {
    await cancelLimitOrder(req.userId, req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/limit', async (req, res, next) => {
  try {
    const orders = await getOpenLimitOrders(req.userId);
    return res.json({ orders });
  } catch (err) {
    next(err);
  }
});

export default router;
