import { WebSocket } from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import '../config/env.js';
import { bufferCandle, setLatestPrice } from '../services/RedisBuffer.js';
import { enqueuePriceTick } from './PriceTickQueue.js';
import { STREAM_SYMBOLS } from '../config/constants.js';
import logger from '../utils/logger.js';

const streams = STREAM_SYMBOLS.map(s => `${s}@kline_1m`).join('/');
const BINANCE_WS_BASE = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443';
const BINANCE_WS_URL = `${BINANCE_WS_BASE}/ws/${streams}`;

const MAX_RETRIES = 10;
const BASE_DELAY = 5000;

/**
 * Starts the Binance WebSocket price stream.
 * @param {import('ws').WebSocketServer} wss — the frontend-facing WS server, used to broadcast prices
 */
export function startPriceStreamer(wss) {
    let retries = 0;

    function connect() {
        const proxy = process.env.HTTPS_PROXY;
        const wsOptions = proxy ? { agent: new HttpsProxyAgent(proxy) } : {};
        const binanceSocket = new WebSocket(BINANCE_WS_URL, wsOptions);

        binanceSocket.on('open', () => {
            retries = 0;
            logger.info('Binance WebSocket connected');
        });

        binanceSocket.on('message', async (data) => {
            const msg = JSON.parse(data);
            const kline = msg.k;

            const livePrice = parseFloat(kline.c);
            if (Number.isFinite(livePrice)) {
                setLatestPrice(msg.s, livePrice);
                // Fire-and-forget: enqueue for async processing by the worker
                enqueuePriceTick(msg.s, livePrice);
            }

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
                    logger.error({ err }, 'Buffer candle error');
                }
            }

            const payload = JSON.stringify(msg);
            wss.clients.forEach(client => {
                if (client.readyState === 1) client.send(payload);
            });
        });

        binanceSocket.on('error', (err) => {
            logger.error({ err }, 'Binance WebSocket error');
        });

        binanceSocket.on('close', () => {
            retries++;
            if (retries > MAX_RETRIES) {
                logger.error({ retries: MAX_RETRIES }, 'Binance WebSocket failed — giving up');
                return;
            }
            const delay = Math.min(BASE_DELAY * Math.pow(2, retries - 1), 60000);
            logger.warn({ retries, maxRetries: MAX_RETRIES, delay }, 'Binance WebSocket disconnected — reconnecting');
            setTimeout(connect, delay);
        });
    }

    connect();
}
