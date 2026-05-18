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

// Peak-to-trough max drawdown from the REALIZED PnL trajectory.
// Tracks cumulative realized PnL after each sell trade and measures the
// largest peak→trough decline as a % of the portfolio's peak equity.
// Buying into positions does NOT count as a drawdown — only actual
// realized losses (selling below cost basis) do.
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

  return maxDD; // positive number; 0 means no drawdown so far
}

// Per-trade Sharpe ratio from realized return percentages.
// Requires at least 2 closed sell trades; risk-free rate = 0 (holding
// period per trade is unknown so annualizing a fixed rf would be misleading).
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
    // Authoritative avgCost per symbol derived from full trade replay
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
    // Use avgCost from trade replay as the authoritative cost basis.
    // Falls back to DB entryPrice only if trade history is empty.
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

  const sellTrades = [...realized.trades]
    .filter(t => t.type === 'sell' && t.realizedPnL != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const maxDrawdown = calculateMaxDrawdown(sellTrades, DEMO_START_BALANCE);

  // ── Win Rate: winning closed trades / total closed sell trades ─────────────
  const winRate = realized.closedTrades > 0
    ? (realized.winningTrades / realized.closedTrades) * 100
    : 0;

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
    winRate,
    maxDrawdown,
    sharpeRatio: calculateSharpeRatio(realized.trades),
    positions: enrichedPositions,
    trades: realized.trades,
  };
}

export async function getPerformanceDatapoints(userId) {
  const snapshot = await getPortfolioSnapshot(userId);
  const ascendingTrades = [...snapshot.trades].reverse();
  let value = DEMO_START_BALANCE;

  const datapoints = [{
    date: 'Start',
    value,
  }];

  for (const trade of ascendingTrades) {
    const tradeTotal = toNumber(trade.total);
    if (trade.type === 'buy') {
      value -= tradeTotal; 
    } else if (trade.type === 'sell') {
      value += tradeTotal; 
    }
    datapoints.push({
      date: trade.timestamp,
      value,
    });
  }

  datapoints.push({
    date: 'Now',
    value: snapshot.totalValue,
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
