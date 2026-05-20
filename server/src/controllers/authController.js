import '../config/env.js';
import { Router } from 'express';
import logger from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import ClickHouseClient, { execute } from '../services/ClickHouseClient.js';
import { ensurePortfolio } from '../services/PortfolioService.js';
import { setOTP, getOTP, deleteOTP } from '../services/RedisBuffer.js';
import { sendOTPEmail } from '../services/EmailService.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

function nowClickHouse() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked = local[0] + '***' + (local.length > 1 ? local.slice(-1) : '');
  return `${masked}@${domain}`;
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await ClickHouseClient.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'This email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();

    await ClickHouseClient.createUser({
      id: userId,
      username: email.split('@')[0],
      email,
      passwordHash,
      refreshToken: '',
      createdAt: nowClickHouse(),
    });

    await ensurePortfolio(userId);

    return res.status(201).json({ message: 'Account created' });
  } catch (err) {
    logger.error({ err }, 'Register error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await ClickHouseClient.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 2FA check
    if (Number(user.twoFactorEnabled) === 1) {
      const code = generateOTP();
      await setOTP(user.id, code);
      await sendOTPEmail(user.email, code).catch(err =>
        logger.error({ err }, '2FA email error')
      );

      const tempToken = jwt.sign(
        { userId: user.id, purpose: '2fa-login' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.json({
        requires2FA: true,
        tempToken,
        maskedEmail: maskEmail(user.email),
      });
    }

    // Generate a nonce stored in DB — used to invalidate refresh tokens on password change
    const tokenNonce = crypto.randomUUID();
    await execute(
      `ALTER TABLE users UPDATE refreshToken = {nonce:String} WHERE id = {id:String}`,
      { nonce: tokenNonce, id: user.id }
    );

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, nonce: tokenNonce },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '14d' }
    );

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        twoFactorEnabled: Number(user.twoFactorEnabled) === 1,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Login error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/2fa/login-verify ──────────────────────────────────────────
// Public — verifies OTP after password check when 2FA is enabled
router.post('/2fa/login-verify', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ message: 'Token and code are required' });
    }

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Token expired or invalid' });
    }

    if (payload.purpose !== '2fa-login') {
      return res.status(400).json({ message: 'Invalid token type' });
    }

    const stored = await getOTP(payload.userId);
    if (!stored || stored !== String(code).trim()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    await deleteOTP(payload.userId);

    const user = await ClickHouseClient.getUserById(payload.userId);

    const tokenNonce = crypto.randomUUID();
    await execute(
      `ALTER TABLE users UPDATE refreshToken = {nonce:String} WHERE id = {id:String}`,
      { nonce: tokenNonce, id: payload.userId }
    );

    const accessToken = jwt.sign(
      { userId: payload.userId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: payload.userId, nonce: tokenNonce },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '14d' }
    );

    return res.json({
      accessToken,
      refreshToken,
      user: user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        twoFactorEnabled: Number(user.twoFactorEnabled) === 1,
        createdAt: user.createdAt,
      } : null,
    });
  } catch (err) {
    logger.error({ err }, '2FA login verify error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (_req, res) => res.json({ success: true }));

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose) return res.status(401).json({ message: 'Invalid token type' });
    const user = await ClickHouseClient.getUserById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        twoFactorEnabled: Number(user.twoFactorEnabled) === 1,
        createdAt: user.createdAt,
      },
    });
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing' });

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Verify user still exists and token nonce is still valid
    const user = await ClickHouseClient.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

    // If the stored nonce doesn't match, the token was invalidated (e.g. password change)
    if (payload.nonce && user.refreshToken && user.refreshToken !== payload.nonce) {
      return res.status(401).json({ message: 'Session expired — please log in again' });
    }

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

// ── POST /api/auth/change-password ────────────────────────────────────────────
// Protected
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both passwords are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const user = await ClickHouseClient.getUserById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all existing refresh tokens by rotating the nonce
    await execute(
      `ALTER TABLE users UPDATE passwordHash = {hash:String}, refreshToken = {nonce:String} WHERE id = {id:String}`,
      { hash: newHash, nonce: crypto.randomUUID(), id: userId }
    );

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Change password error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/2fa/send ───────────────────────────────────────────────────
// Protected — sends OTP to the authenticated user's email
router.post('/2fa/send', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await ClickHouseClient.getUserById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = generateOTP();
    await setOTP(userId, code);

    try {
      await sendOTPEmail(user.email, code);
    } catch (err) {
      logger.error({ err }, 'OTP email send error');
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    return res.json({ sent: true, maskedEmail: maskEmail(user.email) });
  } catch (err) {
    logger.error({ err }, '2fa/send error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/2fa/verify ─────────────────────────────────────────────────
// Protected — verifies OTP and enables 2FA
router.post('/2fa/verify', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId;

    const stored = await getOTP(userId);
    if (!stored || stored !== String(code).trim()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    await deleteOTP(userId);
    await execute(
      `ALTER TABLE users UPDATE twoFactorEnabled = 1 WHERE id = {id:String}`,
      { id: userId }
    );

    return res.json({ success: true, twoFactorEnabled: true });
  } catch (err) {
    logger.error({ err }, '2fa/verify error');
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/2fa/disable ────────────────────────────────────────────────
// Protected — verifies OTP and disables 2FA
router.post('/2fa/disable', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId;

    const stored = await getOTP(userId);
    if (!stored || stored !== String(code).trim()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    await deleteOTP(userId);
    await execute(
      `ALTER TABLE users UPDATE twoFactorEnabled = 0 WHERE id = {id:String}`,
      { id: userId }
    );

    return res.json({ success: true, twoFactorEnabled: false });
  } catch (err) {
    logger.error({ err }, '2fa/disable error');
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
