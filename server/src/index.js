import express from 'express';
import cors from 'cors';
import './config/env.js';
import { createServer } from 'http';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initClickHouse } from './services/ClickHouseClient.js';
import { runDataFetcher } from './background/DataFetcher.js';

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_PORT = process.env.CLIENT_PORT || 3000;

// ── Middleware ──
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
    console.log('✅ ClickHouse bağlantısı kuruldu.');

    // 2. HTTP server başlat ve WebSocket'i anında yükleyip üzerine kur
    const server = httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);

      // Dinamik import: Sadece server başarıyla ayağa kalktığında yükle
      import('./websocket/WebSocketServer.js').then(module => {
        const setupWS = module.default;
        setupWS(server);
      }).catch(err => {
        console.error('❌ WebSocket BAŞLATMA HATASI (BURAYA DİKKAT):', err);
      });
    });

    // 3. Tarihsel veri doldur (arka planda çalışır, server'ı bloklamaz)
    console.log('📦 DataFetcher başlatılıyor...');
    runDataFetcher().catch(err => {
      console.error('❌ DataFetcher hatası:', err.message);
    });

  } catch (error) {
    console.error('❌ Server başlatılırken hata:', error.message);
    process.exit(1);
  }
}

start();

export { httpServer };
