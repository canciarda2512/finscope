import { execute, query } from './ClickHouseClient.js';
import { createNotification } from './NotificationService.js';

function normalizeTriggered(value) {
  return value === 1 || value === '1' || value === true;
}

export async function checkAndTriggerAlerts(symbol, price) {
  const normalizedSymbol = String(symbol || '').toUpperCase();
  const currentPrice = Number(price);

  if (!normalizedSymbol || !Number.isFinite(currentPrice)) return [];

  const { rows } = await query(
    `
    SELECT id, userId, condition, targetPrice
    FROM alerts
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

  const activeMatches = rows.filter(alert => !normalizeTriggered(alert.triggered));

  for (const alert of activeMatches) {
    await execute(
      `
      ALTER TABLE alerts
      UPDATE triggered = 1,
             triggeredAt = now64(3),
             missedAt = now64(3)
      WHERE symbol = {symbol:String}
        AND id = {id:String}
        AND triggered = 0
      `,
      { symbol: normalizedSymbol, id: alert.id }
    );

    createNotification({
      userId: alert.userId,
      type: 'price_alert_triggered',
      title: 'Price Alert Triggered',
      message: `${normalizedSymbol.replace('USDT', '')} ${alert.condition} $${Number(alert.targetPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })} - current $${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      symbol: normalizedSymbol,
    }).catch(err => console.error('Notification error (price alert):', err.message));
  }

  return activeMatches;
}

export default {
  checkAndTriggerAlerts,
};
