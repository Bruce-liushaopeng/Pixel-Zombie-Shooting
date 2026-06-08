export class RemotePlayerState {
  constructor(row) {
    this.playerId = row.player_id;
    this.playerName = row.player_name || 'Player';
    this.playerSlot = row.player_slot || 2;
    this.isHost = Boolean(row.is_host);
    this.isConnected = Boolean(row.is_connected);
    this.isShopping = Boolean(row.is_shopping || row.isShopping);
    this.x = Number(row.x || 0);
    this.y = Number(row.y || 0);
    this.targetX = this.x;
    this.targetY = this.y;
    this.angle = Number(row.angle || 0);
    this.health = Number(row.health ?? 100);
    this.score = Number(row.score || 0);
    this.money = 0;
    this.armor = Number(row.armor || 0);
    this.weapon = 'pistol';
    this.ammo = '∞';
    this.isDowned = false;
    this.reviveTimer = 0;
    this.level = 1;
    this.specialCharge = 0;
    this.r = 17;
    this.lastSeenAt = row.last_seen_at;
  }

  applyRow(row) {
    this.playerName = row.player_name || this.playerName;
    this.playerSlot = row.player_slot || this.playerSlot;
    this.isHost = Boolean(row.is_host);
    this.isConnected = Boolean(row.is_connected);
    this.isShopping = Boolean(row.is_shopping ?? row.isShopping ?? this.isShopping);
    this.targetX = Number(row.x ?? this.targetX);
    this.targetY = Number(row.y ?? this.targetY);
    this.angle = Number(row.angle ?? this.angle);
    this.health = Number(row.health ?? this.health);
    this.score = Number(row.score ?? this.score);
    this.armor = Number(row.armor ?? this.armor);
    this.lastSeenAt = row.last_seen_at;
  }

  update(dt) {
    const t = Math.min(1, dt * 12);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
  }
}

export class MultiplayerState {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.room = null;
    this.localPlayerId = null;
    this.localPlayerName = '';
    this.localSlot = 1;
    this.isHost = false;
    this.players = new Map();
    this.remotePlayers = new Map();
    this.statusMessage = '';
    this.roomMode = 'coop';
    this.difficulty = 'medium';
    this.mapId = 'city';
    this.processedEvents = new Set();
    this.lastPlayerWrite = 0;
    this.lastSyncWrite = 0;
    this.zombiesKilled = 0;
  }

  configure({ room, player, players }) {
    this.active = true;
    this.room = room;
    this.localPlayerId = player.player_id;
    this.localPlayerName = player.player_name;
    this.localSlot = player.player_slot || 1;
    this.isHost = Boolean(player.is_host);
    this.roomMode = room?.game_state?.mode || 'coop';
    this.difficulty = room?.game_state?.difficulty || 'medium';
    this.mapId = room?.game_state?.mapId || 'city';
    this.applyPlayers(players);
  }

  applyRoom(room) {
    this.room = room;
    this.isHost = room?.host_player_id === this.localPlayerId;
    this.roomMode = room?.game_state?.mode || this.roomMode;
    this.difficulty = room?.game_state?.difficulty || this.difficulty;
    this.mapId = room?.game_state?.mapId || this.mapId;
  }

  applyPlayers(rows = []) {
    this.players.clear();
    for (const row of rows) {
      this.players.set(row.player_id, row);
      if (row.player_id === this.localPlayerId) {
        this.localSlot = row.player_slot || this.localSlot;
        this.localPlayerName = row.player_name || this.localPlayerName;
        this.isHost = Boolean(row.is_host);
        continue;
      }
      const existing = this.remotePlayers.get(row.player_id);
      if (existing) existing.applyRow(row);
      else this.remotePlayers.set(row.player_id, new RemotePlayerState(row));
    }

    for (const id of [...this.remotePlayers.keys()]) {
      if (!this.players.has(id)) this.remotePlayers.delete(id);
    }
  }

  connectedPlayers() {
    return [...this.players.values()]
      .filter((player) => player.is_connected)
      .sort((a, b) => (a.player_slot || 0) - (b.player_slot || 0));
  }

  markEventSeen(eventId) {
    if (this.processedEvents.has(eventId)) return false;
    this.processedEvents.add(eventId);
    if (this.processedEvents.size > 200) {
      const [oldest] = this.processedEvents;
      this.processedEvents.delete(oldest);
    }
    return true;
  }

  updateRemotePlayers(dt) {
    this.remotePlayers.forEach((player) => player.update(dt));
  }

  applyEconomy({ playerId, score, money, armor, weapon, ammo, weaponPurchases, level, specialCharge, isDowned, reviveTimer }) {
    if (playerId === this.localPlayerId) return;
    const remote = this.remotePlayers.get(playerId);
    if (!remote) return;
    remote.score = Number(score ?? remote.score);
    remote.money = Number(money ?? remote.money);
    remote.armor = Number(armor ?? remote.armor);
    remote.weapon = weapon || remote.weapon;
    remote.ammo = ammo ?? remote.ammo;
    remote.weaponPurchases = Number(weaponPurchases ?? remote.weaponPurchases ?? 0);
    remote.level = Number(this.valueOr(level, remote.level));
    remote.specialCharge = Number(this.valueOr(specialCharge, remote.specialCharge));
    remote.isDowned = Boolean(isDowned ?? remote.isDowned);
    remote.reviveTimer = Number(reviveTimer ?? remote.reviveTimer);
  }

  valueOr(value, fallback) {
    return value ?? fallback;
  }

  applyReviveState({ playerId, isDowned, reviveTimer = 0, health = null }) {
    if (playerId === this.localPlayerId) return;
    const remote = this.remotePlayers.get(playerId);
    if (!remote) return;
    remote.isDowned = Boolean(isDowned);
    remote.reviveTimer = Number(reviveTimer || 0);
    if (health !== null) remote.health = Number(health);
  }
}
