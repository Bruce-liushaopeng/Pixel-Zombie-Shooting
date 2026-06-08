import { createSocketClient } from './socketClient.js';

function waitForSocketEvent(socket, eventName, errorEvents = ['error_message'], timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Game server did not respond.'));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      socket.off(eventName, onSuccess);
      for (const event of errorEvents) socket.off(event, onError);
    };
    const onSuccess = (payload) => {
      cleanup();
      resolve(payload);
    };
    const onError = (payload) => {
      cleanup();
      reject(new Error(payload?.message || payload || 'Game server error.'));
    };

    socket.once(eventName, onSuccess);
    for (const event of errorEvents) socket.once(event, onError);
  });
}

export class MultiplayerGameClient {
  constructor(socket = createSocketClient()) {
    this.socket = socket;
    this.handlers = [];
  }

  get connected() {
    return this.socket.connected;
  }

  async connect() {
    if (this.socket.connected) return;
    const connected = waitForSocketEvent(this.socket, 'connect', ['connect_error'], 7000);
    this.socket.connect();
    await connected;
  }

  async joinRoom(payload) {
    await this.connect();
    const joined = waitForSocketEvent(this.socket, 'room_joined', ['room_full', 'error_message']);
    this.socket.emit('join_room', payload);
    return joined;
  }

  on(eventName, handler) {
    this.socket.on(eventName, handler);
    this.handlers.push([eventName, handler]);
  }

  emit(eventName, payload = {}) {
    if (!this.socket.connected) return false;
    this.socket.emit(eventName, payload);
    return true;
  }

  unsubscribe() {
    for (const [eventName, handler] of this.handlers) {
      this.socket.off(eventName, handler);
    }
    this.handlers = [];
  }

  disconnect() {
    this.unsubscribe();
    if (this.socket.connected) this.socket.disconnect();
  }
}
