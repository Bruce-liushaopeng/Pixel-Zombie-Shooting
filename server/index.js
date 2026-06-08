import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT || 3001);
const DEFAULT_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://pixel-zombie-shooting.netlify.app',
];
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || DEFAULT_CLIENT_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ''))
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/$/, '');
    if (!origin || CLIENT_ORIGINS.includes(normalizedOrigin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalizedOrigin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST'],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});

const rooms = new Map();
const DIRECT_EVENT_NAMES = new Map([
  ['player_hit', 'player_damaged'],
  ['player_downed', 'player_downed'],
  ['player_revived', 'player_revived'],
  ['special_used', 'special_fired'],
  ['boss_spawned', 'boss_spawned'],
  ['boss_state', 'boss_state'],
  ['wave_started', 'wave_started'],
  ['wave_completed', 'wave_completed'],
  ['zombie_killed', 'zombie_killed'],
  ['theme_changed', 'theme_changed'],
  ['game_over', 'game_over'],
  ['pickup_collected', 'pickup_collected'],
  ['player_shoot', 'player_shoot'],
]);

function normalizeRoomCode(roomCode) {
  return String(roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

function nowIso() {
  return new Date().toISOString();
}

function publicRoom(room) {
  return {
    id: room.roomCode,
    room_code: room.roomCode,
    status: room.status,
    host_player_id: room.hostPlayerId,
    max_players: 2,
    current_wave: room.wave,
    game_state: room.gameState,
    created_at: room.createdAt,
    updated_at: room.updatedAt,
  };
}

function publicPlayer(player) {
  return {
    id: `${player.roomCode}:${player.playerId}`,
    room_id: player.roomCode,
    player_id: player.playerId,
    player_name: player.playerName,
    player_slot: player.playerSlot,
    is_host: player.isHost,
    is_connected: player.isConnected,
    x: player.x,
    y: player.y,
    angle: player.angle,
    health: player.health,
    score: player.score,
    money: player.money,
    armor: player.armor,
    level: player.level,
    weapon: player.weapon,
    ammo: player.ammo,
    is_downed: player.isDowned,
    revive_timer: player.reviveTimer,
    last_seen_at: player.lastSeenAt,
    updated_at: player.updatedAt,
  };
}

function roomPlayers(room) {
  return [...room.players.values()].map(publicPlayer).sort((a, b) => a.player_slot - b.player_slot);
}

function makeEvent(socket, room, eventType, payload = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    room_id: room.roomCode,
    player_id: socket.data.playerId,
    event_type: eventType,
    payload: {
      ...payload,
      timestamp: payload.timestamp || Date.now(),
    },
    created_at: nowIso(),
  };
}

const MAP_NAMES = {
  city: 'Abandoned City',
  toxic_sewer: 'Toxic Sewer',
  snow_outpost: 'Snow Outpost',
};
const MAP_THEMES = {
  city: 'city',
  toxic_sewer: 'sewer',
  snow_outpost: 'frozen',
};

function normalizeMapId(mapId) {
  return MAP_NAMES[mapId] ? mapId : 'city';
}

function createRoom({ roomCode, mode, difficulty, mapId, hostPlayerId }) {
  const now = nowIso();
  const selectedMapId = normalizeMapId(mapId);
  return {
    roomCode,
    status: 'waiting',
    hostPlayerId,
    wave: 1,
    gameState: {
      mode,
      difficulty,
      mapId: selectedMapId,
      mapName: MAP_NAMES[selectedMapId],
      currentWave: 1,
      seed: randomUUID(),
      players: {},
      zombies: [],
      boss: null,
      bullets: [],
      pickups: [],
      theme: MAP_THEMES[selectedMapId],
      status: 'waiting',
    },
    players: new Map(),
    sockets: new Map(),
    createdAt: now,
    updatedAt: now,
  };
}

function upsertPlayer(room, socket, { playerId, playerName }) {
  const existing = room.players.get(playerId);
  const usedSlots = new Set([...room.players.values()]
    .filter((player) => player.playerId !== playerId && player.isConnected)
    .map((player) => player.playerSlot));
  const slot = existing?.playerSlot || (usedSlots.has(1) ? 2 : 1);
  const isHost = room.hostPlayerId === playerId;
  const now = nowIso();
  const player = {
    roomCode: room.roomCode,
    playerId,
    playerName: String(playerName || 'Survivor').slice(0, 18),
    playerSlot: slot,
    isHost,
    isConnected: true,
    x: existing?.x ?? 1200 + (slot === 1 ? -44 : 44),
    y: existing?.y ?? 800,
    angle: existing?.angle ?? 0,
    health: existing?.health ?? 100,
    score: existing?.score ?? 0,
    money: existing?.money ?? 0,
    armor: existing?.armor ?? 0,
    level: existing?.level ?? 1,
    weapon: existing?.weapon ?? 'pistol',
    ammo: existing?.ammo ?? '∞',
    isDowned: existing?.isDowned ?? false,
    reviveTimer: existing?.reviveTimer ?? 0,
    lastSeenAt: now,
    updatedAt: now,
  };
  room.players.set(playerId, player);
  room.sockets.set(socket.id, playerId);
  return player;
}

function broadcastRoster(room, eventName = 'player_joined') {
  io.to(room.roomCode).emit(eventName, {
    room: publicRoom(room),
    players: roomPlayers(room),
  });
}

function maybeStartRoom(room) {
  const connected = [...room.players.values()].filter((player) => player.isConnected);
  if (connected.length < 2 || room.status === 'playing') return false;
  room.status = 'playing';
  room.gameState.status = 'playing';
  room.updatedAt = nowIso();
  io.to(room.roomCode).emit('game_started', {
    room: publicRoom(room),
    players: roomPlayers(room),
    event: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      room_id: room.roomCode,
      player_id: room.hostPlayerId,
      event_type: 'game_started',
      payload: { roomCode: room.roomCode, timestamp: Date.now() },
      created_at: nowIso(),
    },
  });
  return true;
}

function emitSnapshot(room) {
  io.to(room.roomCode).emit('state_snapshot', {
    roomCode: room.roomCode,
    room: publicRoom(room),
    players: roomPlayers(room),
    state: room.gameState,
    status: room.status,
    serverTime: Date.now(),
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

io.on('connection', (socket) => {
  socket.on('join_room', (payload = {}) => {
    const roomCode = normalizeRoomCode(payload.roomCode);
    const playerId = payload.playerId || socket.id;
    const playerName = payload.playerName || 'Survivor';
    const mode = payload.mode === 'pvp' ? 'pvp' : 'coop';
    const difficulty = ['easy', 'medium', 'hard'].includes(payload.difficulty) ? payload.difficulty : 'medium';
    const mapId = normalizeMapId(payload.mapId);

    if (!roomCode) {
      socket.emit('error_message', { message: 'Enter a room code.' });
      return;
    }

    let room = rooms.get(roomCode);
    if (!room) {
      room = createRoom({ roomCode, mode, difficulty, mapId, hostPlayerId: playerId });
      rooms.set(roomCode, room);
    }

    const connectedPlayers = [...room.players.values()].filter((player) => player.isConnected && player.playerId !== playerId);
    if (!room.players.has(playerId) && connectedPlayers.length >= 2) {
      socket.emit('room_full', { roomCode, message: 'Room full.' });
      return;
    }

    socket.data.roomCode = roomCode;
    socket.data.playerId = playerId;
    socket.join(roomCode);
    const player = upsertPlayer(room, socket, { playerId, playerName });
    room.updatedAt = nowIso();

    socket.emit('room_joined', {
      room: publicRoom(room),
      player: publicPlayer(player),
      players: roomPlayers(room),
    });
    broadcastRoster(room);
    maybeStartRoom(room);
  });

  socket.on('player_ready', () => {
    const room = rooms.get(socket.data.roomCode);
    if (room) maybeStartRoom(room);
  });

  socket.on('player_input', (payload = {}) => {
    const room = rooms.get(socket.data.roomCode || normalizeRoomCode(payload.roomCode));
    const player = room?.players.get(socket.data.playerId);
    if (!room || !player) return;
    Object.assign(player, {
      x: Number(payload.x ?? player.x),
      y: Number(payload.y ?? player.y),
      angle: Number(payload.angle ?? player.angle),
      health: Number(payload.health ?? player.health),
      score: Number(payload.score ?? player.score),
      money: Number(payload.money ?? player.money),
      armor: Number(payload.armor ?? player.armor),
      level: Number(payload.level ?? player.level),
      weapon: payload.weapon || player.weapon,
      ammo: payload.ammo ?? player.ammo,
      isDowned: Boolean(payload.isDowned ?? player.isDowned),
      reviveTimer: Number(payload.reviveTimer ?? player.reviveTimer),
      lastSeenAt: nowIso(),
      updatedAt: nowIso(),
    });
  });

  socket.on('player_shoot', (payload = {}) => {
    const room = rooms.get(socket.data.roomCode || normalizeRoomCode(payload.roomCode));
    if (!room) return;
    const event = makeEvent(socket, room, 'player_shoot', payload);
    socket.to(room.roomCode).emit('game_event', event);
    socket.to(room.roomCode).emit('player_shoot', event);
  });

  socket.on('buy_weapon', (payload = {}) => {
    const room = rooms.get(socket.data.roomCode || normalizeRoomCode(payload.roomCode));
    if (!room) return;
    const event = makeEvent(socket, room, 'buy_weapon', payload);
    socket.to(room.roomCode).emit('game_event', event);
  });

  socket.on('use_special', (payload = {}) => {
    const room = rooms.get(socket.data.roomCode || normalizeRoomCode(payload.roomCode));
    if (!room) return;
    const event = makeEvent(socket, room, 'special_used', payload);
    socket.to(room.roomCode).emit('game_event', event);
    socket.to(room.roomCode).emit('special_fired', event);
  });

  socket.on('game_event', (payload = {}) => {
    const room = rooms.get(socket.data.roomCode || normalizeRoomCode(payload.roomCode));
    if (!room) return;
    const event = makeEvent(socket, room, payload.eventType, payload.payload || {});
    if (payload.eventType === 'sync_state' && isSharedStatePayload(payload.payload)) {
      room.gameState = {
        ...room.gameState,
        ...(payload.payload || {}),
        status: room.status,
      };
    }
    if (payload.eventType === 'pickup_collected' && payload.payload?.pickupId) {
      room.gameState.pickups = (room.gameState.pickups || []).filter((pickup) => pickup.id !== payload.payload.pickupId);
    }
    socket.to(room.roomCode).emit('game_event', event);
    const directEventName = DIRECT_EVENT_NAMES.get(payload.eventType);
    if (directEventName) socket.to(room.roomCode).emit(directEventName, event);
  });

  socket.on('room_update', (payload = {}) => {
    const room = rooms.get(socket.data.roomCode || normalizeRoomCode(payload.roomCode));
    if (!room) return;
    const patch = payload.patch || {};
    room.status = patch.status || room.status;
    room.wave = Number(patch.current_wave ?? room.wave);
    room.gameState = {
      ...room.gameState,
      ...(patch.game_state || {}),
      status: room.status,
    };
    room.updatedAt = nowIso();
  });

  socket.on('leave_room', () => {
    leaveSocketRoom(socket);
  });

  socket.on('disconnect', () => {
    leaveSocketRoom(socket);
  });
});

function isSharedStatePayload(payload = {}) {
  return !payload.playerEconomy && !payload.reviveState && !payload.specialUsed;
}

function leaveSocketRoom(socket) {
  const room = rooms.get(socket.data.roomCode);
  const playerId = socket.data.playerId;
  if (!room || !playerId) return;
  const player = room.players.get(playerId);
  if (player) {
    player.isConnected = false;
    player.updatedAt = nowIso();
  }
  room.sockets.delete(socket.id);
  const event = makeEvent(socket, room, 'player_left', { playerId });
  socket.to(room.roomCode).emit('player_left', {
    room: publicRoom(room),
    players: roomPlayers(room),
    event,
  });

  const hasConnectedPlayers = [...room.players.values()].some((candidate) => candidate.isConnected);
  if (!hasConnectedPlayers) rooms.delete(room.roomCode);
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status === 'playing') emitSnapshot(room);
  }
}, 100);

httpServer.listen(PORT, () => {
  console.log(`Pixel Outbreak Socket.IO server listening on http://localhost:${PORT}`);
});
