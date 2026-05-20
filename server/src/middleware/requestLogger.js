import crypto from 'crypto';
import logger from '../utils/logger.js';

export default function requestLogger(req, res, next) {
  req.id = crypto.randomUUID().slice(0, 8);
  req.log = logger.child({ reqId: req.id });

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    req.log[level]({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    }, `${req.method} ${req.originalUrl} ${res.statusCode}`);
  });

  next();
}
