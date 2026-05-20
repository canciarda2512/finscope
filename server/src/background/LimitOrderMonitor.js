import { executeTriggeredLimitOrders } from '../services/PortfolioService.js';
import { checkAndTriggerAlerts } from '../services/AlertService.js';
import logger from '../utils/logger.js';

/**
 * Called by PriceStreamer on every price tick.
 * Checks limit orders and price alerts against the live price.
 */
export async function onPriceTick(symbol, livePrice) {
    try {
        const executedOrders = await executeTriggeredLimitOrders(symbol, livePrice);
        if (executedOrders.length > 0) {
            logger.info({ symbol, count: executedOrders.length }, 'Limit order(s) executed');
        }
    } catch (err) {
        logger.error({ err }, 'Limit order monitor error');
    }

    try {
        const triggeredAlerts = await checkAndTriggerAlerts(symbol, livePrice);
        if (triggeredAlerts.length > 0) {
            logger.info({ symbol, count: triggeredAlerts.length }, 'Price alert(s) triggered');
        }
    } catch (err) {
        logger.error({ err }, 'Price alert monitor error');
    }
}
