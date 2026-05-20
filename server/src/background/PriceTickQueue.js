import { Queue, Worker } from 'bullmq';
import '../config/env.js';
import { executeTriggeredLimitOrders } from '../services/PortfolioService.js';
import { checkAndTriggerAlerts } from '../services/AlertService.js';
import logger from '../utils/logger.js';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const connection = { host: REDIS_HOST, port: REDIS_PORT };

const QUEUE_NAME = 'price-ticks';

// Deduplicate: only process the latest tick per symbol.
// If a symbol already has a pending job, the new tick replaces it.
const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
    attempts: 1,
  },
});

let worker = null;

/**
 * Enqueue a price tick for async processing.
 * Uses the symbol as jobId so duplicate ticks are deduplicated automatically.
 */
export async function enqueuePriceTick(symbol, price) {
  try {
    await queue.add('tick', { symbol, price }, {
      jobId: `tick:${symbol}`,
      // If a job for this symbol is already waiting, replace it with the latest price
      deduplication: { id: `tick:${symbol}` },
    });
  } catch {
    // Queue unavailable — fall back to direct processing
    processTickDirect(symbol, price);
  }
}

async function processTickDirect(symbol, price) {
  try {
    await executeTriggeredLimitOrders(symbol, price);
  } catch (err) {
    logger.error({ err }, 'Limit order monitor error');
  }
  try {
    await checkAndTriggerAlerts(symbol, price);
  } catch (err) {
    logger.error({ err }, 'Price alert monitor error');
  }
}

/**
 * Start the worker that processes price tick jobs.
 * Runs limit order checks and alert checks independently from PriceStreamer.
 */
export function startPriceTickWorker() {
  worker = new Worker(QUEUE_NAME, async (job) => {
    const { symbol, price } = job.data;
    await processTickDirect(symbol, price);
  }, {
    connection,
    concurrency: 5,
    limiter: {
      max: 50,
      duration: 1000,
    },
  });

  worker.on('failed', (job, err) => {
    logger.error({ err, symbol: job?.data?.symbol }, 'Price tick job failed');
  });

  logger.info('Price tick worker started');
}

/**
 * Gracefully stop the worker and close the queue.
 */
export async function stopPriceTickQueue() {
  if (worker) await worker.close();
  await queue.close();
}
