const WS_URL = 'ws://localhost:4000';

let socket = null;
let reconnectTimer = null;
const listeners = new Set();

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

const WebSocketClient = { subscribe, reconnectWithToken };
export default WebSocketClient;
