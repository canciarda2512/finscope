import { Router } from 'express';
import {
  getPerformanceDatapoints,
  getPortfolioSnapshot,
} from '../services/PortfolioService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const snapshot = await getPortfolioSnapshot(req.userId);
    return res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

router.get('/positions', async (req, res, next) => {
  try {
    const snapshot = await getPortfolioSnapshot(req.userId);
    return res.json({ positions: snapshot.positions });
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const snapshot = await getPortfolioSnapshot(req.userId);
    return res.json({ trades: snapshot.trades });
  } catch (err) {
    next(err);
  }
});

router.get('/performance', async (req, res, next) => {
  try {
    const datapoints = await getPerformanceDatapoints(req.userId);
    return res.json({ datapoints });
  } catch (err) {
    next(err);
  }
});

export default router;
