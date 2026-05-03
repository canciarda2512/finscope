import { WebSocket, WebSocketServer as WSS } from 'ws';
import jwt from 'jsonwebtoken';
import '../config/env.js';
import ClickHouseClient from '../services/ClickHouseClient.js';
import { checkAndTriggerAlerts } from '../services/AlertService.js';
import { executeTriggeredLimitOrders } from '../services/PortfolioService.js';
import { setNotificationPublisher } from '../services/NotificationService.js';

const { insertMarketData } = ClickHouseClient;
const STREAM_SYMBOLS = [
    'btcusdt', 'ethusdt', 'bnbusdt', 'solusdt', 'xrpusdt',
    'adausdt', 'dogeusdt', 'avaxusdt', 'linkusdt', 'dotusdt',
    'trxusdt', 'maticusdt', 'ltcusdt', 'bchusdt', 'uniusdt',
    'atomusdt', 'etcusdt', 'filusdt', 'aptusdt', 'arbusdt',
    'opusdt', 'nearusdt', 'injusdt', 'suiusdt', 'seiusdt',
];

const setupWebSocketServer = (server) => {
    const wss = new WSS({ server });

    setNotificationPublisher((notification) => {
        const payload = JSON.stringify({
            type: 'notification:new',
            notification,
        });

        wss.clients.forEach(client => {
            if (
                client.readyState === WebSocket.OPEN &&
                client.userId &&
                client.userId === notification.userId
            ) {
                client.send(payload);
            }
        });
    });

    // 🔑 DEĞİŞİKLİK BURADA: 'WebSocket' sınıfını açıkça kullanarak bağlanıyoruz
    const streams = STREAM_SYMBOLS.map(symbol => `${symbol}@kline_1m`).join('/');
    const binanceSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

    binanceSocket.on('open', () => {
        console.log('✅ Binance WebSocket bağlantısı başarılı.');
    });

    binanceSocket.on('message', async (data) => {
        const msg = JSON.parse(data);
        const kline = msg.k;
        
        // Bu logu mutlaka görmeliyiz!
        console.log("📡 Binance'den veri ulaştı:", msg.s);

        const livePrice = parseFloat(kline.c);
        if (Number.isFinite(livePrice)) {
            try {
                const executedOrders = await executeTriggeredLimitOrders(msg.s, livePrice);
                if (executedOrders.length > 0) {
                    console.log(`${msg.s}: ${executedOrders.length} limit order executed.`);
                }
            } catch (err) {
                console.error("Limit order monitor error:", err.message);
            }

            try {
                const triggeredAlerts = await checkAndTriggerAlerts(msg.s, livePrice);
                if (triggeredAlerts.length > 0) {
                    console.log(`${msg.s}: ${triggeredAlerts.length} price alert tetiklendi.`);
                }
            } catch (err) {
                console.error("Price alert monitor error:", err.message);
            }
        }

        if (kline.x) {
            const dataToSave = {
                symbol: msg.s,
                timestamp: kline.t,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
                volume: parseFloat(kline.v)
            };

            try {
                await insertMarketData(dataToSave);
                console.log(`✅ ${msg.s} verisi kaydedildi.`);
            } catch (err) {
                console.error("❌ ClickHouse kayıt hatası:", err);
            }
        }

        // Frontend'e gönder
        wss.clients.forEach(client => {
            if (client.readyState === 1) { // 1 = OPEN
                client.send(JSON.stringify(msg));
            }
        });
    });

    binanceSocket.on('error', (err) => {
        console.error('❌ Binance WebSocket Hatası:', err.message);
    });

    wss.on('connection', (ws, req) => {
        try {
            const url = new URL(req.url || '/', 'http://localhost');
            const token = url.searchParams.get('token');
            if (token) {
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                ws.userId = payload.userId;
            }
        } catch {
            ws.userId = null;
        }

        console.log('🔌 Yeni bir frontend istemcisi bağlandı.');
    });

    console.log('🚀 WebSocket Sunucusu ve Binance Köprüsü hazır.');
};

export default setupWebSocketServer;
