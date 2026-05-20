import { fetchKlines } from '../services/BinanceService.js';
import { insert, query } from '../services/ClickHouseClient.js';
import { SYMBOLS } from '../config/constants.js';
import logger from '../utils/logger.js';

const DAYS_HISTORY       = 30;   // 1m veri — son 30 gün
const DAYS_HISTORY_DAILY = 365;  // daily veri — son 1 yıl

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rowsFromKlines(symbol, klines) {
  return klines.map(k => ({
    symbol:    symbol.toUpperCase(),
    timestamp: new Date(k.time).toISOString().replace('T', ' ').slice(0, 23),
    open:      k.open,
    high:      k.high,
    low:       k.low,
    close:     k.close,
    volume:    k.volume,
  }));
}

// ── Generic multi-batch historical fetch ──────────────────────────────────────
async function fetchHistorical(symbol, interval, daysBack, table) {
  const MS_PER_CANDLE = {
    '1m': 60_000,
    '5m': 300_000,
    '1d': 86_400_000,
    '1w': 604_800_000,
  };

  const candleMs     = MS_PER_CANDLE[interval] || 60_000;
  const totalCandles = Math.ceil((daysBack * 86_400_000) / candleMs);
  const batchSize    = 1000;
  const batches      = Math.ceil(totalCandles / batchSize);

  logger.info({ symbol, interval, table, daysBack, batches }, 'Starting historical fetch');

  let endTime      = Date.now();
  let totalInserted = 0;

  for (let i = 0; i < batches; i++) {
    const klines = await fetchKlines(symbol, interval, batchSize, endTime);
    if (!klines || klines.length === 0) break;

    await insert(table, rowsFromKlines(symbol, klines));
    totalInserted += klines.length;

    endTime = klines[0].time - 1;
    logger.debug({ symbol, batch: i + 1, total: batches, bars: klines.length }, 'Batch written');

    await sleep(300);
  }

  logger.info({ symbol, interval, totalInserted }, 'Historical fetch complete');
}

// ── 1m gap fill (market_data) ─────────────────────────────────────────────────
async function fillGaps(symbol) {
  try {
    const { rows } = await query(
      `SELECT min(timestamp) AS oldest, max(timestamp) AS newest, count() AS total
       FROM market_data WHERE symbol = {sym: String}`,
      { sym: symbol.toUpperCase() }
    );

    const { oldest, newest, total } = rows[0] || {};
    logger.info({ symbol, total, oldest, newest }, '1m DB status');

    if (!oldest || Number(total) === 0) {
      await fetchHistorical(symbol, '1m', DAYS_HISTORY, 'market_data');
      return;
    }

    const gapMinutes = Math.floor((Date.now() - new Date(newest).getTime()) / 60_000);
    if (gapMinutes > 1) {
      logger.info({ symbol, gapMinutes }, 'Filling 1m gap');
      const klines = await fetchKlines(symbol, '1m', Math.min(gapMinutes + 10, 1000));
      if (klines?.length) {
        const newestMs = new Date(newest).getTime();
        const filtered = klines.filter(k => k.time > newestMs);
        if (filtered.length) {
          await insert('market_data', rowsFromKlines(symbol, filtered));
          logger.info({ symbol, bars: filtered.length }, '1m gap filled');
        }
      }
    } else {
      logger.info({ symbol }, '1m data up to date');
    }
  } catch (err) {
    logger.error({ err, symbol }, 'fillGaps error');
  }
}

// ── Daily gap fill (market_data_daily) ───────────────────────────────────────
async function fillGapsDaily(symbol) {
  try {
    const { rows } = await query(
      `SELECT min(timestamp) AS oldest, max(timestamp) AS newest, count() AS total
       FROM market_data_daily WHERE symbol = {sym: String}`,
      { sym: symbol.toUpperCase() }
    );

    const { oldest, newest, total } = rows[0] || {};
    logger.info({ symbol, total, oldest, newest }, '1d DB status');

    if (!oldest || Number(total) === 0) {
      await fetchHistorical(symbol, '1d', DAYS_HISTORY_DAILY, 'market_data_daily');
      return;
    }

    const newestMs  = new Date(newest).getTime();
    const gapDays   = Math.floor((Date.now() - newestMs) / 86_400_000);

    if (gapDays >= 1) {
      logger.info({ symbol, gapDays }, 'Filling daily gap');
      const klines = await fetchKlines(symbol, '1d', Math.min(gapDays + 2, 1000));
      if (klines?.length) {
        const filtered = klines.filter(k => k.time > newestMs);
        if (filtered.length) {
          await insert('market_data_daily', rowsFromKlines(symbol, filtered));
          logger.info({ symbol, bars: filtered.length }, 'Daily gap filled');
        }
      }
    } else {
      logger.info({ symbol }, 'Daily data up to date');
    }
  } catch (err) {
    logger.error({ err, symbol }, 'fillGapsDaily error');
  }
}

// ── Connectivity probe — one quick request before looping 25 symbols ─────────
async function isBinanceReachable() {
  try {
    const klines = await fetchKlines('BTCUSDT', '1m', 1);
    return klines.length > 0;
  } catch {
    return false;
  }
}

// ── Ana başlatma fonksiyonu ───────────────────────────────────────────────────
export async function runDataFetcher() {
  logger.info('DataFetcher starting');

  const reachable = await isBinanceReachable();
  if (!reachable) {
    logger.warn('Binance API unreachable — skipping data sync');
    return;
  }

  for (const symbol of SYMBOLS) {
    await fillGaps(symbol);       // 1m — son 30 gün
    await fillGapsDaily(symbol);  // 1d — son 1 yıl
  }

  logger.info('DataFetcher completed');
}
