import { Router } from 'express';

import chartController from '../controllers/chartController.js';
import authController from '../controllers/authController.js';
import tradeController from '../controllers/tradeController.js';
import portfolioController from '../controllers/portfolioController.js';
import screenerController from '../controllers/screenerController.js';
import watchlistController from '../controllers/watchlistController.js';
import alertController from '../controllers/alertController.js';
import strategyController from '../controllers/strategyController.js';
import notificationController from '../controllers/notificationController.js';

import authMiddleware from '../middleware/authMiddleware.js';
import rateLimiter from '../middleware/rateLimiter.js';

const router = Router();

router.use(rateLimiter);

// ── Public routes ──
router.use('/auth', authController);

// ── Chart + Screener (public — guests can view market data) ──
router.use('/chart', chartController);
router.use('/screener', screenerController);

// ── Protected routes (auth required) ──
router.use('/trade', authMiddleware, tradeController);
router.use('/portfolio', authMiddleware, portfolioController);
router.use('/watchlist', authMiddleware, watchlistController);
router.use('/alerts', authMiddleware, alertController);
router.use('/strategy', authMiddleware, strategyController);
router.use('/notifications', authMiddleware, notificationController);

export default router;