import { Router } from 'express';
import { query } from '../services/ClickHouseClient.js';
import { fetch24hTickers, fetchKlines } from '../services/BinanceService.js';
import { rsi as calcRsi } from '../services/IndicatorCalculator.js';

const router = Router();
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const SCREENER_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT',
  'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT',
];
const TABS = new Set([
  'top-gainers',
  'top-losers',
  'highest-volume',
  'rsi-overbought',
  'rsi-oversold',
]);

function parseLimit(value) {
  const limit = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function mapRow(row) {
  return {
    symbol: row.symbol,
    currentPrice: Number(row.currentPrice),
    change24h: row.change24h === undefined ? null : Number(row.change24h),
    volume24h: row.volume24h === undefined ? null : Number(row.volume24h),
    rsi: row.rsi === undefined ? null : Number(row.rsi),
  };
}


async function getBinanceMovementRows(tab, limit) {
  const tickers = await fetch24hTickers();
  const allowed = new Set(SCREENER_SYMBOLS);
  const metric = tab === 'highest-volume' ? 'volume24h' : 'change24h';
  const direction = tab === 'top-losers' ? 1 : -1;

  const rows = tickers
    .filter(item =>
      allowed.has(item.symbol) &&
      Number.isFinite(item.currentPrice) &&
      Number.isFinite(item.change24h) &&
      Number.isFinite(item.volume24h) &&
      item.currentPrice > 0 &&
      item.volume24h > 0
    )
    .sort((a, b) => direction * (Number(a[metric]) - Number(b[metric])))
    .slice(0, limit);

  return {
    rows,
    queryTime: 'Binance snapshot',
    rowsRead: tickers.length,
  };
}

async function getBinanceRsiRows(tab, limit) {
  const tickers = await fetch24hTickers();
  const tickerBySymbol = new Map(tickers.map(item => [item.symbol, item]));
  const rows = await Promise.all(SCREENER_SYMBOLS.map(async (symbol) => {
    const ticker = tickerBySymbol.get(symbol);
    if (!ticker) return null;

    const klines = await fetchKlines(symbol, '1h', 50);
    if (!klines.length) {
      console.warn(`[screener] ${symbol} klines empty — Binance may be unavailable`);
      return null;
    }
    const rsiValues = calcRsi(klines, 14);
    const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1].value : null;

    if (
      rsi === null ||
      !Number.isFinite(rsi) ||
      !Number.isFinite(ticker.currentPrice) ||
      !Number.isFinite(ticker.change24h) ||
      !Number.isFinite(ticker.volume24h)
    ) {
      return null;
    }

    return {
      symbol,
      currentPrice: ticker.currentPrice,
      change24h: ticker.change24h,
      volume24h: ticker.volume24h,
      rsi,
    };
  }));

  const filtered = rows
    .filter(Boolean)
    .filter(row => tab === 'rsi-overbought' ? row.rsi >= 70 : row.rsi <= 30)
    .sort((a, b) => tab === 'rsi-overbought' ? b.rsi - a.rsi : a.rsi - b.rsi)
    .slice(0, limit);

  return {
    rows: filtered,
    queryTime: 'Binance snapshot',
    rowsRead: SCREENER_SYMBOLS.length,
  };
}

async function getMovementRows(tab, limit) {
  const order = tab === 'top-losers' ? 'ASC' : 'DESC';
  const metric = tab === 'highest-volume' ? 'volume24h' : 'change24h';

  const sql = `
    WITH latest AS (
      SELECT
        symbol,
        argMax(close, timestamp) AS currentPrice
      FROM market_data
      GROUP BY symbol
    ),
    previous AS (
      SELECT
        symbol,
        argMax(close, timestamp) AS price24hAgo
      FROM market_data
      WHERE timestamp <= now() - INTERVAL 24 HOUR
      GROUP BY symbol
    ),
    volume AS (
      SELECT
        symbol,
        sum(volume) AS volume24h
      FROM market_data
      WHERE timestamp >= now() - INTERVAL 24 HOUR
      GROUP BY symbol
    )
    SELECT
      latest.symbol AS symbol,
      latest.currentPrice AS currentPrice,
      ((latest.currentPrice - previous.price24hAgo) / previous.price24hAgo) * 100 AS change24h,
      volume.volume24h AS volume24h
    FROM latest
    INNER JOIN previous ON latest.symbol = previous.symbol
    INNER JOIN volume ON latest.symbol = volume.symbol
    WHERE latest.currentPrice > 0
      AND previous.price24hAgo > 0
      AND volume.volume24h > 0
    ORDER BY ${metric} ${order}
    LIMIT {limit:UInt32}
  `;

  const result = await query(sql, { limit });
  return result;
}

async function getRsiRows(tab, limit) {
  const symbolList = SCREENER_SYMBOLS.map(s => `'${s}'`).join(', ');

  // Last 50 1h closes per symbol — LIMIT N BY avoids timestamp range issues
  const closesSql = `
    SELECT symbol, time, close
    FROM (
      SELECT
        symbol,
        toUnixTimestamp(toStartOfHour(timestamp)) AS time,
        argMax(close, timestamp) AS close
      FROM market_data
      WHERE symbol IN (${symbolList})
      GROUP BY symbol, time
      ORDER BY symbol ASC, time DESC
      LIMIT 50 BY symbol
    )
    ORDER BY symbol ASC, time ASC
  `;

  // Current price, 24h change, volume
  const metaSql = `
    WITH latest AS (
      SELECT symbol, argMax(close, timestamp) AS currentPrice
      FROM market_data WHERE symbol IN (${symbolList}) GROUP BY symbol
    ),
    previous AS (
      SELECT symbol, argMax(close, timestamp) AS price24hAgo
      FROM market_data
      WHERE symbol IN (${symbolList}) AND timestamp <= now() - INTERVAL 24 HOUR
      GROUP BY symbol
    ),
    vol AS (
      SELECT symbol, sum(volume) AS volume24h
      FROM market_data
      WHERE symbol IN (${symbolList}) AND timestamp >= now() - INTERVAL 24 HOUR
      GROUP BY symbol
    )
    SELECT
      latest.symbol,
      latest.currentPrice,
      ((latest.currentPrice - previous.price24hAgo) / previous.price24hAgo) * 100 AS change24h,
      vol.volume24h
    FROM latest
    LEFT JOIN previous ON latest.symbol = previous.symbol
    LEFT JOIN vol ON latest.symbol = vol.symbol
    WHERE latest.currentPrice > 0
  `;

  const [closesResult, metaResult] = await Promise.all([
    query(closesSql),
    query(metaSql),
  ]);

  const metaMap = new Map();
  for (const row of metaResult.rows) {
    metaMap.set(row.symbol, {
      currentPrice: parseFloat(row.currentPrice),
      change24h: parseFloat(row.change24h ?? 0),
      volume24h: parseFloat(row.volume24h ?? 0),
    });
  }

  const bySymbol = new Map();
  for (const row of closesResult.rows) {
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, []);
    bySymbol.get(row.symbol).push({ time: Number(row.time), close: parseFloat(row.close) });
  }

  const threshold = tab === 'rsi-overbought' ? 70 : 30;
  const filtered = [];
  for (const [symbol, candles] of bySymbol) {
    const meta = metaMap.get(symbol);
    if (!meta) continue;
    const rsiValues = calcRsi(candles, 14);
    if (!rsiValues.length) continue;
    const rsi = rsiValues[rsiValues.length - 1].value;
    if (!Number.isFinite(rsi)) continue;
    const passes = tab === 'rsi-overbought' ? rsi >= threshold : rsi <= threshold;
    if (!passes) continue;
    filtered.push({ symbol, ...meta, rsi });
  }

  filtered.sort((a, b) => tab === 'rsi-overbought' ? b.rsi - a.rsi : a.rsi - b.rsi);

  return {
    rows: filtered.slice(0, limit),
    queryTime: closesResult.queryTime,
    rowsRead: closesResult.rowsRead,
  };
}

router.get('/', async (req, res, next) => {
  const startedAt = Date.now();
  const tab = String(req.query.tab || 'top-gainers');
  const limit = parseLimit(req.query.limit);

  if (!TABS.has(tab)) {
    return res.status(400).json({ message: 'Unsupported screener tab' });
  }

  try {
    let result = tab.startsWith('rsi-')
      ? await getBinanceRsiRows(tab, limit)
      : await getBinanceMovementRows(tab, limit);

    if (result.rows.length === 0) {
      result = tab.startsWith('rsi-')
        ? await getRsiRows(tab, limit)
        : await getMovementRows(tab, limit);
    }

    return res.json({
      tab,
      limit,
      symbols: result.rows.map(mapRow),
      queryTime: `${result.queryTime} | Total: ${Date.now() - startedAt}ms`,
      rowsScanned: result.rowsRead,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
