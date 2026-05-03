/**
 * IndicatorCalculator — server-side technical indicator calculations.
 *
 * All functions accept:
 *   data: Array of { time: number, open, high, low, close, volume }
 *         Must be sorted ascending by time.
 *
 * All functions return:
 *   Array of { time: number, value: number }   — except macd() which returns
 *   { macdLine, signalLine, histogram }
 */

export function sma(data, period = 20) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const value = slice.reduce((s, c) => s + c.close, 0) / period;
    result.push({ time: data[i].time, value });
  }
  return result;
}

export function ema(data, period = 20) {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let prev = data.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  const result = [{ time: data[period - 1].time, value: prev }];
  for (let i = period; i < data.length; i++) {
    prev = data[i].close * k + prev * (1 - k);
    result.push({ time: data[i].time, value: prev });
  }
  return result;
}

export function rsi(data, period = 14) {
  if (data.length < period + 1) return [];
  const result = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  result.push({
    time: data[period].time,
    value: 100 - 100 / (1 + avgGain / (avgLoss || 1e-10)),
  });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({
      time: data[i].time,
      value: 100 - 100 / (1 + avgGain / (avgLoss || 1e-10)),
    });
  }
  return result;
}

export function macd(data, fast = 12, slow = 26, signal = 9) {
  const fastEmaValues = ema(data, fast);
  const slowEmaValues = ema(data, slow);

  const fastMap = new Map(fastEmaValues.map(d => [d.time, d.value]));
  const slowMap = new Map(slowEmaValues.map(d => [d.time, d.value]));

  const macdLine = [];
  for (const [time, slowVal] of slowMap) {
    if (fastMap.has(time)) {
      macdLine.push({ time, value: fastMap.get(time) - slowVal });
    }
  }
  macdLine.sort((a, b) => a.time - b.time);

  if (macdLine.length < signal) {
    return { macdLine, signalLine: [], histogram: [] };
  }

  const k = 2 / (signal + 1);
  let prev = macdLine.slice(0, signal).reduce((s, d) => s + d.value, 0) / signal;
  const signalLine = [{ time: macdLine[signal - 1].time, value: prev }];

  for (let i = signal; i < macdLine.length; i++) {
    prev = macdLine[i].value * k + prev * (1 - k);
    signalLine.push({ time: macdLine[i].time, value: prev });
  }

  const sigMap = new Map(signalLine.map(d => [d.time, d.value]));
  const histogram = macdLine
    .filter(d => sigMap.has(d.time))
    .map(d => ({ time: d.time, value: d.value - sigMap.get(d.time) }));

  return { macdLine, signalLine, histogram };
}

export function bollingerBands(data, period = 20, deviations = 2) {
  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((s, c) => s + c.close, 0) / period;
    const variance = slice.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push({ time: data[i].time, value: mean + stdDev * deviations });
    middle.push({ time: data[i].time, value: mean });
    lower.push({ time: data[i].time, value: mean - stdDev * deviations });
  }

  return { upper, middle, lower };
}
