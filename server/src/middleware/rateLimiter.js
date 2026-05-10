const windowMs = 60 * 1000;
const maxRequests = 100;
const clients = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of clients) {
    if (now - entry.windowStart > windowMs) clients.delete(key);
  }
}, 5 * 60 * 1000);

export default function rateLimiter(req, res, next) {
  const key = req.userId || req.ip;
  const now = Date.now();
  let entry = clients.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 0 };
    clients.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return res.status(429).json({ message: 'Too many requests. Try again later.' });
  }

  next();
}
