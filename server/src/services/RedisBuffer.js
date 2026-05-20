import Redis from 'ioredis';
import '../config/env.js';
import { insert } from './ClickHouseClient.js';
import logger from '../utils/logger.js';

const FLUSH_INTERVAL_MS = 5000; // batch insert every 5 seconds
const CACHE_DEFAULT_TTL = 30;   // seconds

let redis = null;
let connected = false;
let buffer = [];       // in-memory fallback if Redis is down
let flushTimer = null;

// ── Connection ──

export async function initRedis() {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying after 5 attempts
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      if (connected) {
        logger.error({ err }, 'Redis connection lost');
        connected = false;
      }
    });

    redis.on('connect', () => {
      connected = true;
    });

    await redis.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable — using in-memory fallback');
    connected = false;
  }

  // Start the flush loop regardless of Redis status (buffer works in-memory too)
  flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
}

// ── WriteBuffer: queue candle and batch flush ──

export async function bufferCandle(candle) {
  if (connected) {
    try {
      await redis.rpush('finscope:candle_buffer', JSON.stringify(candle));
      return;
    } catch { /* fall through to in-memory */ }
  }
  buffer.push(candle);
}

// Lua script: atomically read all items and delete the key in one round-trip.
// Returns the list contents; if the key doesn't exist, returns an empty array.
const DRAIN_SCRIPT = `
  local items = redis.call('LRANGE', KEYS[1], 0, -1)
  if #items > 0 then redis.call('DEL', KEYS[1]) end
  return items
`;

async function flushBuffer() {
  let candles = [];

  // Atomic drain: read + delete in a single Lua eval (crash-safe)
  if (connected) {
    try {
      const items = await redis.eval(DRAIN_SCRIPT, 1, 'finscope:candle_buffer');
      if (items && items.length > 0) {
        candles = items.map(item => JSON.parse(item));
      }
    } catch (err) {
      logger.error({ err }, 'Redis flush read error');
    }
  }

  // Also drain in-memory buffer (used when Redis is down)
  if (buffer.length > 0) {
    candles = candles.concat(buffer);
    buffer = [];
  }

  if (candles.length === 0) return;

  try {
    await insert('market_data', candles);
  } catch (err) {
    logger.error({ err }, 'Batch insert error');
    // Put them back so they aren't lost
    buffer = candles.concat(buffer);
  }
}

// ── LatestPriceStore ──

export async function setLatestPrice(symbol, price) {
  if (connected) {
    try {
      await redis.set(`finscope:price:${symbol}`, String(price), 'EX', 60);
      return;
    } catch { /* ignore */ }
  }
}

export async function getLatestPriceFromCache(symbol) {
  if (connected) {
    try {
      const val = await redis.get(`finscope:price:${symbol}`);
      if (val !== null) return parseFloat(val);
    } catch { /* ignore */ }
  }
  return null;
}

export async function getLatestPricesFromCache(symbols) {
  const result = new Map();
  if (!connected || symbols.length === 0) return result;
  try {
    const keys = symbols.map(s => `finscope:price:${s}`);
    const values = await redis.mget(...keys);
    for (let i = 0; i < symbols.length; i++) {
      if (values[i] !== null) {
        const parsed = parseFloat(values[i]);
        if (Number.isFinite(parsed)) result.set(symbols[i], parsed);
      }
    }
  } catch { /* ignore */ }
  return result;
}

// ── Generic Cache ──

export async function cacheGet(key) {
  if (!connected) return null;
  try {
    const val = await redis.get(`finscope:cache:${key}`);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttl = CACHE_DEFAULT_TTL) {
  if (!connected) return;
  try {
    await redis.set(`finscope:cache:${key}`, JSON.stringify(value), 'EX', ttl);
  } catch { /* ignore */ }
}

// ── OTP Store (for 2FA codes) ──

const _otpFallback = new Map();

export async function setOTP(userId, code) {
  if (connected) {
    try {
      await redis.set(`finscope:otp:${userId}`, code, 'EX', 300);
      return;
    } catch { /* fall through */ }
  }
  _otpFallback.set(userId, { code, expires: Date.now() + 300_000 });
}

export async function getOTP(userId) {
  if (connected) {
    try {
      return await redis.get(`finscope:otp:${userId}`);
    } catch { /* fall through */ }
  }
  const entry = _otpFallback.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expires) { _otpFallback.delete(userId); return null; }
  return entry.code;
}

export async function deleteOTP(userId) {
  if (connected) {
    try { await redis.del(`finscope:otp:${userId}`); } catch { /* ignore */ }
  }
  _otpFallback.delete(userId);
}

// ── Distributed Lock (dedup for multi-instance) ──

/**
 * Try to acquire a short-lived lock for `key`.
 * Returns true if acquired, false if another instance already holds it.
 * Uses SET NX EX for atomic acquire + auto-expiry (no stale locks).
 */
export async function acquireLock(key, ttlSeconds = 10) {
  if (!connected) return true; // single-instance fallback: always allow
  try {
    const result = await redis.set(`finscope:lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return true; // Redis down: fall back to allowing the operation
  }
}

/**
 * Release a previously acquired lock.
 */
export async function releaseLock(key) {
  if (!connected) return;
  try {
    await redis.del(`finscope:lock:${key}`);
  } catch { /* ignore */ }
}

// ── Shutdown ──

export async function shutdownRedis() {
  clearInterval(flushTimer);
  await flushBuffer(); // flush remaining candles
  if (redis) {
    try { redis.disconnect(); } catch { /* ignore */ }
  }
}

export default {
  initRedis,
  bufferCandle,
  setLatestPrice,
  getLatestPriceFromCache,
  getLatestPricesFromCache,
  cacheGet,
  cacheSet,
  setOTP,
  getOTP,
  deleteOTP,
  acquireLock,
  releaseLock,
  shutdownRedis,
};
