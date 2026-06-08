import { io } from 'socket.io-client';

const DEFAULT_GAME_SERVER_URL = 'http://localhost:3001';

export function gameServerUrl() {
  return import.meta.env?.VITE_GAME_SERVER_URL || DEFAULT_GAME_SERVER_URL;
}

export function createSocketClient() {
  return io(gameServerUrl(), {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 6000,
  });
}
