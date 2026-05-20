import '../config/env.js';
import jwt from 'jsonwebtoken';

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Reject purpose-scoped tokens (e.g. 2FA temp tokens) — they are not access tokens
    if (payload.purpose) {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
