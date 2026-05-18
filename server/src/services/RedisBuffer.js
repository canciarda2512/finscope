import Redis from 'ioredis';
import '../config/env.js';
import { insert } from './ClickHouseClient.js';

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
        console.error('❌ Redis connection lost:', err.message);
        connected = false;
      }
    });

    redis.on('connect', () => {
      connected = true;
    });

    await redis.connect();
    console.log('✅ Redis connected.');
  } catch (err) {
    console.error('⚠️ Redis unavailable — using in-memory fallback:', err.message);
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

async function flushBuffer() {
  let candles = [];

  // Drain from Redis list
  if (connected) {
    try {
      const items = await redis.lrange('finscope:candle_buffer', 0, -1);
      if (items.length > 0) {
        await redis.del('finscope:candle_buffer');
        candles = items.map(item => JSON.parse(item));
      }
    } catch (err) {
      console.error('Redis flush read error:', err.message);
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
    console.error('❌ Batch insert error:', err.message);
    // Put them back so they aren't lost
    buffer = candles.concat(buffer);
  }
}

// ── LatestPriceStore ──

export async function setLatestPrice(symbol, price) {
  if (connected) {
    try {
      await redis.set(`finscope:price:${symbol}`, String(price));
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

// ── OTP Store (for 2FA codes) ─────────────────────────────────────────────────

const _otpFallback = new Map(); // in-memory fallback when Redis is unavailable

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
  cacheGet,
  cacheSet,
  shutdownRedis,
};
