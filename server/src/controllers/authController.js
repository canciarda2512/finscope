import '../config/env.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import ClickHouseClient from '../services/ClickHouseClient.js';
import { ensurePortfolio } from '../services/PortfolioService.js';

const router = Router();

/**
 * POST /api/auth/register
 * Yeni kullanıcı oluşturur
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email ve şifre zorunlu' });
    }

    // Kullanıcı var mı?
    const existing = await ClickHouseClient.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Bu email zaten kayıtlı' });
    }

    // Şifreyi hashle
    const passwordHash = await bcrypt.hash(password, 12);

    // ClickHouse DateTime formatına çevir: 'YYYY-MM-DD HH:mm:ss'

    const now = new Date()
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');

    const userId = crypto.randomUUID();

    // DB'ye kaydet
    await ClickHouseClient.createUser({
      id: userId,
      username: email.split('@')[0],
      email,
      passwordHash,
      refreshToken: '',
      createdAt: now
    });

    await ensurePortfolio(userId);

    return res.status(201).json({ message: 'Kullanıcı oluşturuldu' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * POST /api/auth/login
 * Kullanıcı giriş yapar
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await ClickHouseClient.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Email veya şifre hatalı' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Email veya şifre hatalı' });
    }

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '14d' }
    );

    return res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * POST /api/auth/logout
 * Stateless → sadece frontend token siler
 */
router.post('/logout', async (req, res) => {
  return res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Token ile kullanıcı bilgisi getir
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await ClickHouseClient.getUserById(payload.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });

  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

/**
 * POST /api/auth/refresh
 * Yeni access token üretir
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const newAccessToken = jwt.sign(
      { userId: payload.userId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

export default router;
