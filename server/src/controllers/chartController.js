import { Router } from 'express';
import logger from '../utils/logger.js';
import { query, insert, execute } from '../services/ClickHouseClient.js';
import * as IndicatorCalculator from '../services/IndicatorCalculator.js';
import authMiddleware from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import responseCache from '../middleware/responseCache.js';

const router = Router();

// AI Service base URL — set AI_SERVICE_URL=http://localhost:5000 in .env
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

function getOptionalUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

import { TF_INTERVAL, TF_LIMIT, DAILY_TF, TIMEFRAMES } from '../config/constants.js';
import { validateSymbol, validateEnum } from '../utils/validation.js';

const tableFor = tf => DAILY_TF.has(tf) ? 'market_data_daily' : 'market_data';

// ── Validation helper ──
function validateParams(symbol, timeframe, res) {
  if (!validateSymbol(symbol)) {
    res.status(400).json({ error: `Invalid symbol: ${symbol}` });
    return false;
  }
  if (!validateEnum(timeframe, TIMEFRAMES)) {
    res.status(400).json({ error: `Invalid timeframe: ${timeframe}. Supported: ${TIMEFRAMES.join(', ')}` });
    return false;
  }
  return true;
}

// ── GET /api/chart/candles ──
router.get('/candles', responseCache(
  (req) => DAILY_TF.has(req.query.timeframe || '5m') ? 60 : 10,
  (req) => `resp:candles:${req.query.symbol || 'BTCUSDT'}:${req.query.timeframe || '5m'}`,
), async (req, res) => {
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
      FROM ${tableFor(timeframe)}
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
    logger.error({ err }, 'Chart candles error');
    return res.status(500).json({ error: 'Failed to fetch candle data from database.' });
  }
});

// ── GET /api/chart/indicators ──
router.get('/indicators', responseCache(
  (req) => DAILY_TF.has(req.query.timeframe || '1D') ? 60 : 15,
  (req) => `resp:ind:${req.query.symbol || 'BTCUSDT'}:${req.query.timeframe || '1D'}:${req.query.type || 'SMA'}:${req.query.period || 20}`,
), async (req, res) => {
  const { symbol = 'BTCUSDT', timeframe = '1D', type = 'SMA', period = 20 } = req.query;

  if (!validateParams(symbol, timeframe, res)) return;

  const ALLOWED_TYPES = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
  if (!ALLOWED_TYPES.includes(type.toUpperCase())) {
    return res.status(400).json({ error: `Invalid indicator type: ${type}` });
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
      FROM ${tableFor(timeframe)}
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
    logger.error({ err }, 'Indicators error');
    return res.status(500).json({ error: 'Failed to calculate indicator.' });
  }
});

// ── GET /api/chart/drawings ──
router.get('/drawings', async (req, res) => {
  const { symbol, timeframe } = req.query;
  const userId = getOptionalUserId(req);

  // Guests have no saved drawings — return early to avoid leaking other users' data
  if (!userId) {
    return res.json({ drawings: [] });
  }

  try {
    const { rows } = await query(
      `
      SELECT *
      FROM drawings FINAL
      WHERE symbol = {sym:String}
        AND timeframe = {tf:String}
        AND userId = {userId:String}
      ORDER BY createdAt ASC
      `,
      {
        sym: String(symbol || '').toUpperCase(),
        tf: timeframe || '',
        userId,
      }
    );
    return res.json({ drawings: rows });
  } catch (err) {
    logger.error({ err }, 'Drawings fetch error');
    // Return 500 with flag so frontend can distinguish from "no drawings"
    return res.status(500).json({ drawings: [], error: 'Failed to load drawings.' });
  }
});

// ── POST /api/chart/drawings ──
router.post('/drawings', authMiddleware, async (req, res) => {
  const { symbol, timeframe, type, coordinates } = req.body;
  const userId = req.userId;

  if (!symbol || !timeframe || !type || !coordinates) {
    return res.status(400).json({ error: 'symbol, timeframe, type, and coordinates are required.' });
  }
  if (!validateParams(symbol, timeframe, res)) return;
  if (!['hline', 'trendline'].includes(type)) {
    return res.status(400).json({ error: "Invalid type. Must be 'hline' or 'trendline'." });
  }

  let coordsStr;
  try {
    coordsStr = typeof coordinates === 'string' ? coordinates : JSON.stringify(coordinates);
    JSON.parse(coordsStr);
  } catch {
    return res.status(400).json({ error: 'coordinates must be valid JSON.' });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString().replace('T', ' ').replace('Z', '');

  try {
    await insert('drawings', [{
      id,
      userId: userId || '',
      symbol: symbol.toUpperCase(),
      timeframe,
      type,
      coordinates: coordsStr,
      createdAt,
    }]);
    return res.status(201).json({ id, message: 'Drawing saved.' });
  } catch (err) {
    logger.error({ err }, 'Drawing save error');
    return res.status(500).json({ error: 'Failed to save drawing.' });
  }
});

// ── DELETE /api/chart/drawings/:id ──
router.delete('/drawings/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  if (!id) return res.status(400).json({ error: 'id zorunludur.' });

  try {
    const { rows } = await query(
      `SELECT id FROM drawings FINAL WHERE id = {id:String} AND userId = {userId:String} LIMIT 1`,
      { id, userId: userId || '' }
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Drawing not found or you do not have permission to delete it.' });
    }

    await execute(
      `ALTER TABLE drawings DELETE WHERE id = {id:String} AND userId = {userId:String}`,
      { id, userId: userId || '' }
    );

    return res.json({ message: 'Drawing deleted.' });
  } catch (err) {
    logger.error({ err }, 'Drawing delete error');
    return res.status(500).json({ error: 'Failed to delete drawing.' });
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
      FROM market_data_daily
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
        error: `AI prediction requires at least 30 days of data (available: ${candles.length}).`
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
        error: errBody?.detail || errBody?.error || 'AI service returned an error.',
      });
    }

    // 3. Return AI response as-is to frontend
    // Expected shape: { direction: 'UP'|'DOWN', confidence: number, predictedValues: number[] }
    const aiData = await aiRes.json();
    return res.json(aiData);

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(503).json({ error: 'AI service timed out.' });
    }
    logger.error({ err }, 'AI predict error');
    return res.status(503).json({ error: 'Could not connect to AI service.' });
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
      FROM ${tableFor(timeframe)}
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
        error: errBody?.detail || errBody?.error || 'Anomaly service returned an error.',
      });
    }

    // 3. Return AI response to frontend
    // Expected shape: { anomalies: [{ time: unixSeconds, type: string, severity: 'HIGH'|'MEDIUM' }] }
    const aiData = await aiRes.json();
    return res.json(aiData);

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(503).json({ error: 'Anomaly service timed out.' });
    }
    logger.error({ err }, 'Anomaly detection error');
    return res.status(503).json({ error: 'Could not connect to anomaly service.' });
  }
});

export default router;
