import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import './config/env.js';
import logger from './utils/logger.js';
import requestLogger from './middleware/requestLogger.js';
import { createServer } from 'http';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initClickHouse } from './services/ClickHouseClient.js';
import { initRedis, shutdownRedis } from './services/RedisBuffer.js';
import { runDataFetcher } from './background/DataFetcher.js';
import { startStrategyExecutor, stopStrategyExecutor } from './background/StrategyExecutor.js';
import { startPriceTickWorker, stopPriceTickQueue } from './background/PriceTickQueue.js';
import { startJobScheduler, stopJobScheduler } from './background/JobScheduler.js';

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_PORT = process.env.CLIENT_PORT || 3000;

// ── Middleware ──
app.use(helmet());
app.use(requestLogger);
app.use(cors({
  origin: `http://localhost:${CLIENT_PORT}`,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Routes ──
app.use('/api', routes);

// ── Health check ──
app.get('/', (req, res) => res.json({ message: 'FinScope Backend', status: 'OK' }));
app.get('/health', (req, res) => res.json({ status: 'healthy' }));

// ── Error handler (en sona) ──
app.use(errorHandler);

// ── HTTP Server ──
const httpServer = createServer(app);

// ── Başlatma sırası ──
async function start() {
  try {
    // 1. ClickHouse bağlan ve tabloları oluştur
    await initClickHouse();
    logger.info('ClickHouse connected');

    await initRedis();

    // 2. HTTP server başlat ve WebSocket'i anında yükleyip üzerine kur
    const server = httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);

      import('./websocket/WebSocketServer.js').then(module => {
        const setupWS = module.default;
        setupWS(server);
      }).catch(err => {
        logger.error({ err }, 'WebSocket setup failed');
      });
    });

    // 3. Tarihsel veri doldur (arka planda çalışır, server'ı bloklamaz)
    logger.info('DataFetcher starting...');
    runDataFetcher().catch(err => {
      logger.error({ err }, 'DataFetcher error');
    });

    // 4. Start price tick worker (processes limit orders + alerts async)
    startPriceTickWorker();

    // 5. Start job scheduler (DataFetcher every 6h, cleanup, optimize)
    await startJobScheduler();

    // 6. Start live strategy execution engine
    startStrategyExecutor();

  } catch (error) {
    logger.fatal({ err: error }, 'Server startup failed');
    process.exit(1);
  }
}

start();

async function shutdown() {
  logger.info('Shutting down...');
  stopStrategyExecutor();
  await stopPriceTickQueue();
  await stopJobScheduler();
  httpServer.close();
  await shutdownRedis();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { httpServer };
