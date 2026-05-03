export async function fetchKlines(symbol, interval = '1m', limit = 1000, endTime) {
  try {
    const formattedSymbol = symbol.toUpperCase();

    let url = `https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`;

    if (endTime) {
      url += `&endTime=${endTime}`;
    }

    console.log(`[${formattedSymbol}] Binance veri çekiliyor...`);

    const res = await fetch(url);
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error(data.msg || 'Binance veri formatı hatalı');
    }

    return data.map(d => ({
      time: d[0], // ✅ FIX
      open: Number(d[1]),
      high: Number(d[2]),
      low: Number(d[3]),
      close: Number(d[4]),
      volume: Number(d[5]),
    }));

  } catch (err) {
    console.error(`❌ BinanceService Hatası (${symbol}):`, err.message);
    return [];
  }
}

export async function fetch24hTickers() {
  try {
    const baseUrl = process.env.BINANCE_REST_URL || 'https://api.binance.com';
    const res = await fetch(`${baseUrl}/api/v3/ticker/24hr`);
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error(data.msg || 'Binance 24h ticker format error');
    }

    return data.map(item => ({
      symbol: item.symbol,
      currentPrice: Number(item.lastPrice),
      change24h: Number(item.priceChangePercent),
      volume24h: Number(item.quoteVolume),
    }));
  } catch (err) {
    console.error(`Binance 24h ticker error:`, err.message);
    return [];
  }
}
