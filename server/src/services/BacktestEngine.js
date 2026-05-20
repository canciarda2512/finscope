import * as Indicators from './IndicatorCalculator.js';

const INITIAL_BALANCE = 100000;

/**
 * Evaluate all conditions against the current candle and precomputed indicators.
 * Returns true if ALL conditions are met (AND logic).
 */
function evaluateConditions(conditions, candle, indicatorValues) {
  return conditions.every(cond => {
    const current = getConditionValue(cond, candle, indicatorValues);
    if (current === null) return false;

    const target = Number(cond.value);
    switch (cond.operator) {
      case '>':  return current > target;
      case '<':  return current < target;
      case '>=': return current >= target;
      case '<=': return current <= target;
      default:   return false;
    }
  });
}

function getConditionValue(cond, candle, indicatorValues) {
  switch (cond.type) {
    case 'indicator': {
      const key = `${cond.parameter}`.toUpperCase();
      const vals = indicatorValues[key];
      if (!vals) return null;
      const entry = vals.get(candle.time);
      return entry ?? null;
    }
    case 'price':
      return candle[cond.parameter] ?? candle.close;
    case 'volume':
      return candle.volume;
    case 'time': {
      const hour = new Date(candle.time * 1000).getUTCHours();
      return hour;
    }
    default:
      return null;
  }
}

/**
 * Precompute indicator values as Map<time, value> for quick lookup.
 */
function precomputeIndicators(candles, conditions) {
  const result = {};
  const indicatorConditions = conditions.filter(c => c.type === 'indicator');

  for (const cond of indicatorConditions) {
    const key = cond.parameter.toUpperCase();
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
    } else if (key.startsWith('BB_UPPER') || key.startsWith('BB_LOWER') || key.startsWith('BB_MIDDLE')) {
      const period = 20;
      const bb = Indicators.bollingerBands(candles, period);
      if (key.startsWith('BB_UPPER')) values = bb.upper;
      else if (key.startsWith('BB_LOWER')) values = bb.lower;
      else values = bb.middle;
    }

    result[key] = new Map(values.map(v => [v.time, v.value]));
  }

  return result;
}

/**
 * Run backtest: simulate strategy against candles.
 */
export function runBacktest(candles, conditions, actions) {
  const indicatorValues = precomputeIndicators(candles, conditions);

  let balance = INITIAL_BALANCE;
  let position = 0;   // quantity held
  let entryPrice = 0;
  const trades = [];
  const equityCurve = [INITIAL_BALANCE];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    if (!evaluateConditions(conditions, candle, indicatorValues)) {
      equityCurve.push(balance + position * candle.close);
      continue;
    }

    // Execute actions
    for (const action of actions) {
      const price = candle.close;

      switch (action.type) {
        case 'buy': {
          const qty = Number(action.quantity) || 0;
          const cost = qty * price;
          if (qty > 0 && balance >= cost) {
            balance -= cost;
            if (position === 0) entryPrice = price;
            else entryPrice = ((entryPrice * position) + cost) / (position + qty);
            position += qty;
            trades.push({ time: candle.time, type: 'buy', price, quantity: qty, total: cost });
          }
          break;
        }
        case 'sell': {
          const qty = Math.min(Number(action.quantity) || 0, position);
          if (qty > 0) {
            const revenue = qty * price;
            balance += revenue;
            position -= qty;
            trades.push({ time: candle.time, type: 'sell', price, quantity: qty, total: revenue });
            if (position === 0) entryPrice = 0;
          }
          break;
        }
        case 'sell_all': {
          if (position > 0) {
            const revenue = position * price;
            balance += revenue;
            trades.push({ time: candle.time, type: 'sell', price, quantity: position, total: revenue });
            position = 0;
            entryPrice = 0;
          }
          break;
        }
        case 'close_position': {
          if (position > 0) {
            const revenue = position * price;
            balance += revenue;
            trades.push({ time: candle.time, type: 'sell', price, quantity: position, total: revenue });
            position = 0;
            entryPrice = 0;
          }
          break;
        }
      }
    }

    equityCurve.push(balance + position * candle.close);
  }

  // Close any remaining position at last candle price
  const lastPrice = candles[candles.length - 1].close;
  const finalValue = balance + position * lastPrice;

  // Calculate metrics
  const totalReturn = ((finalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

  // Replay position to compute accurate win rate using weighted avg cost
  let replayQty = 0;
  let replayEntry = 0;
  let wins = 0;
  let sellCount = 0;
  for (const t of trades) {
    if (t.type === 'buy') {
      const newQty = replayQty + t.quantity;
      replayEntry = newQty > 0 ? ((replayQty * replayEntry) + t.total) / newQty : t.price;
      replayQty = newQty;
    } else if (t.type === 'sell') {
      sellCount++;
      if (replayEntry > 0 && t.price > replayEntry) wins++;
      replayQty = Math.max(replayQty - t.quantity, 0);
      if (replayQty === 0) replayEntry = 0;
    }
  }
  const winRate = sellCount > 0 ? (wins / sellCount) * 100 : 0;

  // Max drawdown from equity curve
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  for (const val of equityCurve) {
    if (val > peak) peak = val;
    const dd = ((peak - val) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Sharpe ratio (daily returns, risk-free = 0)
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    totalReturn: round(totalReturn),
    winRate: round(winRate),
    maxDrawdown: round(maxDrawdown),
    sharpeRatio: round(sharpeRatio),
    finalBalance: round(finalValue),
    totalTrades: trades.length,
    trades: trades.slice(0, 100), // cap at 100 for response size
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
