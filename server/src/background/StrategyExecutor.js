import { query } from '../services/ClickHouseClient.js';
import { getLatestPriceFromCache } from '../services/RedisBuffer.js';
import * as Indicators from '../services/IndicatorCalculator.js';
import { createNotification } from '../services/NotificationService.js';
import { executeTrade, getPositions } from '../services/PortfolioService.js';
import logger from '../utils/logger.js';

/**
 * StrategyExecutor — runs active strategies against live price ticks.
 *
 * Called periodically (every 60s) by the main server loop.
 * For each active strategy, evaluates conditions against the latest
 * market data and indicator values, then executes paper trade actions.
 */

const EVAL_INTERVAL_MS = 60_000;
const COOLDOWN_MS = 5 * 60_000; // 5 minutes between triggers for the same strategy
const lastTriggeredAt = new Map();  // strategyId -> timestamp
let intervalId = null;

export function startStrategyExecutor() {
  if (intervalId) return;
  logger.info('Strategy executor started (60s interval)');
  intervalId = setInterval(evaluateAllStrategies, EVAL_INTERVAL_MS);
}

export function stopStrategyExecutor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function evaluateAllStrategies() {
  try {
    const { rows: strategies } = await query(
      `SELECT id, userId, name, symbol FROM strategies FINAL WHERE isActive = 1`
    );

    if (strategies.length === 0) return;

    // Group by symbol to share candle data across strategies
    const bySymbol = new Map();
    for (const s of strategies) {
      const sym = String(s.symbol || 'BTCUSDT').toUpperCase();
      if (!bySymbol.has(sym)) bySymbol.set(sym, []);
      bySymbol.get(sym).push(s);
    }

    for (const [symbol, group] of bySymbol) {
      const candles = await fetchCandlesForSymbol(symbol);
      if (!candles) continue;

      for (const strategy of group) {
        try {
          await evaluateStrategy(strategy, candles);
        } catch (err) {
          logger.error({ err, strategyId: strategy.id }, 'Strategy eval error');
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Strategy executor cycle error');
  }
}

async function fetchCandlesForSymbol(symbol) {
  const { rows: candleRows } = await query(
    `SELECT
      toUnixTimestamp(timestamp) AS time,
      open, high, low, close, volume
    FROM market_data
    WHERE symbol = {symbol:String}
    ORDER BY timestamp DESC
    LIMIT 100`,
    { symbol }
  );

  if (candleRows.length < 30) return null;

  return candleRows
    .map(r => ({
      time: Number(r.time),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }))
    .sort((a, b) => a.time - b.time);
}

async function evaluateStrategy(strategy, candles) {
  // Cooldown: skip if this strategy triggered recently
  const lastTrigger = lastTriggeredAt.get(strategy.id) || 0;
  if (Date.now() - lastTrigger < COOLDOWN_MS) return;

  const [{ rows: conditions }, { rows: actions }] = await Promise.all([
    query(`SELECT * FROM strategy_conditions FINAL WHERE strategyId = {id:String}`, { id: strategy.id }),
    query(`SELECT * FROM strategy_actions FINAL WHERE strategyId = {id:String}`, { id: strategy.id }),
  ]);

  if (conditions.length === 0 || actions.length === 0) return;

  const symbol = String(strategy.symbol || 'BTCUSDT').toUpperCase();
  const livePrice = await getLatestPriceFromCache(symbol);
  if (!livePrice || !Number.isFinite(livePrice)) return;

  // Use last candle as current
  const currentCandle = { ...candles[candles.length - 1], close: livePrice };

  // Precompute indicators
  const indicatorValues = precomputeIndicators(candles, conditions);

  // Evaluate all conditions (AND logic)
  const allMet = conditions.every(cond => {
    const value = getConditionValue(cond, currentCandle, indicatorValues);
    if (value === null) return false;
    const target = Number(cond.value);
    switch (cond.operator) {
      case '>': return value > target;
      case '<': return value < target;
      case '>=': return value >= target;
      case '<=': return value <= target;
      default: return false;
    }
  });

  if (!allMet) return;

  // Mark as triggered (cooldown starts now)
  lastTriggeredAt.set(strategy.id, Date.now());

  // Execute each action as a real paper trade
  const executedActions = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'buy': {
          const qty = Number(action.quantity) || 0;
          if (qty <= 0) break;
          const trade = await executeTrade({
            userId: strategy.userId,
            symbol,
            type: 'buy',
            price: livePrice,
            quantity: qty,
          });
          executedActions.push(`BUY ${qty} at $${livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} (trade ${trade.id.slice(0, 8)})`);
          break;
        }
        case 'sell': {
          const qty = Number(action.quantity) || 0;
          if (qty <= 0) break;
          const trade = await executeTrade({
            userId: strategy.userId,
            symbol,
            type: 'sell',
            price: livePrice,
            quantity: qty,
          });
          executedActions.push(`SELL ${qty} at $${livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} (trade ${trade.id.slice(0, 8)})`);
          break;
        }
        case 'sell_all':
        case 'close_position': {
          const positions = await getPositions(strategy.userId);
          const position = positions.find(p => String(p.symbol).toUpperCase() === symbol);
          const posQty = Number(position?.quantity || 0);
          if (posQty <= 0) {
            executedActions.push(`${action.type.toUpperCase()}: no position to close`);
            break;
          }
          const trade = await executeTrade({
            userId: strategy.userId,
            symbol,
            type: 'sell',
            price: livePrice,
            quantity: posQty,
          });
          executedActions.push(`SOLD ALL ${posQty} at $${livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} (trade ${trade.id.slice(0, 8)})`);
          break;
        }
      }
    } catch (err) {
      executedActions.push(`${action.type.toUpperCase()} failed: ${err.message}`);
    }
  }

  // Notify user about the execution
  const summary = executedActions.length > 0
    ? executedActions.join('; ')
    : 'No actions could be executed';

  await createNotification({
    userId: strategy.userId,
    type: 'strategy_event',
    title: `Strategy "${strategy.name}" executed`,
    message: `${symbol} at $${livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} — ${summary}`,
    symbol,
  });

  logger.info({ strategyId: strategy.id, strategyName: strategy.name, summary }, 'Strategy executed');
}

function precomputeIndicators(candles, conditions) {
  const result = {};
  const indicatorConditions = conditions.filter(c => c.type === 'indicator');

  for (const cond of indicatorConditions) {
    const key = String(cond.parameter).toUpperCase();
    if (result[key]) continue;

    let values = [];
    if (key.startsWith('SMA')) {
      const period = parseInt(key.replace('SMA', '')) || 20;
      values = Indicators.sma(candles, period);
    } else if (key.startsWith('EMA')) {
      const period = parseInt(key.replace('EMA', '')) || 20;
      values = Indicators.ema(candles, period);
    } else if (key.startsWith('RSI')) {
      const period = parseInt(key.replace('RSI', '')) || 14;
      values = Indicators.rsi(candles, period);
    } else if (key === 'MACD') {
      const { macdLine } = Indicators.macd(candles);
      values = macdLine;
    } else if (key.startsWith('BB_')) {
      const bb = Indicators.bollingerBands(candles, 20);
      if (key.startsWith('BB_UPPER')) values = bb.upper;
      else if (key.startsWith('BB_LOWER')) values = bb.lower;
      else values = bb.middle;
    }

    result[key] = new Map(values.map(v => [v.time, v.value]));
  }

  return result;
}

function getConditionValue(cond, candle, indicatorValues) {
  switch (cond.type) {
    case 'indicator': {
      const key = String(cond.parameter).toUpperCase();
      const vals = indicatorValues[key];
      if (!vals) return null;
      const entry = vals.get(candle.time);
      return entry ?? null;
    }
    case 'price':
      return candle[cond.parameter] ?? candle.close;
    case 'volume':
      return candle.volume;
    case 'time':
      return new Date(candle.time * 1000).getUTCHours();
    default:
      return null;
  }
}
