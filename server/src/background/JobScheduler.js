import { Queue, Worker } from 'bullmq';
import '../config/env.js';
import logger from '../utils/logger.js';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const connection = { host: REDIS_HOST, port: REDIS_PORT };

const QUEUE_NAME = 'scheduled-jobs';

const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 20,
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
  },
});

let worker = null;

/**
 * Job handlers — each key matches a job name.
 * Add new scheduled tasks here.
 */
const handlers = {
  async 'data-fetcher-sync'() {
    const { runDataFetcher } = await import('./DataFetcher.js');
    await runDataFetcher();
  },

  async 'cleanup-old-notifications'() {
    const { execute } = await import('../services/ClickHouseClient.js');
    await execute(
      `ALTER TABLE notifications DELETE WHERE createdAt < now() - INTERVAL 30 DAY`
    );
    logger.info('Cleaned up notifications older than 30 days');
  },

  async 'optimize-tables'() {
    const { execute } = await import('../services/ClickHouseClient.js');
    const tables = ['market_data', 'market_data_daily', 'trades', 'positions', 'portfolios'];
    for (const table of tables) {
      try {
        await execute(`OPTIMIZE TABLE ${table} FINAL`);
      } catch (err) {
        logger.error({ err, table }, 'Table optimization failed');
      }
    }
    logger.info('Table optimization complete');
  },
};

/**
 * Register all repeatable jobs.
 * BullMQ deduplicates by repeat key — safe to call on every startup.
 */
async function registerJobs() {
  // Data sync — every 6 hours
  await queue.upsertJobScheduler('data-fetcher-sync', {
    pattern: '0 */6 * * *',
  }, {
    name: 'data-fetcher-sync',
  });

  // Clean old notifications — daily at 3:00 AM
  await queue.upsertJobScheduler('cleanup-old-notifications', {
    pattern: '0 3 * * *',
  }, {
    name: 'cleanup-old-notifications',
  });

  // Optimize ClickHouse tables — daily at 4:00 AM
  await queue.upsertJobScheduler('optimize-tables', {
    pattern: '0 4 * * *',
  }, {
    name: 'optimize-tables',
  });

  logger.info('Scheduled jobs registered (data sync 6h, cleanup 3AM, optimize 4AM)');
}

/**
 * Start the scheduler worker and register repeatable jobs.
 */
export async function startJobScheduler() {
  worker = new Worker(QUEUE_NAME, async (job) => {
    const handler = handlers[job.name];
    if (!handler) {
      logger.warn({ jobName: job.name }, 'Unknown scheduled job');
      return;
    }
    logger.info({ jobName: job.name }, 'Running scheduled job');
    await handler();
    logger.info({ jobName: job.name }, 'Completed scheduled job');
  }, {
    connection,
    concurrency: 1,
  });

  worker.on('failed', (job, err) => {
    logger.error({ err, jobName: job?.name }, 'Scheduled job failed');
  });

  await registerJobs();
}

/**
 * Gracefully stop the scheduler.
 */
export async function stopJobScheduler() {
  if (worker) await worker.close();
  await queue.close();
}
