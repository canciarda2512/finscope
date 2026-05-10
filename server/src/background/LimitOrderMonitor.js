import { executeTriggeredLimitOrders } from '../services/PortfolioService.js';
import { checkAndTriggerAlerts } from '../services/AlertService.js';

/**
 * Called by PriceStreamer on every price tick.
 * Checks limit orders and price alerts against the live price.
 */
export async function onPriceTick(symbol, livePrice) {
    try {
        const executedOrders = await executeTriggeredLimitOrders(symbol, livePrice);
        if (executedOrders.length > 0) {
            console.log(`${symbol}: ${executedOrders.length} limit order(s) executed.`);
        }
    } catch (err) {
        console.error('Limit order monitor error:', err.message);
    }

    try {
        const triggeredAlerts = await checkAndTriggerAlerts(symbol, livePrice);
        if (triggeredAlerts.length > 0) {
            console.log(`${symbol}: ${triggeredAlerts.length} price alert(s) triggered.`);
        }
    } catch (err) {
        console.error('Price alert monitor error:', err.message);
    }
}
