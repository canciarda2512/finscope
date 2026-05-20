import { ProxyAgent, fetch as proxyFetch } from 'undici';
import '../config/env.js';
import logger from '../utils/logger.js';

let _dispatcher = undefined;
let _dispatcherChecked = false;

function getDispatcher() {
  if (_dispatcherChecked) return _dispatcher;
  const proxy = process.env.HTTPS_PROXY;
  if (proxy) _dispatcher = new ProxyAgent(proxy);
  _dispatcherChecked = true;
  return _dispatcher;
}

function proxyAwareFetch(url, options = {}) {
  const dispatcher = getDispatcher();
  if (dispatcher) options.dispatcher = dispatcher;
  return dispatcher ? proxyFetch(url, options) : fetch(url, options);
}

// Circuit breaker — skip Binance calls for 60s after consecutive failures
let _failCount = 0;
let _circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN = 60_000;

function isCircuitOpen() {
  if (_failCount < CIRCUIT_THRESHOLD) return false;
  if (Date.now() > _circuitOpenUntil) {
    _failCount = 0;
    return false;
  }
  return true;
}

function recordFailure() {
  _failCount++;
  if (_failCount >= CIRCUIT_THRESHOLD) {
    _circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN;
  }
}

function recordSuccess() {
  _failCount = 0;
}

export async function fetchKlines(symbol, interval = '1m', limit = 1000, endTime) {
  if (isCircuitOpen()) return [];
  try {
    const formattedSymbol = symbol.toUpperCase();

    let url = `https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`;

    if (endTime) {
      url += `&endTime=${endTime}`;
    }

    const res = await proxyAwareFetch(url);
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error(data.msg || 'Binance data format error');
    }

    recordSuccess();
    return data.map(d => ({
      time: d[0],
      open: Number(d[1]),
      high: Number(d[2]),
      low: Number(d[3]),
      close: Number(d[4]),
      volume: Number(d[5]),
    }));

  } catch (err) {
    recordFailure();
    if (_failCount <= CIRCUIT_THRESHOLD) {
      logger.error({ err, symbol }, 'BinanceService klines error');
    }
    return [];
  }
}

export async function fetch24hTickers() {
  if (isCircuitOpen()) return [];
  try {
    const baseUrl = process.env.BINANCE_REST_URL || 'https://api.binance.com';
    const res = await proxyAwareFetch(`${baseUrl}/api/v3/ticker/24hr`);
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error(data.msg || 'Binance 24h ticker format error');
    }

    recordSuccess();
    return data.map(item => ({
      symbol: item.symbol,
      currentPrice: Number(item.lastPrice),
      change24h: Number(item.priceChangePercent),
      volume24h: Number(item.quoteVolume),
    }));
  } catch (err) {
    recordFailure();
    if (_failCount <= CIRCUIT_THRESHOLD) {
      logger.error({ err }, 'Binance 24h ticker error');
    }
    return [];
  }
}
