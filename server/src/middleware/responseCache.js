import { cacheGet, cacheSet } from '../services/RedisBuffer.js';

/**
 * Express middleware that caches JSON responses in Redis.
 * Cache key is derived from the request path + query string.
 * Only caches successful (200) JSON responses.
 *
 * @param {number|function} ttl — cache TTL in seconds, or (req) => seconds
 * @param {function} [keyFn] — optional custom key builder (req) => string
 */
export default function responseCache(ttl, keyFn) {
  return async (req, res, next) => {
    const cacheKey = keyFn ? keyFn(req) : `resp:${req.originalUrl}`;

    try {
      const cached = await cacheGet(cacheKey);
      if (cached !== null) {
        return res.json(cached);
      }
    } catch { /* ignore cache miss */ }

    const resolvedTtl = typeof ttl === 'function' ? ttl(req) : ttl;

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body) {
        cacheSet(cacheKey, body, resolvedTtl).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}
