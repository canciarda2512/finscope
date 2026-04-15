export function generateMockCandles(count = 150, timeframe = '1D') {
  const candles = [];
  const now = new Date();
  let close = 62500; // Güncel BTC fiyatına yakın

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now);

    if (timeframe === '1D') {
      date.setDate(now.getDate() - i);
    } else if (timeframe === '1W') {
      date.setDate(now.getDate() - i * 7);
    } else if (timeframe === '1M') {
      date.setMonth(now.getMonth() - i);
    }

    date.setHours(0, 0, 0, 0);
    const time = Math.floor(date.getTime() / 1000);

    const change = (Math.random() - 0.5) * (timeframe === '1D' ? 1400 : 3000);
    const open = close;
    close = Math.max(58000, open + change);

    const high = Math.max(open, close) + Math.random() * 700;
    const low = Math.min(open, close) - Math.random() * 700;
    const volume = Math.floor(Math.random() * 2800 + 800);

    candles.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });
  }

  return candles;
}