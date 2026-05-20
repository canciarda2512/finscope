import { Router } from 'express';
import logger from '../utils/logger.js';
import {
  cancelLimitOrder,
  createLimitOrder,
  executeTrade,
  getLatestPrice,
  getOpenLimitOrders,
} from '../services/PortfolioService.js';
import { query } from '../services/ClickHouseClient.js';
import { createNotification } from '../services/NotificationService.js';

import { validateSymbol, validateNumber } from '../utils/validation.js';

const router = Router();

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

router.post('/market', async (req, res, next) => {
  try {
    const userId = req.userId;
    const symbol = validateSymbol(req.body.symbol);
    if (!symbol) {
      return res.status(400).json({ message: `Invalid symbol: ${req.body.symbol}` });
    }
    const side = String(req.body.side || 'buy').toLowerCase();
    const amountUsd = toNumber(req.body.amountUsd);
    const requestedQuantity = toNumber(req.body.quantity);
    const sellAll = req.body.sellAll === true;
    const latestPrice = await getLatestPrice(symbol);

    if (!latestPrice || latestPrice <= 0) {
      return res.status(422).json({ message: 'No live price is available for this symbol yet.' });
    }

    let quantity;
    if (sellAll && side === 'sell') {
      const { rows } = await query(
        'SELECT quantity FROM positions FINAL WHERE userId = {userId:String} AND symbol = {symbol:String} LIMIT 1',
        { userId, symbol }
      );
      quantity = toNumber(rows[0]?.quantity);
    } else {
      quantity = requestedQuantity > 0 ? requestedQuantity : amountUsd / latestPrice;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid quantity or amount.' });
    }

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
    }).catch(err => logger.error({ err }, 'Notification error (market trade)'));

    return res.json({ trade });
  } catch (err) {
    if (err.message) return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.post('/limit', async (req, res, next) => {
  try {
    const userId = req.userId;
    const symbol = validateSymbol(req.body.symbol);
    if (!symbol) {
      return res.status(400).json({ message: `Invalid symbol: ${req.body.symbol}` });
    }
    const side = String(req.body.side || 'buy').toLowerCase();
    const targetPrice = toNumber(req.body.targetPrice);
    const amountUsd = toNumber(req.body.amountUsd);
    const requestedQuantity = toNumber(req.body.quantity);
    const quantity = requestedQuantity > 0
      ? requestedQuantity
      : targetPrice > 0 ? amountUsd / targetPrice : 0;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid quantity or amount.' });
    }

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
    }).catch(err => logger.error({ err }, 'Notification error (limit order create)'));

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
