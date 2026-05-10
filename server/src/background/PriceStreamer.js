import { WebSocket } from 'ws';
import { bufferCandle, setLatestPrice } from '../services/RedisBuffer.js';
import { onPriceTick } from './LimitOrderMonitor.js';

const STREAM_SYMBOLS = [
    'btcusdt', 'ethusdt', 'bnbusdt', 'solusdt', 'xrpusdt',
    'adausdt', 'dogeusdt', 'avaxusdt', 'linkusdt', 'dotusdt',
    'trxusdt', 'maticusdt', 'ltcusdt', 'bchusdt', 'uniusdt',
    'atomusdt', 'etcusdt', 'filusdt', 'aptusdt', 'arbusdt',
    'opusdt', 'nearusdt', 'injusdt', 'suiusdt', 'seiusdt',
];

const streams = STREAM_SYMBOLS.map(s => `${s}@kline_1m`).join('/');
const BINANCE_WS_URL = `wss://stream.binance.com:9443/ws/${streams}`;

/**
 * Starts the Binance WebSocket price stream.
 * @param {import('ws').WebSocketServer} wss — the frontend-facing WS server, used to broadcast prices
 */
export function startPriceStreamer(wss) {
    function connect() {
        const binanceSocket = new WebSocket(BINANCE_WS_URL);

        binanceSocket.on('open', () => {
            console.log('✅ Binance WebSocket connected.');
        });

        binanceSocket.on('message', async (data) => {
            const msg = JSON.parse(data);
            const kline = msg.k;

            const livePrice = parseFloat(kline.c);
            if (Number.isFinite(livePrice)) {
                // Store latest price in Redis for instant lookups (trades, watchlist)
                setLatestPrice(msg.s, livePrice);
                onPriceTick(msg.s, livePrice);
            }

            // Buffer closed candle for batch insert (Redis -> ClickHouse every 5s)
            if (kline.x) {
                try {
                    await bufferCandle({
                        symbol: msg.s,
                        timestamp: kline.t,
                        open: parseFloat(kline.o),
                        high: parseFloat(kline.h),
                        low: parseFloat(kline.l),
                        close: parseFloat(kline.c),
                        volume: parseFloat(kline.v),
                    });
                } catch (err) {
                    console.error('❌ Buffer candle error:', err.message);
                }
            }

            // Broadcast to all connected frontend clients
            const payload = JSON.stringify(msg);
            wss.clients.forEach(client => {
                if (client.readyState === 1) client.send(payload);
            });
        });

        binanceSocket.on('error', (err) => {
            console.error('❌ Binance WebSocket error:', err.message);
        });

        binanceSocket.on('close', () => {
            console.warn('⚠️ Binance WebSocket disconnected. Reconnecting in 5s...');
            setTimeout(connect, 5000);
        });
    }

    connect();
}
