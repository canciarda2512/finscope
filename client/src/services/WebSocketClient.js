export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

let socket = null;
let reconnectTimer = null;
const listeners = new Set();
const statusListeners = new Set();

function getToken() {
  return localStorage.getItem('accessToken');
}

function connect() {
  // Don't open a second connection if one is already open or connecting
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return;

  const token = getToken();
  const url = token ? `${WS_URL}?token=${token}` : WS_URL;

  socket = new WebSocket(url);

  socket.onopen = () => {
    clearTimeout(reconnectTimer);
    statusListeners.forEach(fn => { try { fn(true); } catch (_) {} });
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      listeners.forEach(listener => {
        try { listener(msg); } catch (_) {}
      });
    } catch (_) {}
  };

  socket.onerror = () => {
    // Error will be followed by onclose which handles reconnect
  };

  socket.onclose = () => {
    statusListeners.forEach(fn => { try { fn(false); } catch (_) {} });
    // Reconnect after 5 seconds if there are still active subscribers
    if (listeners.size > 0) {
      reconnectTimer = setTimeout(connect, 5000);
    }
  };
}

/**
 * Subscribe to all WebSocket messages.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
function subscribe(listener) {
  listeners.add(listener);
  connect(); // ensure connection is open
  return () => {
    listeners.delete(listener);
    // If no more subscribers, close the connection cleanly
    if (listeners.size === 0) {
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.close();
        socket = null;
      }
    }
  };
}

/**
 * Reconnect with a fresh token (call after login so notifications work).
 */
function reconnectWithToken() {
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.close();
    socket = null;
  }
  if (listeners.size > 0) connect();
}

/**
 * Subscribe to connection status changes (true = open, false = closed).
 * Returns an unsubscribe function.
 */
function onStatus(listener) {
  statusListeners.add(listener);
  // Immediately notify current state
  if (socket && socket.readyState === WebSocket.OPEN) listener(true);
  return () => statusListeners.delete(listener);
}

function isConnected() {
  return socket != null && socket.readyState === WebSocket.OPEN;
}

const WebSocketClient = { subscribe, reconnectWithToken, onStatus, isConnected };
export default WebSocketClient;
