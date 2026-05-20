import { WebSocket, WebSocketServer as WSS } from 'ws';
import jwt from 'jsonwebtoken';
import '../config/env.js';
import { setNotificationPublisher } from '../services/NotificationService.js';
import { startPriceStreamer } from '../background/PriceStreamer.js';
import logger from '../utils/logger.js';

const setupWebSocketServer = (server) => {
    const wss = new WSS({ server });

    // Publish notifications to the specific authenticated user
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

    // Start Binance price stream (handles reconnect, saves candles, broadcasts to clients)
    startPriceStreamer(wss);

    // Authenticate frontend clients via JWT token in query string
    wss.on('connection', (ws, req) => {
        try {
            const url = new URL(req.url || '/', 'http://localhost');
            const token = url.searchParams.get('token');
            if (token) {
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                ws.userId = payload.purpose ? null : payload.userId;
            }
        } catch {
            ws.userId = null;
        }
    });

    logger.info('WebSocket server ready');
};

export default setupWebSocketServer;
