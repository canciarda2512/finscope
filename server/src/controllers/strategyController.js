import { Router } from 'express';
const router = Router();
router.get('/', async (req, res) => res.json({ strategies: [] }));
router.post('/', async (req, res) => res.json({ strategyId: `strategy_${Date.now()}` }));
router.post('/:id/backtest', async (req, res) => res.json({ totalReturn: 0, winRate: 0, maxDrawdown: 0, sharpeRatio: 0, trades: [] }));
router.post('/:id/activate', async (req, res) => res.json({ status: 'active' }));
router.post('/:id/deactivate', async (req, res) => res.json({ status: 'inactive' }));
router.delete('/:id', async (req, res) => res.json({ success: true }));
export default router;
