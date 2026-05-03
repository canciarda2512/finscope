import { Router } from 'express';
import { query } from '../services/ClickHouseClient.js';
import * as IndicatorCalculator from '../services/IndicatorCalculator.js';
import authMiddleware from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';

const router = Router();

// AI Service base URL — set AI_SERVICE_URL=http://localhost:5000 in .env
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

function getOptionalUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.userId;
  } catch {
    return null;
  }
}

// ── Timeframe maps ──
const TF_INTERVAL = {
  '1m': 'toStartOfMinute(timestamp)',
  '5m': 'toStartOfFiveMinutes(timestamp)',
  '1D': 'toStartOfDay(timestamp)',
  '1W': 'toStartOfWeek(timestamp)',
  '1M': 'toStartOfMonth(timestamp)',
};

const TF_LIMIT = {
  '1m': 100,
  '5m': 200,
  '1D': 150,
  '1W': 70,
  '1M': 30,
};

// ── Validation helper ──
function validateParams(symbol, timeframe, res) {
  const ALLOWED_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
    'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT',
    'ATOMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
    'OPUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT',
  ];
  const ALLOWED_TF = Object.keys(TF_INTERVAL);

  if (!ALLOWED_SYMBOLS.includes(symbol.toUpperCase())) {
    res.status(400).json({ error: `Geçersiz sembol: ${symbol}` });
    return false;
  }
  if (!ALLOWED_TF.includes(timeframe)) {
    res.status(400).json({ error: `Geçersiz timeframe: ${timeframe}. Desteklenen: ${ALLOWED_TF.join(', ')}` });
    return false;
  }
  return true;
}

// ── GET /api/chart/candles ──
router.get('/candles', async (req, res) => {
  const { symbol = 'BTCUSDT', timeframe = '5m' } = req.query;

  if (!validateParams(symbol, timeframe, res)) return;

  const interval = TF_INTERVAL[timeframe];
  const limit = TF_LIMIT[timeframe];

  try {
    const start = Date.now();

    const sql = `
      SELECT
        toUnixTimestamp(${interval}) AS time,
        argMin(open,   timestamp)    AS open,
        max(high)                    AS high,
        min(low)                     AS low,
        argMax(close,  timestamp)    AS close,
        sum(volume)                  AS volume
      FROM market_data
      WHERE symbol = {sym: String}
      GROUP BY time
      ORDER BY time DESC
      LIMIT {lim: UInt32}
    `;

    const { rows, queryTime: dbQueryTime, rowsRead } = await query(sql, {
      sym: symbol.toUpperCase(),
      lim: limit,
    });

    const candles = rows
      .map(row => ({
        time: Number(row.time),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
      }))
      .reverse(); // lightweight-charts needs ascending time

    return res.json({
      candles,
      symbol: symbol.toUpperCase(),
      timeframe,
      queryTime: `DB: ${dbQueryTime} | Total: ${Date.now() - start}ms`,
      rowsScanned: rowsRead,
    });
  } catch (err) {
    console.error('❌ Chart candles error:', err);
    return res.status(500).json({ error: 'Veritabanından mum verileri çekilemedi.' });
  }
});

// ── GET /api/chart/indicators ──
router.get('/indicators', async (req, res) => {
  const { symbol = 'BTCUSDT', timeframe = '1D', type = 'SMA', period = 20 } = req.query;

  if (!validateParams(symbol, timeframe, res)) return;

  const ALLOWED_TYPES = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
  if (!ALLOWED_TYPES.includes(type.toUpperCase())) {
    return res.status(400).json({ error: `Geçersiz indikatör tipi: ${type}` });
  }

  const interval = TF_INTERVAL[timeframe];
  const limit = Math.max(TF_LIMIT[timeframe], 200);

  try {
    const sql = `
      SELECT
        toUnixTimestamp(${interval}) AS time,
        argMin(open,  timestamp) AS open,
        max(high)                AS high,
        min(low)                 AS low,
        argMax(close, timestamp) AS close,
        sum(volume)              AS volume
      FROM market_data
      WHERE symbol = {sym: String}
      GROUP BY time
      ORDER BY time ASC
      LIMIT {lim: UInt32}
    `;

    const { rows } = await query(sql, {
      sym: symbol.toUpperCase(),
      lim: limit,
    });

    const data = rows.map(r => ({
      time: Number(r.time),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }));

    const p = Number(period);
    let result;

    switch (type.toUpperCase()) {
      case 'SMA':
        result = { type: 'SMA', period: p, values: IndicatorCalculator.sma(data, p) };
        break;
      case 'EMA':
        result = { type: 'EMA', period: p, values: IndicatorCalculator.ema(data, p) };
        break;
      case 'RSI':
        result = { type: 'RSI', period: p, values: IndicatorCalculator.rsi(data, p) };
        break;
      case 'MACD': {
        const { macdLine, signalLine, histogram } = IndicatorCalculator.macd(data);
        result = { type: 'MACD', macdLine, signalLine, histogram };
        break;
      }
      case 'BB': {
        const { upper, middle, lower } = IndicatorCalculator.bollingerBands(data, p);
        result = { type: 'BB', period: p, upper, middle, lower };
        break;
      }
    }

    return res.json({ symbol: symbol.toUpperCase(), timeframe, ...result });
  } catch (err) {
    console.error('❌ Indicators error:', err);
    return res.status(500).json({ error: 'İndikatör hesaplanamadı.' });
  }
});

// ── GET /api/chart/drawings ──
router.get('/drawings', async (req, res) => {
  const { symbol, timeframe } = req.query;
  const userId = getOptionalUserId(req);

  try {
    const params = {
      sym: String(symbol || '').toUpperCase(),
      tf: timeframe || '',
      userId: userId || '',
    };
    const filters = [
      'symbol = {sym:String}',
      'timeframe = {tf:String}',
    ];

    if (userId) filters.push('userId = {userId:String}');

    const { rows } = await query(
      `
      SELECT *
      FROM drawings
      WHERE ${filters.join(' AND ')}
      ORDER BY createdAt ASC
      `,
      params
    );
    return res.json({ drawings: rows });
  } catch (err) {
    console.error('❌ Drawings fetch error:', err);
    // Return 500 with flag so frontend can distinguish from "no drawings"
    return res.status(500).json({ drawings: [], error: 'Çizimler yüklenemedi.' });
  }
});

// ─────────────────────────────────────────────
// ── POST /api/chart/predict  (AI Service proxy)
// ─────────────────────────────────────────────
// Requires auth. Fetches last 150 daily candles from ClickHouse and forwards
// to AI Service /predict. Returns direction, confidence, and predicted values.
router.post('/predict', authMiddleware, async (req, res) => {
  const { symbol = 'BTCUSDT', timeframe = '1D' } = req.body;

  if (!validateParams(symbol, timeframe, res)) return;

  try {
    // 1. Pull candle history from ClickHouse for the AI model
    const sql = `
      SELECT
        toUnixTimestamp(toStartOfDay(timestamp)) AS time,
        argMin(open,  timestamp) AS open,
        max(high)                AS high,
        min(low)                 AS low,
        argMax(close, timestamp) AS close,
        sum(volume)              AS volume
      FROM market_data
      WHERE symbol = {sym: String}
      GROUP BY time
      ORDER BY time DESC
      LIMIT 150
    `;

    const { rows } = await query(sql, { sym: symbol.toUpperCase() });

    // AI Service requires ascending order
    const candles = rows
      .map(r => ({
        time: Number(r.time),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 30) {
      return res.status(422).json({
        error: `AI tahmini için en az 30 günlük veri gerekiyor (mevcut: ${candles.length}).`
      });
    }

    // 2. Forward to AI Service
    const aiRes = await fetch(`${AI_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timeframe, candles }),
      // Timeout: don't hang forever if AI service is down
      signal: AbortSignal.timeout(15_000),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.json().catch(() => ({}));
      return res.status(aiRes.status).json({
        error: errBody?.error || 'AI servisi hata döndürdü.',
      });
    }

    // 3. Return AI response as-is to frontend
    // Expected shape: { direction: 'UP'|'DOWN', confidence: number, predictedValues: number[] }
    const aiData = await aiRes.json();
    return res.json(aiData);

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(503).json({ error: 'AI servisi zaman aşımına uğradı.' });
    }
    console.error('❌ AI predict error:', err);
    return res.status(503).json({ error: 'AI servisi bağlantısı kurulamadı.' });
  }
});

// ──────────────────────────────────────────────────
// ── POST /api/chart/anomalies  (AI Service proxy)
// ──────────────────────────────────────────────────
// Requires auth. Fetches candles and forwards to AI Service /detect-anomalies.
// Returns a list of anomalies with timestamps, types, and severity.
router.post('/anomalies', authMiddleware, async (req, res) => {
  const { symbol = 'BTCUSDT', timeframe = '1D' } = req.body;

  if (!validateParams(symbol, timeframe, res)) return;

  const interval = TF_INTERVAL[timeframe];
  const limit = TF_LIMIT[timeframe];

  try {
    // 1. Pull candles for anomaly detection
    const sql = `
      SELECT
        toUnixTimestamp(${interval}) AS time,
        argMin(open,  timestamp) AS open,
        max(high)                AS high,
        min(low)                 AS low,
        argMax(close, timestamp) AS close,
        sum(volume)              AS volume
      FROM market_data
      WHERE symbol = {sym: String}
      GROUP BY time
      ORDER BY time DESC
      LIMIT {lim: UInt32}
    `;

    const { rows } = await query(sql, {
      sym: symbol.toUpperCase(),
      lim: limit,
    });

    const candles = rows
      .map(r => ({
        time: Number(r.time),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    // 2. Forward to AI Service
    const aiRes = await fetch(`${AI_SERVICE_URL}/detect-anomalies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timeframe, candles }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.json().catch(() => ({}));
      return res.status(aiRes.status).json({
        error: errBody?.error || 'Anomali servisi hata döndürdü.',
      });
    }

    // 3. Return AI response to frontend
    // Expected shape: { anomalies: [{ time: unixSeconds, type: string, severity: 'HIGH'|'MEDIUM' }] }
    const aiData = await aiRes.json();
    return res.json(aiData);

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(503).json({ error: 'Anomali servisi zaman aşımına uğradı.' });
    }
    console.error('❌ Anomaly detection error:', err);
    return res.status(503).json({ error: 'Anomali servisi bağlantısı kurulamadı.' });
  }
});

export default router;
