import { execute, query } from './ClickHouseClient.js';
import { createNotification } from './NotificationService.js';
import { acquireLock, releaseLock } from './RedisBuffer.js';
import logger from '../utils/logger.js';

export async function checkAndTriggerAlerts(symbol, price) {
  const normalizedSymbol = String(symbol || '').toUpperCase();
  const currentPrice = Number(price);

  if (!normalizedSymbol || !Number.isFinite(currentPrice)) return [];

  const { rows } = await query(
    `
    SELECT id, userId, condition, targetPrice
    FROM alerts FINAL
    WHERE symbol = {symbol:String}
      AND triggered = 0
      AND (
        (condition = '>' AND {price:Float64} >= targetPrice)
        OR
        (condition = '<' AND {price:Float64} <= targetPrice)
      )
    `,
    { symbol: normalizedSymbol, price: currentPrice }
  );

  const triggered = [];

  for (const alert of rows) {
    // Distributed lock: prevents duplicate trigger across multiple instances
    const lockKey = `alert:${alert.id}`;
    const acquired = await acquireLock(lockKey, 30);
    if (!acquired) continue;

    try {
      await execute(
        `
        ALTER TABLE alerts
        UPDATE triggered = 1,
               triggeredAt = now64(3)
        WHERE symbol = {symbol:String}
          AND id = {id:String}
          AND triggered = 0
        `,
        { symbol: normalizedSymbol, id: alert.id }
      );

      triggered.push(alert);

      createNotification({
        userId: alert.userId,
        type: 'price_alert_triggered',
        title: 'Price Alert Triggered',
        message: `${normalizedSymbol.replace('USDT', '')} ${alert.condition} $${Number(alert.targetPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })} — current $${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        symbol: normalizedSymbol,
      }).catch(err => logger.error({ err }, 'Notification error (price alert)'));
    } catch (err) {
      logger.error({ err, alertId: alert.id }, 'Alert trigger failed');
    } finally {
      await releaseLock(lockKey);
    }
  }

  return triggered;
}

export default {
  checkAndTriggerAlerts,
};
