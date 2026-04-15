import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS - Test için genişlettik
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Ana sayfalar
app.get('/', (req, res) => {
  res.json({ message: "FinScope Backend Çalışıyor", status: "OK" });
});

app.get('/health', (req, res) => {
  res.json({ status: "healthy" });
});

// Chart Endpoint
app.get('/chart/candles', (req, res) => {
  const { symbol = 'BTCUSDT', timeframe = '1D' } = req.query;

  console.log(`[CHART] ${symbol} - ${timeframe}`);

  const count = timeframe === '1D' ? 150 : timeframe === '1W' ? 70 : 30;

  const mockData = Array.from({ length: count }, (_, i) => {
    const base = 62500;
    const open = base + (Math.random() * 1200 - 600);
    const close = open + (Math.random() * 900 - 450);
    const high = Math.max(open, close) + Math.random() * 400;
    const low = Math.min(open, close) - Math.random() * 400;

    return {
      time: Math.floor(Date.now() / 1000) - (count - i) * 60,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number((Math.random() * 1500 + 400).toFixed(2))
    };
  });

  res.json({
    candles: mockData,
    symbol,
    timeframe,
    queryTime: "8ms",
    rowsScanned: mockData.length
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} portunda çalışıyor`);
});