import { supabase } from '../lib/supabaseClient.js';
import { NETWORK_EVENTS, nowPayload } from './NetworkEvents.js';

const PLAYER_ID_KEY = 'pixel-outbreak-player-id';
const PLAYER_NAME_KEY = 'pixel-outbreak-player-name';
const SESSION_PLAYER_ID_KEY = 'pixel-outbreak-session-player-id';

function normalizeRoomCode(roomCode) {
  return roomCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
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

export class RoomManager {
  constructor(client = supabase) {
    this.supabase = client;
    this.playerId = getStoredPlayerId();
  }

  hasClient() {
    return Boolean(this.supabase);
  }

  storedName() {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  }

  async joinOrCreateRoom({ roomCode, playerName, mode = 'coop', difficulty = 'medium' }) {
    if (!this.supabase) throw new Error('Missing Supabase env vars.');

    const cleanCode = normalizeRoomCode(roomCode);
    const cleanName = playerName.trim().slice(0, 18) || 'Survivor';
    if (!cleanCode) throw new Error('Enter a room code.');
    localStorage.setItem(PLAYER_NAME_KEY, cleanName);

    const existingRoom = await this.findRoom(cleanCode);
    return existingRoom
      ? this.joinExistingRoom(existingRoom, cleanName)
      : this.createRoom(cleanCode, cleanName, mode, difficulty);
  }

  async findRoom(roomCode) {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle();
    if (error) throw new Error(`Failed to find room: ${error.message}`);
    return data;
  }

  async createRoom(roomCode, playerName, mode, difficulty) {
    const now = new Date().toISOString();
    const { data: room, error: roomError } = await this.supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        status: 'waiting',
        host_player_id: this.playerId,
        max_players: 2,
        current_wave: 1,
        game_state: {
          mode,
          difficulty,
          currentWave: 1,
          seed: crypto.randomUUID(),
        },
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (roomError) throw new Error(`Failed to create room: ${roomError.message}`);

    const player = await this.upsertPlayer(room.id, playerName, 1, true);
    await this.insertEvent(room.id, NETWORK_EVENTS.PLAYER_JOINED, nowPayload({ playerName, slot: 1 }));
    return { room, player, players: [player] };
  }

  async joinExistingRoom(room, playerName) {
    const players = await this.fetchPlayers(room.id);
    const existingPlayer = players.find((player) => player.player_id === this.playerId);
    if (existingPlayer?.is_connected && existingPlayer.player_name !== playerName) {
      this.playerId = crypto.randomUUID();
      sessionStorage.setItem(SESSION_PLAYER_ID_KEY, this.playerId);
      return this.joinExistingRoom(room, playerName);
    }
    const connectedPlayers = players.filter((player) => player.is_connected && player.player_id !== this.playerId);

    if (!existingPlayer && connectedPlayers.length >= 2) throw new Error('Room full.');

    const usedSlots = new Set(players.filter((player) => player.player_id !== this.playerId).map((player) => player.player_slot));
    const slot = existingPlayer?.player_slot || (usedSlots.has(1) ? 2 : 1);
    const isHost = existingPlayer?.is_host ?? (room.host_player_id === this.playerId || connectedPlayers.length === 0);
    const player = await this.upsertPlayer(room.id, playerName, slot, isHost);
    const nextPlayers = await this.fetchPlayers(room.id);
    const connectedCount = nextPlayers.filter((row) => row.is_connected).length;

    if (connectedCount >= 2 && room.status !== 'playing') {
      await this.updateRoom(room.id, {
        status: 'playing',
        game_started_at: new Date().toISOString(),
      });
      await this.insertEvent(room.id, NETWORK_EVENTS.GAME_STARTED, nowPayload({ roomCode: room.room_code }));
    }

    await this.insertEvent(room.id, NETWORK_EVENTS.PLAYER_JOINED, nowPayload({ playerName, slot }));
    return {
      room: { ...room, status: connectedCount >= 2 ? 'playing' : room.status },
      player,
      players: nextPlayers,
    };
  }

  async upsertPlayer(roomId, playerName, slot, isHost) {
    const now = new Date().toISOString();
    const payload = {
      room_id: roomId,
      player_id: this.playerId,
      player_name: playerName,
      player_slot: slot,
      is_host: isHost,
      is_connected: true,
      x: 1200 + (slot === 1 ? -44 : 44),
      y: 800,
      angle: 0,
      health: 100,
      score: 0,
      last_seen_at: now,
      updated_at: now,
    };

    const { data: existing, error: findError } = await this.supabase
      .from('room_players')
      .select('id')
      .eq('room_id', roomId)
      .eq('player_id', this.playerId)
      .maybeSingle();
    if (findError) throw new Error(`Failed to check player: ${findError.message}`);

    const query = existing
      ? this.supabase.from('room_players').update(payload).eq('id', existing.id)
      : this.supabase.from('room_players').insert({ ...payload, created_at: now });

    const { data, error } = await query.select().single();
    if (error) throw new Error(`Failed to join room: ${error.message}`);
    return data;
  }

  async fetchPlayers(roomId) {
    const { data, error } = await this.supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('player_slot');
    if (error) throw new Error(`Failed to load players: ${error.message}`);
    return data || [];
  }

  async updatePlayer(roomId, patch) {
    if (!this.supabase || !roomId) return;
    const { error } = await this.supabase
      .from('room_players')
      .update({
        ...patch,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('player_id', this.playerId);
    if (error) console.warn('Failed to update player state:', error.message);
  }

  async updateRoom(roomId, patch) {
    const { data, error } = await this.supabase
      .from('rooms')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update room: ${error.message}`);
    return data;
  }

  async insertEvent(roomId, eventType, payload = {}) {
    if (!this.supabase || !roomId) return null;
    const { data, error } = await this.supabase
      .from('room_events')
      .insert({
        room_id: roomId,
        player_id: this.playerId,
        event_type: eventType,
        payload,
      })
      .select()
      .single();
    if (error) {
      console.warn(`Failed to insert ${eventType} event:`, error.message);
      return null;
    }
    return data;
  }

  async leaveRoom(roomId) {
    if (!this.supabase || !roomId) return;
    await this.updatePlayer(roomId, { is_connected: false });
    await this.insertEvent(roomId, NETWORK_EVENTS.PLAYER_LEFT, nowPayload({ playerId: this.playerId }));
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
