import crypto from 'crypto';
import { execute, insert, query } from './ClickHouseClient.js';
import { createNotification } from './NotificationService.js';
import { getLatestPriceFromCache } from './RedisBuffer.js';

export const DEMO_START_BALANCE = 100000;
const processingLimitOrderIds = new Set();

function nowClickHouse() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
    FROM trades
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
  await ensurePortfolio(userId);

  const normalizedSymbol = String(symbol || '').toUpperCase();
  const normalizedType = String(type || '').toLowerCase();
  const price = toNumber(targetPrice);
  const qty = toNumber(quantity);

  if (!normalizedSymbol) throw new Error('Symbol is required');
  if (!['buy', 'sell'].includes(normalizedType)) throw new Error('Order type must be buy or sell');
  if (price <= 0) throw new Error('Target price must be positive');
  if (qty <= 0) throw new Error('Quantity must be positive');

  if (normalizedType === 'buy') {
    const portfolio = await ensurePortfolio(userId);
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

  let nextBalance = currentBalance;
  let nextQty = currentQty;
  let nextEntry = currentEntry;

  if (normalizedType === 'buy') {
    if (currentBalance < total) throw new Error('Insufficient demo balance');

    nextBalance = currentBalance - total;
    nextQty = currentQty + qty;
    nextEntry = nextQty > 0
      ? ((currentQty * currentEntry) + total) / nextQty
      : executionPrice;
  } else {
    if (currentQty < qty) throw new Error('Insufficient position quantity');

    nextBalance = currentBalance + total;
    nextQty = currentQty - qty;
    nextEntry = nextQty > 0 ? currentEntry : 0;
  }

  await execute(
    `
    ALTER TABLE portfolios
    UPDATE balance = {balance:Float64}
    WHERE userId = {userId:String}
    `,
    { userId, balance: nextBalance }
  );

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
    if (processingLimitOrderIds.has(order.id)) continue;
    processingLimitOrderIds.add(order.id);

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
      }).catch(err => console.error('Notification error (limit order):', err.message));
    } catch (err) {
      console.error(`Limit order execution failed (${order.id}):`, err.message);
      processingLimitOrderIds.delete(order.id);
    }
  }

  return executed;
}

export async function getPortfolioSnapshot(userId) {
  const portfolio = await ensurePortfolio(userId);
  const positions = await getPositions(userId);
  const trades = await getTrades(userId);
  const realized = calculateRealizedPnL(trades);

  const enrichedPositions = [];
  let positionsValue = 0;
  let unrealizedPnL = 0;

  for (const position of positions) {
    const latestPrice = await getLatestPrice(position.symbol);
    const currentPrice = latestPrice || toNumber(position.entryPrice);
    const quantity = toNumber(position.quantity);
    // Use avgCost from trade replay as authoritative cost basis;
    // fall back to DB entryPrice only if no trade history exists.
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
    sharpeRatio: toNumber(portfolio.sharpeRatio),
    maxDrawdown: toNumber(portfolio.maxDrawdown),
    winRate: realized.winRate,
    positions: enrichedPositions,
    trades: realized.trades,
  };
}

export async function getPerformanceDatapoints(userId) {
  const snapshot = await getPortfolioSnapshot(userId);
  const ascendingTrades = [...snapshot.trades].sort((a, b) => (
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

  datapoints.push({
    date: 'Now',
    value: snapshot.totalValue,
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
  getPortfolioSnapshot,
  getPerformanceDatapoints,
};
