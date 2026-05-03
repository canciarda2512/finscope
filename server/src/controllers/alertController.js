import { Router } from 'express';
import crypto from 'crypto';
import { query, insert, execute } from '../services/ClickHouseClient.js';

const router = Router();
const CONDITIONS = new Set(['>', '<']);

function formatClickHouseDate(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * GET /api/alerts
 * Kullanıcının tüm alertlerini getirir
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;

    const result = await query(
      `
      SELECT *
      FROM alerts
      WHERE userId = {userId:String}
      ORDER BY createdAt DESC
      `,
      { userId }
    );

    res.json({ alerts: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alerts
 * Yeni price alert oluşturur
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { symbol, condition, targetPrice } = req.body;
    const normalizedSymbol = String(symbol || '').toUpperCase().trim();
    const price = Number(targetPrice);

    if (!normalizedSymbol) {
      return res.status(400).json({ message: 'Symbol zorunlu' });
    }
    if (!CONDITIONS.has(condition)) {
      return res.status(400).json({ message: 'Condition > veya < olmalı' });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'Target price geçerli olmalı' });
    }

    const alert = {
      id: crypto.randomUUID(),
      userId,
      symbol: normalizedSymbol,
      condition,
      targetPrice: price,
      triggered: 0,
      triggeredAt: null,
      missedAt: null,
      createdAt: formatClickHouseDate(),
    };

    await insert('alerts', [alert]);

    res.json({ alert });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/alerts/:id
 * Alert siler
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const id = req.params.id;

    await execute(
      `ALTER TABLE alerts DELETE WHERE userId = {userId:String} AND id = {id:String}`,
      { userId, id }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
