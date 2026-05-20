import crypto from 'crypto';
import { execute, insert, query } from './ClickHouseClient.js';
import { createNotification } from './NotificationService.js';
import { getLatestPriceFromCache, getLatestPricesFromCache, acquireLock, releaseLock } from './RedisBuffer.js';
import logger from '../utils/logger.js';

export const DEMO_START_BALANCE = 100000;

function nowClickHouse() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// Peak-to-trough max drawdown from the REALIZED PnL trajectory.
function calculateMaxDrawdown(sellTrades, startBalance) {
  if (!sellTrades || sellTrades.length === 0) return 0;

  let cumulativePnL = 0;
  let peakEquity    = startBalance;
  let maxDD         = 0;

  for (const trade of sellTrades) {
    const pnl = Number(trade.realizedPnL ?? 0);
    cumulativePnL   += pnl;
    const equity     = startBalance + cumulativePnL;
    if (equity > peakEquity) peakEquity = equity;
    if (peakEquity > 0) {
      const dd = ((peakEquity - equity) / peakEquity) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }

  return maxDD;
}

// Per-trade Sharpe ratio from realized return percentages.
function calculateSharpeRatio(enrichedTrades) {
  const returns = enrichedTrades
    .filter(t => t.type === 'sell' && t.realizedPnLPercent != null)
    .map(t => toNumber(t.realizedPnLPercent) / 100);

  if (returns.length < 2) return 0;

  const n    = returns.length;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const std  = Math.sqrt(variance);

  return std > 0 ? mean / std : 0;
}

function calculateRealizedPnL(trades) {
  const positionsBySymbol = new Map();
  const enrichedAscending = [];
  let realizedPnL = 0;
  let closedTrades = 0;
  let winningTrades = 0;

  const ascendingTrades = [...trades].sort((a, b) => (
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ));

  for (const trade of ascendingTrades) {
    const symbol = String(trade.symbol || '').toUpperCase();
    const type = String(trade.type || '').toLowerCase();
    const price = toNumber(trade.price);
    const quantity = toNumber(trade.quantity);
    const position = positionsBySymbol.get(symbol) || { quantity: 0, avgCost: 0 };

    let tradeRealizedPnL = null;
    let tradeRealizedPnLPercent = null;

    if (type === 'buy') {
      const nextQuantity = position.quantity + quantity;
      const nextCost = (position.quantity * position.avgCost) + (quantity * price);

      positionsBySymbol.set(symbol, {
        quantity: nextQuantity,
        avgCost: nextQuantity > 0 ? nextCost / nextQuantity : 0,
      });
    } else if (type === 'sell') {
      const closedQuantity = Math.min(quantity, position.quantity);
      const costBasis = position.avgCost;

      if (closedQuantity > 0 && costBasis > 0) {
        tradeRealizedPnL = (price - costBasis) * closedQuantity;
        tradeRealizedPnLPercent = ((price - costBasis) / costBasis) * 100;
        realizedPnL += tradeRealizedPnL;
        closedTrades += 1;
        if (tradeRealizedPnL > 0) winningTrades += 1;
      }

      const nextQuantity = Math.max(position.quantity - quantity, 0);
      positionsBySymbol.set(symbol, {
        quantity: nextQuantity,
        avgCost: nextQuantity > 0 ? position.avgCost : 0,
      });
    }

    enrichedAscending.push({
      ...trade,
      realizedPnL: tradeRealizedPnL,
      realizedPnLPercent: tradeRealizedPnLPercent,
    });
  }

  const enrichedById = new Map(enrichedAscending.map(trade => [trade.id, trade]));
  const enrichedTrades = trades.map(trade => enrichedById.get(trade.id) || trade);

  return {
    trades: enrichedTrades,
    realizedPnL,
    closedTrades,
    winningTrades,
    winRate: closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0,
    avgCosts: positionsBySymbol,
  };
}

export async function ensurePortfolio(userId) {
  const { rows } = await query(
    `
    SELECT *
    FROM portfolios FINAL
    WHERE userId = {userId:String}
    LIMIT 1
    `,
    { userId }
  );

  if (rows[0]) return rows[0];

  const portfolio = {
    userId,
    balance: DEMO_START_BALANCE,
    totalPnL: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    winRate: 0,
  };

  await insert('portfolios', [portfolio]);
  return portfolio;
}

export async function getLatestPrice(symbol) {
  const normalizedSymbol = String(symbol || '').toUpperCase();

  const cached = await getLatestPriceFromCache(normalizedSymbol);
  if (cached !== null && Number.isFinite(cached)) return cached;

  const { rows } = await query(
    `
    SELECT close
    FROM market_data
    WHERE symbol = {symbol:String}
    ORDER BY timestamp DESC
    LIMIT 1
    `,
    { symbol: normalizedSymbol }
  );

  return rows[0] ? toNumber(rows[0].close) : null;
}

async function getLatestPrices(symbols) {
  const normalized = symbols.map(s => String(s || '').toUpperCase()).filter(Boolean);
  if (normalized.length === 0) return new Map();

  // 1. Batch check Redis cache (single MGET)
  const priceMap = await getLatestPricesFromCache(normalized);

  // 2. Find cache misses and fetch from ClickHouse in a single query
  const misses = normalized.filter(s => !priceMap.has(s));
  if (misses.length > 0) {
    const placeholders = misses.map((_, i) => `{s${i}:String}`).join(', ');
    const params = Object.fromEntries(misses.map((s, i) => [`s${i}`, s]));

    const { rows } = await query(
      `
      SELECT symbol, argMax(close, timestamp) AS close
      FROM market_data
      WHERE symbol IN (${placeholders})
      GROUP BY symbol
      `,
      params
    );

    for (const row of rows) {
      const price = toNumber(row.close);
      if (price > 0) priceMap.set(row.symbol, price);
    }
  }

  return priceMap;
}

export async function getPositions(userId) {
  const { rows } = await query(
    `
    SELECT *
    FROM positions FINAL
    WHERE userId = {userId:String}
      AND quantity > 0
    ORDER BY symbol ASC
    `,
    { userId }
  );

  return rows;
}

export async function getTrades(userId) {
  const { rows } = await query(
    `
    SELECT *
    FROM trades FINAL
    WHERE userId = {userId:String}
    ORDER BY timestamp DESC
    `,
    { userId }
  );

  return rows;
}

export async function getOpenLimitOrders(userId) {
  const { rows } = await query(
    `
    SELECT *
    FROM limit_orders FINAL
    WHERE userId = {userId:String}
      AND status = 'pending'
    ORDER BY createdAt DESC
    `,
    { userId }
  );

  return rows;
}

export async function createLimitOrder({ userId, symbol, type, targetPrice, quantity }) {
  const portfolio = await ensurePortfolio(userId);

  const normalizedSymbol = String(symbol || '').toUpperCase();
  const normalizedType = String(type || '').toLowerCase();
  const price = toNumber(targetPrice);
  const qty = toNumber(quantity);

  if (!normalizedSymbol) throw new Error('Symbol is required');
  if (!['buy', 'sell'].includes(normalizedType)) throw new Error('Order type must be buy or sell');
  if (price <= 0) throw new Error('Target price must be positive');
  if (qty <= 0) throw new Error('Quantity must be positive');

  if (normalizedType === 'buy') {
    const cost = price * qty;
    if (toNumber(portfolio.balance) < cost) throw new Error('Insufficient demo balance');
  } else {
    const { rows: positionRows } = await query(
      `
      SELECT quantity
      FROM positions FINAL
      WHERE userId = {userId:String}
        AND symbol = {symbol:String}
      LIMIT 1
      `,
      { userId, symbol: normalizedSymbol }
    );

    const currentQty = toNumber(positionRows[0]?.quantity);
    if (currentQty < qty) throw new Error('Insufficient position quantity');
  }

  const order = {
    id: crypto.randomUUID(),
    userId,
    symbol: normalizedSymbol,
    type: normalizedType,
    targetPrice: price,
    quantity: qty,
    status: 'pending',
    notifiedAt: null,
    createdAt: nowClickHouse(),
  };

  await insert('limit_orders', [order]);
  return order;
}

export async function cancelLimitOrder(userId, id) {
  await execute(
    `
    ALTER TABLE limit_orders
    UPDATE status = 'cancelled'
    WHERE userId = {userId:String}
      AND id = {id:String}
      AND status = 'pending'
    `,
    { userId, id }
  );
}

export async function executeTrade({ userId, symbol, type, price, quantity }) {
  const portfolio = await ensurePortfolio(userId);
  const normalizedSymbol = String(symbol || '').toUpperCase();
  const normalizedType = String(type || '').toLowerCase();
  const executionPrice = toNumber(price);
  const qty = toNumber(quantity);
  const total = executionPrice * qty;

  if (!normalizedSymbol) throw new Error('Symbol is required');
  if (!['buy', 'sell'].includes(normalizedType)) throw new Error('Trade type must be buy or sell');
  if (executionPrice <= 0) throw new Error('Price must be positive');
  if (qty <= 0) throw new Error('Quantity must be positive');

  const { rows: positionRows } = await query(
    `
    SELECT *
    FROM positions FINAL
    WHERE userId = {userId:String}
      AND symbol = {symbol:String}
    LIMIT 1
    `,
    { userId, symbol: normalizedSymbol }
  );

  const existingPosition = positionRows[0];
  const currentQty = toNumber(existingPosition?.quantity);
  const currentEntry = toNumber(existingPosition?.entryPrice);
  const currentBalance = toNumber(portfolio.balance);

  if (normalizedType === 'buy') {
    if (currentBalance < total) throw new Error('Insufficient demo balance');

    // Atomic balance deduction
    await execute(
      `
      ALTER TABLE portfolios
      UPDATE balance = balance - {cost:Float64}
      WHERE userId = {userId:String}
      `,
      { userId, cost: total }
    );

    // Verify balance didn't go negative (concurrent trade race)
    const { rows: checkRows } = await query(
      `SELECT balance FROM portfolios FINAL WHERE userId = {userId:String} LIMIT 1`,
      { userId }
    );
    if (toNumber(checkRows[0]?.balance) < 0) {
      // Revert the deduction
      await execute(
        `ALTER TABLE portfolios UPDATE balance = balance + {cost:Float64} WHERE userId = {userId:String}`,
        { userId, cost: total }
      );
      throw new Error('Insufficient demo balance');
    }

    const nextQty = currentQty + qty;
    const nextEntry = nextQty > 0
      ? ((currentQty * currentEntry) + total) / nextQty
      : executionPrice;

    if (existingPosition) {
      await execute(
        `
        ALTER TABLE positions
        UPDATE quantity = {quantity:Float64},
               entryPrice = {entryPrice:Float64}
        WHERE userId = {userId:String}
          AND symbol = {symbol:String}
        `,
        { userId, symbol: normalizedSymbol, quantity: nextQty, entryPrice: nextEntry }
      );
    } else {
      await insert('positions', [{
        userId,
        symbol: normalizedSymbol,
        quantity: nextQty,
        entryPrice: nextEntry,
      }]);
    }
  } else {
    if (currentQty < qty) throw new Error('Insufficient position quantity');

    // Atomic balance credit
    await execute(
      `
      ALTER TABLE portfolios
      UPDATE balance = balance + {revenue:Float64}
      WHERE userId = {userId:String}
      `,
      { userId, revenue: total }
    );

    const nextQty = currentQty - qty;
    const nextEntry = nextQty > 0 ? currentEntry : 0;

    if (existingPosition) {
      await execute(
        `
        ALTER TABLE positions
        UPDATE quantity = {quantity:Float64},
               entryPrice = {entryPrice:Float64}
        WHERE userId = {userId:String}
          AND symbol = {symbol:String}
        `,
        { userId, symbol: normalizedSymbol, quantity: nextQty, entryPrice: nextEntry }
      );
    } else {
      await insert('positions', [{
        userId,
        symbol: normalizedSymbol,
        quantity: nextQty,
        entryPrice: nextEntry,
      }]);
    }
  }

  const trade = {
    id: crypto.randomUUID(),
    userId,
    symbol: normalizedSymbol,
    type: normalizedType,
    price: executionPrice,
    quantity: qty,
    total,
    timestamp: nowClickHouse(),
  };

  await insert('trades', [trade]);
  return trade;
}

export async function executeTriggeredLimitOrders(symbol, currentPrice) {
  const normalizedSymbol = String(symbol || '').toUpperCase();
  const price = toNumber(currentPrice);

  if (!normalizedSymbol || price <= 0) return [];

  const { rows: orders } = await query(
    `
    SELECT *
    FROM limit_orders FINAL
    WHERE symbol = {symbol:String}
      AND status = 'pending'
      AND (
        (type = 'buy' AND {price:Float64} <= targetPrice)
        OR
        (type = 'sell' AND {price:Float64} >= targetPrice)
      )
    `,
    { symbol: normalizedSymbol, price }
  );

  const executed = [];

  for (const order of orders) {
    // Distributed lock: prevents duplicate execution across multiple instances
    const lockKey = `limit-order:${order.id}`;
    const acquired = await acquireLock(lockKey, 30);
    if (!acquired) continue;

    try {
      const trade = await executeTrade({
        userId: order.userId,
        symbol: order.symbol,
        type: order.type,
        price,
        quantity: order.quantity,
      });

      await execute(
        `
        ALTER TABLE limit_orders
        UPDATE status = 'executed',
               notifiedAt = now64(3)
        WHERE userId = {userId:String}
          AND id = {id:String}
          AND status = 'pending'
        `,
        { userId: order.userId, id: order.id }
      );

      executed.push({ order, trade });

      // Fire-and-forget — notification failure must not block order processing
      createNotification({
        userId: order.userId,
        type: 'limit_order_triggered',
        title: 'Limit Order Filled',
        message: `${order.type.toUpperCase()} ${Number(order.quantity).toFixed(6)} ${order.symbol.replace('USDT', '')} at $${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        symbol: order.symbol,
      }).catch(err => logger.error({ err }, 'Notification error (limit order)'));
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'Limit order execution failed');

      // Mark as failed so it's not retried on every tick
      await execute(
        `
        ALTER TABLE limit_orders
        UPDATE status = 'failed'
        WHERE userId = {userId:String}
          AND id = {id:String}
          AND status = 'pending'
        `,
        { userId: order.userId, id: order.id }
      ).catch(failErr => logger.error({ err: failErr, orderId: order.id }, 'Failed to mark order as failed'));

      createNotification({
        userId: order.userId,
        type: 'limit_order_triggered',
        title: 'Limit Order Failed',
        message: `${order.type.toUpperCase()} ${Number(order.quantity).toFixed(6)} ${order.symbol.replace('USDT', '')} failed: ${err.message}`,
        symbol: order.symbol,
      }).catch(() => {});
    } finally {
      await releaseLock(lockKey);
    }
  }

  return executed;
}

export async function getEnrichedPositions(userId) {
  const [positions, trades] = await Promise.all([getPositions(userId), getTrades(userId)]);
  const realized = calculateRealizedPnL(trades);

  const priceMap = await getLatestPrices(positions.map(p => p.symbol));

  return positions.map(position => {
    const currentPrice = priceMap.get(position.symbol) || toNumber(position.entryPrice);
    const quantity = toNumber(position.quantity);
    const avgCost = realized.avgCosts.get(position.symbol)?.avgCost
      ?? toNumber(position.entryPrice);
    const value = quantity * currentPrice;
    const pnl = (currentPrice - avgCost) * quantity;

    return {
      ...position,
      avgCost,
      currentPrice,
      value,
      pnl,
      pnlPercent: avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0,
    };
  });
}

export async function getEnrichedTrades(userId) {
  const trades = await getTrades(userId);
  return calculateRealizedPnL(trades).trades;
}

export async function getPortfolioSnapshot(userId) {
  const [portfolio, positions, trades] = await Promise.all([
    ensurePortfolio(userId),
    getPositions(userId),
    getTrades(userId),
  ]);
  const realized = calculateRealizedPnL(trades);

  const priceMap = await getLatestPrices(positions.map(p => p.symbol));

  const enrichedPositions = [];
  let positionsValue = 0;
  let unrealizedPnL = 0;

  for (const position of positions) {
    const currentPrice = priceMap.get(position.symbol) || toNumber(position.entryPrice);
    const quantity = toNumber(position.quantity);
    const avgCost = realized.avgCosts.get(position.symbol)?.avgCost
      ?? toNumber(position.entryPrice);
    const value = quantity * currentPrice;
    const pnl = (currentPrice - avgCost) * quantity;

    positionsValue += value;
    unrealizedPnL += pnl;
    enrichedPositions.push({
      ...position,
      avgCost,
      currentPrice,
      value,
      pnl,
      pnlPercent: avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0,
    });
  }

  const balance = toNumber(portfolio.balance, DEMO_START_BALANCE);
  const totalValue = balance + positionsValue;
  const totalPnL = totalValue - DEMO_START_BALANCE;

  return {
    balance,
    cash: balance,
    startBalance: DEMO_START_BALANCE,
    positionsValue,
    totalValue,
    totalPnL,
    totalPnLPercent: (totalPnL / DEMO_START_BALANCE) * 100,
    realizedPnL: realized.realizedPnL,
    unrealizedPnL,
    closedTrades: realized.closedTrades,
    winningTrades: realized.winningTrades,
    winRate: realized.closedTrades > 0
      ? (realized.winningTrades / realized.closedTrades) * 100
      : 0,
    maxDrawdown: calculateMaxDrawdown(
      [...realized.trades]
        .filter(t => t.type === 'sell' && t.realizedPnL != null)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      DEMO_START_BALANCE
    ),
    sharpeRatio: calculateSharpeRatio(realized.trades),
    positions: enrichedPositions,
    trades: realized.trades,
  };
}

export async function getPerformanceDatapoints(userId) {
  const [portfolio, trades] = await Promise.all([
    ensurePortfolio(userId),
    getTrades(userId),
  ]);
  const ascendingTrades = [...trades].sort((a, b) => (
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ));
  const positionsBySymbol = new Map();
  const lastPriceBySymbol = new Map();
  let cash = DEMO_START_BALANCE;

  const calculateEquity = () => {
    let positionsValue = 0;
    for (const [symbol, quantity] of positionsBySymbol.entries()) {
      if (quantity <= 0) continue;
      positionsValue += quantity * toNumber(lastPriceBySymbol.get(symbol));
    }
    return cash + positionsValue;
  };

  const datapoints = [{
    date: 'Start',
    value: DEMO_START_BALANCE,
    label: 'Start',
  }];

  for (const trade of ascendingTrades) {
    const symbol = String(trade.symbol || '').toUpperCase();
    const type = String(trade.type || '').toLowerCase();
    const quantity = toNumber(trade.quantity);
    const price = toNumber(trade.price);
    const tradeTotal = toNumber(trade.total);
    const currentQuantity = toNumber(positionsBySymbol.get(symbol));

    lastPriceBySymbol.set(symbol, price);

    if (type === 'buy') {
      cash -= tradeTotal;
      positionsBySymbol.set(symbol, currentQuantity + quantity);
    } else if (type === 'sell') {
      cash += tradeTotal;
      positionsBySymbol.set(symbol, Math.max(currentQuantity - quantity, 0));
    }

    datapoints.push({
      date: trade.timestamp,
      value: calculateEquity(),
      label: `${type.toUpperCase()} ${symbol}`,
      tradeType: type,
      symbol,
    });
  }

  // Fetch live prices only for symbols still held (single batch query)
  const heldSymbols = [...positionsBySymbol.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([symbol]) => symbol);
  const livePrices = await getLatestPrices(heldSymbols);
  for (const [symbol, price] of livePrices) {
    lastPriceBySymbol.set(symbol, price);
  }

  datapoints.push({
    date: 'Now',
    value: calculateEquity(),
    label: 'Now',
  });

  return datapoints;
}

export default {
  DEMO_START_BALANCE,
  ensurePortfolio,
  getLatestPrice,
  getPositions,
  getTrades,
  getOpenLimitOrders,
  createLimitOrder,
  cancelLimitOrder,
  executeTrade,
  executeTriggeredLimitOrders,
  getEnrichedPositions,
  getEnrichedTrades,
  getPortfolioSnapshot,
  getPerformanceDatapoints,
};
