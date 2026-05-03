import { Router } from 'express';
import { query } from '../services/ClickHouseClient.js';
import { fetch24hTickers, fetchKlines } from '../services/BinanceService.js';

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

function calculateRsi(closes) {
  if (!Array.isArray(closes) || closes.length < 15) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < closes.length; i += 1) {
    const diff = Number(closes[i]) - Number(closes[i - 1]);
    if (diff > 0) gains += diff;
    if (diff < 0) losses += Math.abs(diff);
  }

  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;

  return 100 - (100 / (1 + (avgGain / avgLoss)));
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

    const klines = await fetchKlines(symbol, '1h', 15);
    const rsi = calculateRsi(klines.map(k => k.close));

    if (
      rsi === null ||
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
  const comparator = tab === 'rsi-overbought' ? '>=' : '<=';
  const order = tab === 'rsi-overbought' ? 'DESC' : 'ASC';

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
    ),
    recent AS (
      SELECT
        symbol,
        timestamp,
        close,
        row_number() OVER (PARTITION BY symbol ORDER BY timestamp DESC) AS rn
      FROM market_data
    ),
    diffs AS (
      SELECT
        symbol,
        timestamp,
        close - lagInFrame(close) OVER (
          PARTITION BY symbol
          ORDER BY timestamp ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) AS diff
      FROM recent
      WHERE rn <= 15
    ),
    rsi_calc AS (
      SELECT
        symbol,
        sum(if(diff > 0, diff, 0)) / 14 AS avgGain,
        sum(if(diff < 0, abs(diff), 0)) / 14 AS avgLoss,
        countIf(diff IS NOT NULL) AS periods
      FROM diffs
      GROUP BY symbol
    )
    SELECT *
    FROM (
      SELECT
        latest.symbol AS symbol,
        latest.currentPrice AS currentPrice,
        ((latest.currentPrice - previous.price24hAgo) / previous.price24hAgo) * 100 AS change24h,
        volume.volume24h AS volume24h,
        if(rsi_calc.avgLoss = 0, 100, 100 - (100 / (1 + (rsi_calc.avgGain / rsi_calc.avgLoss)))) AS rsi
      FROM rsi_calc
      INNER JOIN latest ON rsi_calc.symbol = latest.symbol
      INNER JOIN previous ON rsi_calc.symbol = previous.symbol
      INNER JOIN volume ON rsi_calc.symbol = volume.symbol
      WHERE rsi_calc.periods >= 14
        AND latest.currentPrice > 0
        AND previous.price24hAgo > 0
        AND volume.volume24h > 0
    )
    WHERE rsi ${comparator} ${tab === 'rsi-overbought' ? 70 : 30}
    ORDER BY rsi ${order}
    LIMIT {limit:UInt32}
  `;

  const result = await query(sql, { limit });
  return result;
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
