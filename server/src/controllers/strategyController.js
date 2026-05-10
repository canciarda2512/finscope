import { Router } from 'express';
import crypto from 'crypto';
import { query, insert, execute } from '../services/ClickHouseClient.js';
import { runBacktest } from '../services/BacktestEngine.js';

const router = Router();

function nowCH() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

// ── GET /api/strategy — list user's strategies ──
router.get('/', async (req, res, next) => {
  try {
    const { rows: strategies } = await query(
      `SELECT * FROM strategies FINAL WHERE userId = {userId:String} ORDER BY createdAt DESC`,
      { userId: req.userId }
    );

    // Attach conditions and actions to each strategy
    const enriched = await Promise.all(strategies.map(async (s) => {
      const [{ rows: conditions }, { rows: actions }] = await Promise.all([
        query(`SELECT * FROM strategy_conditions FINAL WHERE strategyId = {id:String}`, { id: s.id }),
        query(`SELECT * FROM strategy_actions FINAL WHERE strategyId = {id:String}`, { id: s.id }),
      ]);

      return {
        ...s,
        isActive: s.isActive === 1 || s.isActive === '1',
        lastBacktestResult: s.lastBacktestResult ? tryParseJSON(s.lastBacktestResult) : null,
        conditions,
        actions,
      };
    }));

    res.json({ strategies: enriched });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/strategy — create a new strategy ──
router.post('/', async (req, res, next) => {
  try {
    const { name, conditions = [], actions = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Strategy name is required.' });
    }
    if (conditions.length === 0) {
      return res.status(400).json({ message: 'At least one condition is required.' });
    }
    if (actions.length === 0) {
      return res.status(400).json({ message: 'At least one action is required.' });
    }

    const strategyId = crypto.randomUUID();

    await insert('strategies', [{
      id: strategyId,
      userId: req.userId,
      name: name.trim(),
      isActive: 0,
      lastBacktestResult: '',
      createdAt: nowCH(),
    }]);

    const conditionRows = conditions.map(c => ({
      id: crypto.randomUUID(),
      strategyId,
      type: c.type,
      parameter: c.parameter,
      operator: c.operator,
      value: Number(c.value),
    }));

    const actionRows = actions.map(a => ({
      id: crypto.randomUUID(),
      strategyId,
      type: a.type,
      quantity: Number(a.quantity || 0),
    }));

    await Promise.all([
      insert('strategy_conditions', conditionRows),
      insert('strategy_actions', actionRows),
    ]);

    res.json({ strategyId, name: name.trim(), conditions: conditionRows, actions: actionRows });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/strategy/:id/backtest — run backtest on historical data ──
router.post('/:id/backtest', async (req, res, next) => {
  try {
    const strategyId = req.params.id;
    const { symbol = 'BTCUSDT', timeframe = '1D', days = 180 } = req.body;

    // Verify ownership
    const { rows: stratRows } = await query(
      `SELECT id FROM strategies FINAL WHERE id = {id:String} AND userId = {userId:String}`,
      { id: strategyId, userId: req.userId }
    );
    if (stratRows.length === 0) {
      return res.status(404).json({ message: 'Strategy not found.' });
    }

    // Fetch conditions and actions
    const [{ rows: conditions }, { rows: actions }] = await Promise.all([
      query(`SELECT * FROM strategy_conditions FINAL WHERE strategyId = {id:String}`, { id: strategyId }),
      query(`SELECT * FROM strategy_actions FINAL WHERE strategyId = {id:String}`, { id: strategyId }),
    ]);

    // Fetch historical candles
    const limitDays = Math.min(Math.max(Number(days) || 180, 30), 365);
    const { rows: candleRows } = await query(
      `
      SELECT
        toUnixTimestamp(toStartOfDay(timestamp)) AS time,
        argMin(open, timestamp)  AS open,
        max(high)                AS high,
        min(low)                 AS low,
        argMax(close, timestamp) AS close,
        sum(volume)              AS volume
      FROM market_data
      WHERE symbol = {symbol:String}
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
      GROUP BY time
      ORDER BY time ASC
      `,
      { symbol: symbol.toUpperCase(), days: limitDays }
    );

    const candles = candleRows.map(r => ({
      time: Number(r.time),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }));

    if (candles.length < 30) {
      return res.status(422).json({ message: `Not enough data for backtest (need 30+ candles, got ${candles.length}).` });
    }

    const result = runBacktest(candles, conditions, actions);

    // Save result to strategy
    await execute(
      `ALTER TABLE strategies UPDATE lastBacktestResult = {result:String} WHERE id = {id:String}`,
      { id: strategyId, result: JSON.stringify(result) }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/strategy/:id/activate ──
router.post('/:id/activate', async (req, res, next) => {
  try {
    await execute(
      `ALTER TABLE strategies UPDATE isActive = 1 WHERE id = {id:String} AND userId = {userId:String}`,
      { id: req.params.id, userId: req.userId }
    );
    res.json({ status: 'active' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/strategy/:id/deactivate ──
router.post('/:id/deactivate', async (req, res, next) => {
  try {
    await execute(
      `ALTER TABLE strategies UPDATE isActive = 0 WHERE id = {id:String} AND userId = {userId:String}`,
      { id: req.params.id, userId: req.userId }
    );
    res.json({ status: 'inactive' });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/strategy/:id ──
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.userId;
    await Promise.all([
      execute(`ALTER TABLE strategies DELETE WHERE id = {id:String} AND userId = {userId:String}`, { id, userId }),
      execute(`ALTER TABLE strategy_conditions DELETE WHERE strategyId = {id:String}`, { id }),
      execute(`ALTER TABLE strategy_actions DELETE WHERE strategyId = {id:String}`, { id }),
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

export default router;
