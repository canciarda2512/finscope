import { query } from '../services/ClickHouseClient.js';
import { getLatestPriceFromCache } from '../services/RedisBuffer.js';
import * as Indicators from '../services/IndicatorCalculator.js';
import { createNotification } from '../services/NotificationService.js';

/**
 * StrategyExecutor — runs active strategies against live price ticks.
 *
 * Called periodically (every 60s) by the main server loop.
 * For each active strategy, evaluates conditions against the latest
 * market data and indicator values, then triggers paper trade actions.
 */

const EVAL_INTERVAL_MS = 60_000;
let intervalId = null;

export function startStrategyExecutor() {
  if (intervalId) return;
  console.log('Strategy executor started (60s interval).');
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
      `SELECT id, userId, name FROM strategies FINAL WHERE isActive = 1`
    );

    if (strategies.length === 0) return;

    for (const strategy of strategies) {
      try {
        await evaluateStrategy(strategy);
      } catch (err) {
        console.error(`Strategy ${strategy.id} eval error:`, err.message);
      }
    }
  } catch (err) {
    console.error('Strategy executor cycle error:', err.message);
  }
}

async function evaluateStrategy(strategy) {
  const [{ rows: conditions }, { rows: actions }] = await Promise.all([
    query(`SELECT * FROM strategy_conditions FINAL WHERE strategyId = {id:String}`, { id: strategy.id }),
    query(`SELECT * FROM strategy_actions FINAL WHERE strategyId = {id:String}`, { id: strategy.id }),
  ]);

  if (conditions.length === 0 || actions.length === 0) return;

  // Determine which symbols this strategy cares about
  // For now, evaluate against BTCUSDT as the default symbol
  const symbol = 'BTCUSDT';
  const livePrice = await getLatestPriceFromCache(symbol);
  if (!livePrice || !Number.isFinite(livePrice)) return;

  // Fetch recent candles for indicator computation
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

  if (candleRows.length < 30) return;

  const candles = candleRows
    .map(r => ({
      time: Number(r.time),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }))
    .sort((a, b) => a.time - b.time);

  // Use last candle as current
  const currentCandle = { ...candles[candles.length - 1], close: livePrice };

  // Precompute indicators
  const indicatorValues = precomputeIndicators(candles, conditions);

  // Evaluate
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

  // Conditions met — create notification (paper trade execution would go here)
  const actionSummary = actions.map(a => {
    if (a.type === 'buy') return `BUY ${a.quantity}`;
    if (a.type === 'sell') return `SELL ${a.quantity}`;
    if (a.type === 'sell_all') return 'SELL ALL';
    if (a.type === 'close_position') return 'CLOSE POSITION';
    return a.type;
  }).join(', ');

  await createNotification(
    strategy.userId,
    'strategy_event',
    `Strategy "${strategy.name}" triggered`,
    `Conditions met on ${symbol} at $${livePrice.toLocaleString()}. Actions: ${actionSummary}`
  );
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
