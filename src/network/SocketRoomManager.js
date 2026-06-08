import { supabase } from '../lib/supabaseClient.js';
import { MultiplayerGameClient } from './MultiplayerGameClient.js';

const PLAYER_ID_KEY = 'pixel-outbreak-player-id';
const PLAYER_NAME_KEY = 'pixel-outbreak-player-name';
const SESSION_PLAYER_ID_KEY = 'pixel-outbreak-session-player-id';

function normalizeRoomCode(roomCode) {
  return String(roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

function getStoredPlayerId() {
  let playerId = sessionStorage.getItem(SESSION_PLAYER_ID_KEY) || localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  sessionStorage.setItem(SESSION_PLAYER_ID_KEY, playerId);
  return playerId;
}

export class SocketRoomManager {
  constructor(persistenceClient = supabase, gameClient = new MultiplayerGameClient()) {
    this.supabase = persistenceClient;
    this.gameClient = gameClient;
    this.playerId = getStoredPlayerId();
    this.room = null;
    this.players = [];
  }

  hasClient() {
    return true;
  }

  storedName() {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  }

  async joinOrCreateRoom({ roomCode, playerName, mode = 'coop', difficulty = 'medium' }) {
    const cleanCode = normalizeRoomCode(roomCode);
    const cleanName = String(playerName || '').trim().slice(0, 18) || 'Survivor';
    if (!cleanCode) throw new Error('Enter a room code.');
    localStorage.setItem(PLAYER_NAME_KEY, cleanName);

    const session = await this.gameClient.joinRoom({
      roomCode: cleanCode,
      playerName: cleanName,
      playerId: this.playerId,
      mode,
      difficulty,
    });

    this.room = session.room;
    this.players = session.players || [];
    return session;
  }

  subscribe({ onRoom, onPlayers, onEvent, onSnapshot, onError }) {
    this.unsubscribe();
    this.gameClient.on('room_joined', (session) => {
      this.room = session.room;
      this.players = session.players || this.players;
      onRoom?.(this.room);
      onPlayers?.(this.players);
    });
    this.gameClient.on('player_joined', (payload) => {
      this.room = payload.room || this.room;
      this.players = payload.players || this.players;
      onRoom?.(this.room);
      onPlayers?.(this.players);
    });
    this.gameClient.on('player_left', (payload) => {
      this.players = payload.players || this.players;
      onPlayers?.(this.players);
      onEvent?.(payload.event);
    });
    this.gameClient.on('game_started', (payload) => {
      this.room = payload.room || this.room;
      this.players = payload.players || this.players;
      onRoom?.(this.room);
      onPlayers?.(this.players);
      onEvent?.(payload.event);
    });
    this.gameClient.on('game_event', (event) => onEvent?.(event));
    this.gameClient.on('state_snapshot', (snapshot) => onSnapshot?.(snapshot));
    this.gameClient.on('error_message', (payload) => onError?.(payload?.message || String(payload)));
    this.gameClient.on('disconnect', () => onError?.('Disconnected from game server.'));
  }

  unsubscribe() {
    this.gameClient.unsubscribe();
  }

  async fetchPlayers() {
    return this.players;
  }

  async updatePlayer(roomId, patch) {
    this.gameClient.emit('player_input', {
      roomCode: this.room?.room_code || roomId,
      playerId: this.playerId,
      ...patch,
    });
  }

  async updateRoom(roomId, patch) {
    this.room = {
      ...(this.room || {}),
      ...patch,
      game_state: {
        ...(this.room?.game_state || {}),
        ...(patch.game_state || {}),
      },
      updated_at: new Date().toISOString(),
    };
    this.gameClient.emit('room_update', {
      roomCode: this.room?.room_code || roomId,
      patch,
    });
    return this.room;
  }

  async insertEvent(roomId, eventType, payload = {}) {
    this.gameClient.emit('game_event', {
      roomCode: this.room?.room_code || roomId,
      eventType,
      payload,
    });
    return null;
  }

  async leaveRoom(roomId) {
    this.gameClient.emit('leave_room', {
      roomCode: this.room?.room_code || roomId,
      playerId: this.playerId,
    });
    this.gameClient.disconnect();
  }

  async saveResult({ room, playerName, score, wavesSurvived, zombiesKilled, survived }) {
    if (!this.supabase || !room) return;
    const { error } = await this.supabase.from('game_results').insert({
      room_id: room.id,
      room_code: room.room_code,
      player_id: this.playerId,
      player_name: playerName,
      score,
      waves_survived: wavesSurvived,
      zombies_killed: zombiesKilled,
      survived,
    });
    if (error) console.warn('Failed to save multiplayer result:', error.message);
  }
}
