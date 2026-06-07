import { Camera } from './Camera.js';
import { GAME_STATE, WORLD, ABILITIES } from './constants.js';
import { chance, distance, rand } from './math.js';
import { World } from './World.js';
import { drawBullet, drawPickup, drawPlayer, drawRival, drawZombie } from '../assets/sprites.js';
import { Bullet } from '../entities/Bullet.js';
import { Rival, Zombie } from '../entities/Enemy.js';
import { FloatingText, Particle } from '../entities/Particle.js';
import { Pickup } from '../entities/Pickup.js';
import { Player } from '../entities/Player.js';
import { AudioSystem } from '../systems/Audio.js';
import { isBlocked } from '../systems/Collision.js';
import { Input } from '../systems/Input.js';
import { UI } from '../systems/UI.js';
import { supabase } from '../lib/supabaseClient.js';
import { MultiplayerState } from '../multiplayer/MultiplayerState.js';
import { NETWORK_EVENTS, nowPayload } from '../multiplayer/NetworkEvents.js';
import { RealtimeManager } from '../multiplayer/RealtimeManager.js';
import { RoomManager } from '../multiplayer/RoomManager.js';
import { getDifficulty } from './DifficultyManager.js';
import { getGameMode, getModeFromRoomMode } from './GameModeManager.js';
import { WeaponManager } from './WeaponManager.js';
import { getWeapon } from '../entities/WeaponTypes.js';

export class Game {
  constructor({ canvas, hud, overlay }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas);
    this.audio = new AudioSystem();
    this.ui = new UI(hud, overlay);
    this.ui.onStart = (options) => this.start(options);
    this.ui.onMultiplayer = (options) => this.showMultiplayerMenu(options);
    this.ui.onJoinRoom = (form) => this.joinMultiplayer(form);
    this.ui.onLeaveRoom = () => this.leaveRoom();
    this.ui.onOpenShop = () => this.openShop();
    this.ui.onCloseShop = () => this.closeShop();
    this.ui.onBuyWeapon = (weaponId) => this.buyWeapon(weaponId);
    this.ui.onRestart = () => this.start();
    this.ui.onResume = () => this.setState(GAME_STATE.PLAYING);
    this.roomManager = new RoomManager(supabase);
    this.realtime = new RealtimeManager(supabase);
    this.multiplayer = new MultiplayerState();
    this.mode = 'single';
    this.roomMode = 'single_player';
    this.difficultyId = 'medium';
    this.multiplayerResultSaved = false;
    this.shopOpen = false;
    this.endMessage = '';
    this.state = GAME_STATE.START;
    this.lastTime = 0;
    this.frame = 0;
    this.reset();
  }

  boot() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.ui.renderOverlay(this.state, this);
    requestAnimationFrame((time) => this.loop(time));
  }

  resize() {
    const ratio = 16 / 9;
    const frame = this.canvas.closest('.canvas-frame');
    const frameWidth = frame ? frame.clientWidth - 20 : window.innerWidth - 32;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const isMobileLayout = window.matchMedia('(pointer: coarse), (hover: none), (max-width: 820px)').matches;
    const isLandscape = window.innerWidth > window.innerHeight;
    const mobileVerticalChrome = isLandscape ? 48 : 16;
    const maxHeight = isMobileLayout ? viewportHeight - mobileVerticalChrome : Infinity;
    const maxWidth = Math.min(frameWidth, maxHeight * ratio, 1120);
    const width = Math.max(280, maxWidth);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${width / ratio}px`;
  }

  reset({ startWave = true } = {}) {
    this.world = new World();
    this.camera = new Camera(this.canvas, this.world);
    this.player = new Player(WORLD.width / 2, WORLD.height / 2);
    this.frame = 0;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [this.createSafePickup('health')];
    this.particles = [];
    this.floaters = [];
    this.score = 0;
    this.money = 0;
    this.zombiesKilled = 0;
    this.weaponPurchases = 0;
    this.wave = 0;
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.weaponManager = new WeaponManager();
    this.shopOpen = false;
    this.multiplayerResultSaved = false;
    if (startWave) this.nextWave();
  }

  start({ difficulty = 'medium' } = {}) {
    this.mode = 'single';
    this.roomMode = 'single_player';
    this.difficultyId = difficulty;
    this.realtime.unsubscribe();
    this.multiplayer.reset();
    this.audio.resume();
    this.reset();
    this.setState(GAME_STATE.PLAYING);
  }

  isMultiplayer() {
    return this.mode === 'multiplayer' && this.multiplayer.active;
  }

  showMultiplayerMenu({ mode = 'coop', difficulty = 'medium', error = '' } = {}) {
    this.mode = 'multiplayer';
    this.roomMode = mode;
    this.difficultyId = difficulty;
    this.ui.renderMultiplayerMenu({
      playerName: this.roomManager.storedName(),
      mode,
      difficulty,
      error: this.roomManager.hasClient() ? error : 'Missing Supabase env vars.',
    });
  }

  async joinMultiplayer({ playerName, roomCode, mode = this.roomMode, difficulty = this.difficultyId }) {
    try {
      this.ui.renderMultiplayerMenu({ playerName, roomCode, mode, difficulty, status: 'Connecting...' });
      const session = await this.roomManager.joinOrCreateRoom({ playerName, roomCode, mode, difficulty });
      this.multiplayer.configure(session);
      this.roomMode = this.multiplayer.roomMode;
      this.difficultyId = this.multiplayer.difficulty;
      this.subscribeToRoom(session.room.id);
      if (session.room.status === 'playing' || this.multiplayer.connectedPlayers().length >= 2) this.startMultiplayerGame();
      else this.renderWaitingRoom();
    } catch (error) {
      this.showMultiplayerMenu({ mode, difficulty, error: error.message || 'Failed to join room.' });
    }
  }

  subscribeToRoom(roomId) {
    this.realtime.subscribe({
      roomId,
      onRoom: (room) => this.handleRoomChange(room),
      onPlayers: () => this.refreshRoomPlayers(),
      onEvent: (event) => this.handleNetworkEvent(event),
      onError: (message) => {
        this.multiplayer.statusMessage = message;
      },
    });
  }

  async refreshRoomPlayers() {
    if (!this.multiplayer.room) return;
    try {
      const previouslyConnected = new Set(
        [...this.multiplayer.remotePlayers.values()]
          .filter((player) => player.isConnected)
          .map((player) => player.playerId),
      );
      const players = await this.roomManager.fetchPlayers(this.multiplayer.room.id);
      this.multiplayer.applyPlayers(players);
      const stillConnected = new Set(
        players
          .filter((player) => player.is_connected && player.player_id !== this.multiplayer.localPlayerId)
          .map((player) => player.player_id),
      );
      if ([...previouslyConnected].some((id) => !stillConnected.has(id))) {
        this.multiplayer.statusMessage = 'Other player disconnected.';
      }
      if (this.multiplayer.connectedPlayers().length >= 2 && this.state !== GAME_STATE.PLAYING) {
        if (this.multiplayer.isHost && this.multiplayer.room?.status !== 'playing') {
          this.roomManager.updateRoom(this.multiplayer.room.id, {
            status: 'playing',
            game_started_at: new Date().toISOString(),
          }).catch((error) => {
            this.multiplayer.statusMessage = error.message;
          });
        }
        this.startMultiplayerGame();
        return;
      }
      if (this.state !== GAME_STATE.PLAYING) this.renderWaitingRoom();
    } catch (error) {
      this.multiplayer.statusMessage = error.message;
    }
  }

  handleRoomChange(room) {
    this.multiplayer.applyRoom(room);
    this.roomMode = this.multiplayer.roomMode;
    this.difficultyId = this.multiplayer.difficulty;
    this.wave = room?.current_wave || this.wave;
    if (room?.status === 'playing' && this.state !== GAME_STATE.PLAYING) this.startMultiplayerGame();
    if (room?.status === 'ended' && this.state === GAME_STATE.PLAYING) this.setState(GAME_STATE.GAME_OVER);
  }

  renderWaitingRoom() {
    this.ui.renderWaitingRoom({
      room: this.multiplayer.room,
      players: this.multiplayer.connectedPlayers(),
      status: this.multiplayer.statusMessage,
    });
  }

  startMultiplayerGame() {
    this.audio.resume();
    this.roomMode = this.multiplayer.roomMode;
    this.difficultyId = this.multiplayer.difficulty;
    this.reset({ startWave: this.multiplayer.isHost });
    this.player.x = WORLD.width / 2 + (this.multiplayer.localSlot === 1 ? -44 : 44);
    this.player.y = WORLD.height / 2;
    if (!this.multiplayer.isHost) {
      this.wave = this.multiplayer.room?.current_wave || 1;
      this.spawnQueue = 0;
      this.pickups = [];
    }
    this.setState(GAME_STATE.PLAYING);
  }

  async leaveRoom() {
    if (this.isMultiplayer()) {
      await this.roomManager.leaveRoom(this.multiplayer.room?.id);
      this.realtime.unsubscribe();
    }
    this.mode = 'single';
    this.multiplayer.reset();
    this.reset();
    this.setState(GAME_STATE.START);
  }

  setState(state) {
    this.state = state;
    this.ui.renderOverlay(state, this);
  }

  difficulty() {
    return getDifficulty(this.difficultyId);
  }

  difficultyLabel() {
    return this.difficulty().label;
  }

  modeLabel() {
    return this.isMultiplayer()
      ? getModeFromRoomMode(this.roomMode).label
      : getGameMode('single').label;
  }

  gameOverSummary() {
    const result = this.endMessage ? `${this.endMessage} ` : '';
    return `${result}Final Score ${this.score}. Money Remaining $${this.money}. Zombies Killed ${this.zombiesKilled}. Waves Survived ${this.wave}. Weapon Purchases ${this.weaponPurchases}.`;
  }

  weaponAmmoLabel() {
    const ammo = this.weaponManager.currentAmmo();
    return ammo === Infinity ? '∞' : String(ammo);
  }

  zombiesRemaining() {
    return this.enemies.length + Math.max(0, this.spawnQueue);
  }

  award({ score = 0, money = 0, label = '' }) {
    this.score += score;
    this.money += money;
    if (label && (score || money)) {
      const moneyText = money ? ` $${money}` : '';
      this.addFloatingText(`${label}${score ? ` +${score}` : ''}${moneyText}`, this.player.x, this.player.y - 48, '#ffd166');
    }
    this.broadcastEconomy();
  }

  broadcastEconomy() {
    if (!this.isMultiplayer()) return;
    this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.SYNC_STATE, nowPayload({
      playerEconomy: {
        playerId: this.multiplayer.localPlayerId,
        score: this.score,
        money: this.money,
        weapon: this.weaponManager.current().id,
        ammo: this.weaponAmmoLabel(),
        weaponPurchases: this.weaponPurchases,
      },
    }));
  }

  openShop(message = '') {
    this.shopOpen = true;
    if (!this.isMultiplayer()) this.state = GAME_STATE.PAUSED;
    this.ui.renderShop(this, message);
  }

  closeShop() {
    this.shopOpen = false;
    this.setState(GAME_STATE.PLAYING);
  }

  buyWeapon(weaponId) {
    const result = this.weaponManager.buy(weaponId, this.money);
    if (result.ok) {
      this.money -= result.cost;
      this.weaponPurchases += 1;
      this.broadcastEconomy();
    }
    this.ui.renderShop(this, result.message);
  }

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;
    if (this.input.pausePressed && this.state !== GAME_STATE.START && this.state !== GAME_STATE.GAME_OVER) {
      this.setState(this.state === GAME_STATE.PLAYING ? GAME_STATE.PAUSED : GAME_STATE.PLAYING);
    }
    if (this.input.shopPressed && this.state === GAME_STATE.PLAYING) this.openShop();
    if (this.state === GAME_STATE.PLAYING) this.update(dt);
    this.draw();
    this.ui.renderHud(this);
    this.input.consumeFrameFlags();
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.frame += 1;
    if (import.meta.env?.DEV) {
      window.__pixelOutbreakDebug = {
        frame: this.frame,
        state: this.state,
        player: { x: Math.round(this.player.x), y: Math.round(this.player.y), health: Math.ceil(this.player.health) },
        enemies: this.enemies.length,
        bullets: this.bullets.length,
        pickups: this.pickups.length,
        wave: this.wave,
        spawnQueue: this.spawnQueue,
        zombiesRemaining: this.zombiesRemaining(),
        multiplayer: this.isMultiplayer()
          ? {
              isHost: this.multiplayer.isHost,
              remotes: [...this.multiplayer.remotePlayers.values()].map((player) => ({
                id: player.playerId,
                x: Math.round(player.x),
                y: Math.round(player.y),
                targetX: Math.round(player.targetX),
                targetY: Math.round(player.targetY),
              })),
              mode: this.roomMode,
            }
          : null,
      };
    }

    const mouseWorld = this.camera.screenToWorld(this.input.mouse);
    const aimWorld = this.input.aimTarget(this.player, mouseWorld);
    this.player.update(dt, this.input, aimWorld, this.world);
    this.multiplayer.updateRemotePlayers(dt);
    this.camera.follow(this.player, dt);

    if ((this.input.mouse.down || this.input.mouse.pressed || this.input.isMobileShooting()) && this.player.canShoot()) {
      this.firePlayer(aimWorld);
    }

    if (!this.isMultiplayer() || this.multiplayer.isHost) {
      this.spawnTimer -= dt;
      if (this.spawnQueue > 0 && this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnQueue -= 1;
        this.spawnTimer = Math.max(0.16, 0.72 - this.wave * 0.035 * this.difficulty().waveScale);
      }
      if (this.spawnQueue <= 0 && this.enemies.length === 0) this.nextWave();
    }

    this.bullets.forEach((bullet) => bullet.update(dt, this.world));
    this.enemies.forEach((enemy) => enemy.update(dt, this));
    this.pickups.forEach((pickup) => pickup.update(dt));
    this.particles.forEach((particle) => particle.update(dt));
    this.floaters.forEach((text) => text.update(dt));
    this.handleHits();
    this.cleanup();
    this.syncMultiplayer();

    if (this.player.health <= 0) {
      this.setState(GAME_STATE.GAME_OVER);
      this.saveMultiplayerResult(false);
    }
  }

  firePlayer(mouseWorld) {
    const weapon = this.weaponManager.current();
    if (!this.weaponManager.canShoot()) return;
    this.player.markShot(weapon);
    const specs = [];
    const pellets = this.player.hasAbility('spread') ? Math.max(weapon.pellets, 3) : weapon.pellets;
    const spread = this.player.hasAbility('spread') ? Math.max(weapon.spread, 0.44) : weapon.spread;
    for (let i = 0; i < pellets; i++) {
      const offset = pellets === 1 ? 0 : -spread / 2 + (spread / (pellets - 1)) * i;
      specs.push({
        ...this.player.bulletSpec(mouseWorld, weapon, offset),
        ownerId: this.isMultiplayer() ? this.multiplayer.localPlayerId : null,
      });
    }
    this.weaponManager.consumeAmmo();
    specs.forEach((spec) => this.spawnBullet(spec));
    this.camera.addShake(3.5, 0.1);
    this.audio.shoot();
    if (this.isMultiplayer()) this.sendShootEvent(mouseWorld, weapon);
  }

  spawnBullet(spec) {
    this.bullets.push(new Bullet(spec));
  }

  sendShootEvent(aimWorld, weapon) {
    const angle = Math.atan2(aimWorld.y - this.player.y, aimWorld.x - this.player.x);
    this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.PLAYER_SHOOT, nowPayload({
      x: this.player.x,
      y: this.player.y,
      angle,
      weaponType: weapon.id,
      damage: weapon.damage,
      bulletId: crypto.randomUUID(),
    }));
  }

  spawnRemoteShot(event) {
    if (event.player_id === this.multiplayer.localPlayerId) return;
    const payload = event.payload || {};
    const weapon = getWeapon(payload.weaponType || 'pistol');
    const dir = { x: Math.cos(payload.angle || 0), y: Math.sin(payload.angle || 0) };
    for (let i = 0; i < weapon.pellets; i++) {
      const offset = weapon.pellets === 1 ? 0 : -weapon.spread / 2 + (weapon.spread / (weapon.pellets - 1)) * i;
      const angle = (payload.angle || 0) + offset;
      this.spawnBullet({
        x: Number(payload.x) + dir.x * 24,
        y: Number(payload.y) + dir.y * 24,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        r: weapon.radius || 5,
        damage: weapon.damage,
        friendly: true,
        ownerId: event.player_id,
        bulletId: payload.bulletId,
        weaponType: weapon.id,
        color: weapon.color,
        area: weapon.area || 0,
      });
    }
  }

  handleNetworkEvent(event) {
    if (!this.isMultiplayer() || !this.multiplayer.markEventSeen(event.id)) return;
    if (event.event_type === NETWORK_EVENTS.PLAYER_SHOOT) this.spawnRemoteShot(event);
    if (event.event_type === NETWORK_EVENTS.PLAYER_HIT && event.player_id !== this.multiplayer.localPlayerId) {
      const payload = event.payload || {};
      if (payload.shooterPlayerId === this.multiplayer.localPlayerId) {
        this.award({ score: 5, money: 2, label: 'PvP hit' });
        this.addFloatingText('+5 hit', this.player.x, this.player.y - 42, '#ffd166');
      }
      if (payload.targetPlayerId === this.multiplayer.localPlayerId) {
        this.multiplayer.statusMessage = `Hit by ${payload.weaponType || 'weapon'} for ${payload.damage}.`;
      }
    }
    if (event.event_type === NETWORK_EVENTS.PLAYER_DIED) {
      const payload = event.payload || {};
      this.endMessage = payload.winnerPlayerId === this.multiplayer.localPlayerId ? 'You win!' : 'You lose.';
      if (payload.winnerPlayerId === this.multiplayer.localPlayerId) {
        this.award({ score: 100, money: 50, label: 'Win' });
        this.saveMultiplayerResult(true);
      }
      this.setState(GAME_STATE.GAME_OVER);
    }
    if (event.event_type === NETWORK_EVENTS.WAVE_STARTED && event.player_id !== this.multiplayer.localPlayerId) {
      const payload = event.payload || {};
      if (payload.completedWave) this.award({ score: 50, money: 30, label: 'Wave clear' });
    }
    if (event.event_type === NETWORK_EVENTS.SYNC_STATE) {
      if (event.payload?.playerEconomy) this.applySyncState(event.payload);
      else if (!this.multiplayer.isHost) this.applySyncState(event.payload);
    }
    if (event.event_type === NETWORK_EVENTS.PLAYER_LEFT && event.player_id !== this.multiplayer.localPlayerId) {
      this.multiplayer.statusMessage = 'Other player disconnected.';
    }
    if (event.event_type === NETWORK_EVENTS.GAME_OVER && event.player_id !== this.multiplayer.localPlayerId) {
      this.multiplayer.statusMessage = 'Room game over.';
      this.setState(GAME_STATE.GAME_OVER);
    }
  }

  syncMultiplayer() {
    if (!this.isMultiplayer()) return;
    const now = performance.now();
    if (now - this.multiplayer.lastPlayerWrite > 75) {
      this.multiplayer.lastPlayerWrite = now;
      this.roomManager.updatePlayer(this.multiplayer.room.id, {
        x: this.player.x,
        y: this.player.y,
        angle: this.player.angle,
        health: Math.max(0, Math.ceil(this.player.health)),
        score: this.score,
      });
    }

    if (this.multiplayer.isHost && now - this.multiplayer.lastSyncWrite > 220) {
      this.multiplayer.lastSyncWrite = now;
      const gameState = this.serializeSharedState();
      this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.SYNC_STATE, nowPayload(gameState));
      this.roomManager.updateRoom(this.multiplayer.room.id, {
        current_wave: this.wave,
        game_state: gameState,
      }).catch((error) => {
        this.multiplayer.statusMessage = error.message;
      });
    }
  }

  serializeSharedState() {
    return {
      wave: this.wave,
      mode: this.roomMode,
      difficulty: this.difficultyId,
      spawnQueue: this.spawnQueue,
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        kind: enemy.kind,
        typeId: enemy.typeId,
        reward: enemy.reward,
        moneyReward: enemy.moneyReward,
        attackDamage: enemy.attackDamage,
        x: enemy.x,
        y: enemy.y,
        angle: enemy.angle || 0,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        flash: enemy.flash,
      })),
      pickups: this.pickups.map((pickup) => ({
        id: pickup.id,
        x: pickup.x,
        y: pickup.y,
        type: pickup.type,
        pulse: pickup.pulse,
      })),
    };
  }

  applySyncState(payload = {}) {
    if (payload.playerEconomy) {
      this.multiplayer.applyEconomy?.(payload.playerEconomy);
      return;
    }
    this.wave = payload.wave || this.wave;
    this.roomMode = payload.mode || this.roomMode;
    this.difficultyId = payload.difficulty || this.difficultyId;
    this.spawnQueue = payload.spawnQueue || 0;
    this.enemies = (payload.enemies || []).map((data) => {
      const existing = this.enemies.find((enemy) => enemy.id === data.id);
      const enemy = existing || (data.kind === 'rival'
        ? new Rival(data.x, data.y, this.wave, data.typeId, this.difficulty())
        : new Zombie(data.x, data.y, this.wave, data.typeId, this.difficulty()));
      enemy.id = data.id;
      enemy.typeId = data.typeId || enemy.typeId;
      enemy.reward = Number(data.reward || enemy.reward);
      enemy.moneyReward = Number(data.moneyReward || enemy.moneyReward);
      enemy.attackDamage = Number(data.attackDamage || enemy.attackDamage);
      enemy.x = Number(data.x);
      enemy.y = Number(data.y);
      enemy.angle = Number(data.angle || enemy.angle || 0);
      enemy.health = Number(data.health);
      enemy.maxHealth = Number(data.maxHealth || enemy.maxHealth);
      enemy.flash = Number(data.flash || 0);
      return enemy;
    });
    this.pickups = (payload.pickups || []).map((data) => {
      const pickup = new Pickup(Number(data.x), Number(data.y), data.type);
      pickup.id = data.id;
      pickup.pulse = Number(data.pulse || pickup.pulse);
      return pickup;
    });
  }

  nearestLivingPlayer(from) {
    const candidates = [{ ...this.player, isLocal: true }];
    if (this.isMultiplayer()) {
      for (const remote of this.multiplayer.remotePlayers.values()) {
        if (remote.isConnected && remote.health > 0) candidates.push({ ...remote, isLocal: false });
      }
    }
    return candidates
      .filter((player) => player.health > 0)
      .sort((a, b) => distance(from, a) - distance(from, b))[0] || null;
  }

  spawnEnemy() {
    let x;
    let y;
    const radius = 22;
    const margin = radius + 12;
    let tries = 0;

    do {
      const side = Math.floor(rand(0, 4));
      x = side === 0 ? rand(margin, WORLD.width - margin) : side === 1 ? WORLD.width - margin : side === 2 ? rand(margin, WORLD.width - margin) : margin;
      y = side === 0 ? margin : side === 1 ? rand(margin, WORLD.height - margin) : side === 2 ? WORLD.height - margin : rand(margin, WORLD.height - margin);
      tries += 1;
    } while ((distance({ x, y }, this.player) < 520 || isBlocked(x, y, radius, this.world)) && tries < 80);

    const typeId = this.chooseZombieType();
    const enemy = ['spitter', 'boss'].includes(typeId)
      ? new Rival(x, y, this.wave, typeId, this.difficulty())
      : new Zombie(x, y, this.wave, typeId, this.difficulty());
    enemy.id = crypto.randomUUID();
    this.enemies.push(enemy);
  }

  chooseZombieType() {
    const difficulty = this.difficulty();
    if (this.wave > 0 && this.wave % difficulty.bossEvery === 0 && chance(this.difficultyId === 'hard' ? 0.75 : 0.5)) return 'boss';
    if (this.wave < difficulty.specialWave) return 'normal';
    const roll = Math.random();
    if (this.difficultyId === 'hard') {
      if (roll < 0.22) return 'fast';
      if (roll < 0.38) return 'tank';
      if (roll < 0.56) return 'spitter';
      if (roll < 0.7) return 'exploder';
    } else if (this.difficultyId === 'easy') {
      if (roll < 0.12) return 'fast';
      if (roll < 0.2) return 'spitter';
      if (roll < 0.26) return 'tank';
    } else {
      if (roll < 0.18) return 'fast';
      if (roll < 0.3) return 'spitter';
      if (roll < 0.4) return 'tank';
      if (roll < 0.48) return 'exploder';
    }
    return 'normal';
  }

  nextWave() {
    if (this.wave > 0) this.award({ score: 50, money: 30, label: 'Wave clear' });
    this.wave += 1;
    this.spawnQueue = Math.max(3, Math.round((5 + this.wave * 3 * this.difficulty().waveScale) * this.difficulty().spawnMultiplier));
    this.spawnTimer = 0.8;
    this.addFloatingText(`Wave ${this.wave}`, this.player.x, this.player.y - 60, '#ffd166');
    if (this.wave > 1) this.pickups.push(this.createSafePickup());
    if (this.isMultiplayer() && this.multiplayer.isHost) {
      this.roomManager.updateRoom(this.multiplayer.room.id, { current_wave: this.wave }).catch((error) => {
        this.multiplayer.statusMessage = error.message;
      });
      this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.WAVE_STARTED, nowPayload({
        wave: this.wave,
        completedWave: this.wave > 1 ? this.wave - 1 : 0,
      }));
    }
  }

  createSafePickup(type = null) {
    let x;
    let y;
    let tries = 0;
    do {
      x = rand(180, WORLD.width - 180);
      y = rand(180, WORLD.height - 180);
      tries += 1;
    } while ((isBlocked(x, y, 24, this.world) || distance({ x, y }, this.player) < 120) && tries < 80);
    const pickup = new Pickup(x, y, type);
    pickup.id = crypto.randomUUID();
    return pickup;
  }

  handleHits() {
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      if (this.isPvp() && bullet.friendly && bullet.ownerId && bullet.ownerId !== this.multiplayer.localPlayerId) {
        if (distance(bullet, this.player) < bullet.r + this.player.r) {
          bullet.dead = true;
          this.applyPvpHit(bullet);
          continue;
        }
      }
      if (bullet.friendly) {
        for (const enemy of this.enemies) {
          if (enemy.dead || distance(bullet, enemy) > bullet.r + enemy.r) continue;
          enemy.damage(bullet.damage);
          bullet.dead = true;
          this.burst(bullet.x, bullet.y, '#ffe66d', 5);
          this.addFloatingText(`-${bullet.damage}`, enemy.x, enemy.y - 20, '#fff6d1');
          if (this.isMultiplayer() && this.multiplayer.isHost) {
            this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.ZOMBIE_HIT, nowPayload({
              zombieId: enemy.id,
              damage: bullet.damage,
              shooterPlayerId: bullet.ownerId || this.multiplayer.localPlayerId,
            }));
          }
          if (enemy.dead) this.killEnemy(enemy, bullet.ownerId);
          break;
        }
      } else if (distance(bullet, this.player) < bullet.r + this.player.r) {
        bullet.dead = true;
        if (this.player.hurt(bullet.damage)) {
          this.camera.addShake(8, 0.18);
          this.audio.hit();
          this.addFloatingText(`-${bullet.damage}`, this.player.x, this.player.y - 24, '#ef476f');
        }
      }
    }

    for (const pickup of this.pickups) {
      if (distance(pickup, this.player) > pickup.r + this.player.r) continue;
      pickup.dead = true;
      if (pickup.type === 'health') {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 28);
        this.addFloatingText('+HP', pickup.x, pickup.y - 18, '#7bed9f');
      } else {
        this.player.addAbility(pickup.type, ABILITIES[pickup.type].duration);
        this.addFloatingText(ABILITIES[pickup.type].label, pickup.x, pickup.y - 18, ABILITIES[pickup.type].color);
      }
      this.audio.pickup();
      this.burst(pickup.x, pickup.y, pickup.color, 8);
      if (this.isMultiplayer()) {
        this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.PICKUP_COLLECTED, nowPayload({
          pickupId: pickup.id,
          playerId: this.multiplayer.localPlayerId,
          pickupType: pickup.type,
        }));
      }
    }
  }

  isPvp() {
    return this.isMultiplayer() && this.roomMode === 'pvp';
  }

  applyPvpHit(bullet) {
    if (!this.player.hurt(bullet.damage)) return;
    this.camera.addShake(5, 0.12);
    this.audio.hit();
    this.addFloatingText(`-${bullet.damage}`, this.player.x, this.player.y - 28, '#ef476f');
    this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.PLAYER_HIT, nowPayload({
      targetPlayerId: this.multiplayer.localPlayerId,
      shooterPlayerId: bullet.ownerId,
      damage: bullet.damage,
      targetHealth: Math.max(0, Math.ceil(this.player.health)),
      weaponType: bullet.weaponType || 'pistol',
    }));
    if (this.player.health <= 0) {
      this.endMessage = 'You lose.';
      this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.PLAYER_DIED, nowPayload({
        loserPlayerId: this.multiplayer.localPlayerId,
        winnerPlayerId: bullet.ownerId,
      }));
      this.saveMultiplayerResult(false);
      this.setState(GAME_STATE.GAME_OVER);
    }
  }

  killEnemy(enemy, ownerId = null) {
    const reward = enemy.reward || (enemy.kind === 'rival' ? 90 : 45);
    const moneyReward = enemy.moneyReward || Math.max(1, Math.round(reward / 2));
    const localKill = !this.isMultiplayer() || !ownerId || ownerId === this.multiplayer.localPlayerId;
    if (localKill) {
      this.award({ score: reward, money: moneyReward, label: enemy.label || 'Kill' });
      this.zombiesKilled += 1;
    }
    if (this.isMultiplayer() && localKill) this.multiplayer.zombiesKilled += 1;
    this.audio.enemyDown();
    this.burst(enemy.x, enemy.y, enemy.kind === 'rival' ? '#ef476f' : '#78a85d', 12);
    if (this.isMultiplayer() && this.multiplayer.isHost) {
      this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.ZOMBIE_KILLED, nowPayload({
        zombieId: enemy.id,
        killerPlayerId: ownerId || this.multiplayer.localPlayerId,
        zombieType: enemy.typeId,
        scoreAwarded: reward,
        moneyAwarded: moneyReward,
      }));
    }
    if (chance(this.difficulty().pickupChance) && (!this.isMultiplayer() || this.multiplayer.isHost)) {
      const pickup = new Pickup(enemy.x, enemy.y);
      pickup.id = crypto.randomUUID();
      this.pickups.push(pickup);
    }
  }

  burst(x, y, color, amount) {
    for (let i = 0; i < amount; i++) this.particles.push(new Particle(x, y, color, amount / 8));
  }

  addFloatingText(text, x, y, color) {
    this.floaters.push(new FloatingText(text, x, y, color));
  }

  cleanup() {
    this.bullets = this.bullets.filter((bullet) => !bullet.dead);
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
    this.pickups = this.pickups.filter((pickup) => !pickup.dead);
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.floaters = this.floaters.filter((text) => text.life > 0);
  }

  saveMultiplayerResult(survived) {
    if (!this.isMultiplayer() || this.multiplayerResultSaved) return;
    this.multiplayerResultSaved = true;
    this.roomManager.saveResult({
      room: this.multiplayer.room,
      playerName: this.multiplayer.localPlayerName,
      score: this.score,
      wavesSurvived: this.wave,
      zombiesKilled: this.multiplayer.zombiesKilled,
      survived,
    });
    this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.GAME_OVER, nowPayload({
      score: this.score,
      moneyRemaining: this.money,
      wavesSurvived: this.wave,
      zombiesKilled: this.zombiesKilled,
      weaponPurchases: this.weaponPurchases,
      survived,
    }));
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.camera.apply(this.ctx);
    this.world.draw(this.ctx, this.camera);
    this.pickups.forEach((pickup) => drawPickup(this.ctx, pickup));
    this.bullets.forEach((bullet) => drawBullet(this.ctx, bullet));
    this.enemies
      .slice()
      .sort((a, b) => a.y - b.y)
      .forEach((enemy) => (enemy.kind === 'rival' ? drawRival(this.ctx, enemy) : drawZombie(this.ctx, enemy)));
    if (this.isMultiplayer()) {
      for (const remote of this.multiplayer.remotePlayers.values()) {
        if (!remote.isConnected) continue;
        drawPlayer(this.ctx, remote, {
          name: remote.playerName,
          shirt: remote.playerSlot === 1 ? '#4cc9a7' : '#57b8ff',
          glow: remote.playerSlot === 1 ? '#4cc9a7' : '#57b8ff',
          labelColor: remote.playerSlot === 1 ? '#9ff3d8' : '#9ee7ff',
        });
      }
    }
    drawPlayer(this.ctx, this.player, this.isMultiplayer()
      ? {
          name: `${this.multiplayer.localPlayerName} (You)`,
          shirt: this.multiplayer.localSlot === 1 ? '#4cc9a7' : '#57b8ff',
          glow: '#ffd166',
          labelColor: '#fff6d1',
        }
      : {});
    this.particles.forEach((particle) => particle.draw(this.ctx));
    this.floaters.forEach((text) => text.draw(this.ctx));
    this.ctx.restore();
    this.drawVignette();
  }

  drawVignette() {
    const gradient = this.ctx.createRadialGradient(480, 270, 80, 480, 270, 560);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
