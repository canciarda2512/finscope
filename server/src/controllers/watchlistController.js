import { Router } from 'express';
import { execute, insert, query } from '../services/ClickHouseClient.js';
import { fetch24hTickers } from '../services/BinanceService.js';

const router = Router();
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

// Binance USDT symbols cache (5 min TTL)
let _symbolsCache = null;
let _symbolsCacheAt = 0;
const SYMBOLS_TTL = 5 * 60 * 1000;

// Ticker price cache (30 sec TTL)
let _tickerCache = null;
let _tickerCacheAt = 0;
const TICKER_TTL = 30 * 1000;

function nowClickHouse() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function normalizeSymbol(symbol) {
  return String(symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function getCachedTickers() {
  const now = Date.now();
  if (_tickerCache && now - _tickerCacheAt < TICKER_TTL) return _tickerCache;

  const tickers = await fetch24hTickers();
  _tickerCache = new Map(tickers.map(t => [t.symbol, t]));
  _tickerCacheAt = now;
  return _tickerCache;
}

async function getUSDTSymbols() {
  const now = Date.now();
  if (_symbolsCache && now - _symbolsCacheAt < SYMBOLS_TTL) return _symbolsCache;

  const tickers = await fetch24hTickers();
  _symbolsCache = tickers
    .filter(t => t.symbol.endsWith('USDT') && t.volume24h > 100_000)
    .sort((a, b) => b.volume24h - a.volume24h)
    .map(t => t.symbol);
  _symbolsCacheAt = now;
  return _symbolsCache;
}

async function getUserSymbols(userId) {
  const { rows } = await query(
    `SELECT DISTINCT symbol FROM watchlists WHERE userId = {userId:String} ORDER BY symbol ASC`,
    { userId }
  );

  if (rows.length > 0) return rows.map(row => row.symbol);

  const rowsToInsert = DEFAULT_SYMBOLS.map(symbol => ({
    userId,
    symbol,
    createdAt: nowClickHouse(),
  }));
  await insert('watchlists', rowsToInsert);
  return DEFAULT_SYMBOLS;
}

async function getMarketSnapshot(symbols) {
  if (!symbols.length) return [];

  const tickerMap = await getCachedTickers();

  return symbols.map(symbol => {
    const ticker = tickerMap.get(symbol);
    return {
      symbol,
      price: ticker?.currentPrice || 0,
      price24hAgo: 0,
      change24h: ticker?.change24h || 0,
      volume24h: ticker?.volume24h || 0,
      latestAt: ticker ? new Date().toISOString() : null,
    };
  });
}

// ── GET /api/watchlist/symbols — full searchable Binance USDT pair list ──
router.get('/symbols', async (req, res, next) => {
  try {
    const symbols = await getUSDTSymbols();
    const tickerMap = await getCachedTickers();

    const result = symbols.map(symbol => {
      const t = tickerMap.get(symbol);
      return {
        symbol,
        price: t?.currentPrice || 0,
        change24h: t?.change24h || 0,
        volume24h: t?.volume24h || 0,
      };
    });

    return res.json({ symbols: result });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/watchlist ──
router.get('/', async (req, res, next) => {
  try {
    const symbols = await getUserSymbols(req.userId);
    const assets = await getMarketSnapshot(symbols);
    return res.json({ symbols, assets });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/watchlist ──
router.post('/', async (req, res, next) => {
  try {
    const symbol = normalizeSymbol(req.body.symbol);

    if (!symbol.endsWith('USDT') || symbol.length < 5) {
      return res.status(400).json({ message: 'Invalid symbol format. Must be a USDT pair.' });
    }

    // Validate against live Binance symbol list
    const allowed = await getUSDTSymbols();
    if (!allowed.includes(symbol)) {
      return res.status(400).json({ message: `Symbol ${symbol} is not available on Binance.` });
    }

    // Check for duplicate
    const { rows } = await query(
      `SELECT count() AS cnt FROM watchlists WHERE userId = {userId:String} AND symbol = {symbol:String}`,
      { userId: req.userId, symbol }
    );
    if (Number(rows[0]?.cnt) > 0) {
      return res.status(409).json({ message: 'Symbol already in watchlist.' });
    }

    await insert('watchlists', [{
      userId: req.userId,
      symbol,
      createdAt: nowClickHouse(),
    }]);

    const assets = await getMarketSnapshot([symbol]);
    return res.status(201).json({ symbol, asset: assets[0] });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/watchlist/:symbol ──
router.delete('/:symbol', async (req, res, next) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol);

    await execute(
      `ALTER TABLE watchlists DELETE WHERE userId = {userId:String} AND symbol = {symbol:String}`,
      { userId: req.userId, symbol }
    );

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
