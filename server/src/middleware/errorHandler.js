import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  const status = err.status || 500;
  const message = status < 500
    ? err.message || 'Bad request'
    : 'Internal Server Error';
  res.status(status).json({ error: message });
};
