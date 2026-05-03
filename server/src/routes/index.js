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

const router = Router();

// ── Public routes ──
router.use('/auth', authController);

// ── Chart (public — guests can view) ──
router.use('/chart', chartController);

// ── Protected routes (auth required) ──
router.use('/trade', authMiddleware, tradeController);
router.use('/portfolio', authMiddleware, portfolioController);
router.use('/screener', authMiddleware, screenerController);
router.use('/watchlist', authMiddleware, watchlistController);
router.use('/alerts', authMiddleware, alertController);
router.use('/strategy', authMiddleware, strategyController);
router.use('/notifications', authMiddleware, notificationController);

export default router;