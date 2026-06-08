import { Camera } from './Camera.js';
import { GAME_STATE, WORLD, ABILITIES } from './constants.js';
import { chance, distance, rand } from './math.js';
import { World } from './World.js';
import { drawBullet, drawPickup, drawPlayer, drawRival, drawTower, drawZombie } from '../assets/sprites.js';
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
import { RoomManager } from '../multiplayer/RoomManager.js';
import { getDifficulty } from './DifficultyManager.js';
import { getGameMode, getModeFromRoomMode } from './GameModeManager.js';
import { WeaponManager } from './WeaponManager.js';
import { getWeapon } from '../entities/WeaponTypes.js';
import { getZombieType, zombieTypesFor } from '../entities/ZombieTypes.js';
import { Tower, getTowerTier, TOWER_TIERS } from '../entities/Tower.js';
import { LevelManager } from './LevelManager.js';
import { SpecialAbilityManager } from './SpecialAbilityManager.js';
import { ReviveManager } from './ReviveManager.js';
import { themeForWave, THEMES } from './ThemeManager.js';
import { MapManager } from './MapManager.js';
import { getMapDefinition } from './MapDefinitions.js';

const SHOP_UPGRADES = {
  damage: { cost: 200, max: 8, amount: 1 },
  speed: { cost: 200, max: 5, amount: 0.04 },
};

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
    this.ui.onMapSelected = (options) => this.handleMapSelected(options);
    this.ui.onJoinRoom = (form) => this.joinMultiplayer(form);
    this.ui.onLeaveRoom = () => this.leaveRoom();
    this.ui.onOpenShop = () => this.openShop();
    this.ui.onCloseShop = () => this.closeShop();
    this.ui.onBuyWeapon = (weaponId) => this.buyWeapon(weaponId);
    this.ui.onBuyHealth = (amount, cost) => this.buyHealth(amount, cost);
    this.ui.onBuyArmor = (amount, cost) => this.buyArmor(amount, cost);
    this.ui.onBuyUpgrade = (upgradeId) => this.buyAbilityUpgrade(upgradeId);
    this.ui.onBuyTower = (towerId) => this.buyTower(towerId);
    this.ui.onSpecial = () => this.useSpecial();
    this.ui.onAudioToggle = () => this.toggleAudio();
    this.ui.onRestart = () => this.start();
    this.ui.onResume = () => this.setState(GAME_STATE.PLAYING);
    this.roomManager = new RoomManager(supabase);
    this.multiplayer = new MultiplayerState();
    this.mode = 'single';
    this.roomMode = 'single_player';
    this.difficultyId = 'medium';
    this.mapManager = new MapManager('city');
    this.mapId = 'city';
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
    const selectedMap = this.mapManager.setMap(this.mapId);
    this.world = new World(selectedMap.id);
    this.theme = selectedMap.theme || themeForWave(1);
    this.world.setTheme(this.theme);
    this.camera = new Camera(this.canvas, this.world);
    const spawn = selectedMap.playerSpawns?.[0] || { x: WORLD.width / 2, y: WORLD.height / 2 };
    this.player = new Player(spawn.x, spawn.y);
    this.frame = 0;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [this.createSafePickup('health')];
    this.towers = [];
    this.particles = [];
    this.floaters = [];
    this.score = 0;
    this.money = 0;
    this.zombiesKilled = 0;
    this.weaponPurchases = 0;
    this.abilityPurchases = { damage: 0, speed: 0 };
    this.levelManager = new LevelManager();
    this.special = new SpecialAbilityManager();
    this.revive = new ReviveManager();
    this.specialRipples = [];
    this.specialRockets = [];
    this.wave = 0;
    this.bossSpawnedThisWave = false;
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.weaponManager = new WeaponManager();
    this.shopOpen = false;
    this.multiplayerResultSaved = false;
    if (startWave) this.nextWave();
  }

  start({ difficulty = 'medium', mapId = this.mapId } = {}) {
    this.mode = 'single';
    this.roomMode = 'single_player';
    this.difficultyId = difficulty;
    this.mapId = mapId || 'city';
    this.roomManager.unsubscribe();
    this.multiplayer.reset();
    this.audio.resume();
    this.reset();
    this.setState(GAME_STATE.PLAYING);
  }

  handleMapSelected({ mode = 'single', difficulty = 'medium', mapId = 'city' }) {
    this.mapId = mapId;
    if (mode === 'single') {
      this.start({ difficulty, mapId });
      return;
    }
    this.showMultiplayerMenu({ mode, difficulty, mapId });
  }

  isMultiplayer() {
    return this.mode === 'multiplayer' && this.multiplayer.active;
  }

  showMultiplayerMenu({ mode = 'coop', difficulty = 'medium', mapId = this.mapId, error = '' } = {}) {
    this.mode = 'multiplayer';
    this.roomMode = mode;
    this.difficultyId = difficulty;
    this.mapId = mapId || 'city';
    this.ui.renderMultiplayerMenu({
      playerName: this.roomManager.storedName(),
      mode,
      difficulty,
      mapId: this.mapId,
      error: this.roomManager.hasClient() ? error : 'Missing Supabase env vars.',
    });
  }

  async joinMultiplayer({ playerName, roomCode, mode = this.roomMode, difficulty = this.difficultyId, mapId = this.mapId }) {
    try {
      this.ui.renderMultiplayerMenu({ playerName, roomCode, mode, difficulty, mapId, status: 'Connecting...' });
      const session = await this.roomManager.joinOrCreateRoom({ playerName, roomCode, mode, difficulty, mapId });
      this.multiplayer.configure(session);
      this.roomMode = this.multiplayer.roomMode;
      this.difficultyId = this.multiplayer.difficulty;
      this.mapId = session.room?.game_state?.mapId || this.multiplayer.mapId || mapId || 'city';
      this.subscribeToRoom();
      if (session.room.status === 'playing' || this.multiplayer.connectedPlayers().length >= 2) this.startMultiplayerGame();
      else this.renderWaitingRoom();
    } catch (error) {
      this.showMultiplayerMenu({ mode, difficulty, mapId, error: error.message || 'Failed to join room.' });
    }
  }

  subscribeToRoom() {
    this.roomManager.subscribe({
      onRoom: (room) => this.handleRoomChange(room),
      onPlayers: (players) => this.refreshRoomPlayers(players),
      onEvent: (event) => this.handleNetworkEvent(event),
      onSnapshot: (snapshot) => this.handleStateSnapshot(snapshot),
      onError: (message) => {
        this.multiplayer.statusMessage = message;
        if (!this.multiplayer.active) this.showMultiplayerMenu({ mode: this.roomMode, difficulty: this.difficultyId, mapId: this.mapId, error: message });
      },
    });
  }

  async refreshRoomPlayers(nextPlayers = null) {
    if (!this.multiplayer.room) return;
    try {
      const previouslyConnected = new Set(
        [...this.multiplayer.remotePlayers.values()]
          .filter((player) => player.isConnected)
          .map((player) => player.playerId),
      );
      const players = nextPlayers || await this.roomManager.fetchPlayers(this.multiplayer.room.id);
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
    this.mapId = room?.game_state?.mapId || this.mapId;
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
    this.mapId = this.multiplayer.room?.game_state?.mapId || this.mapId;
    this.reset({ startWave: this.multiplayer.isHost });
    const spawn = getMapDefinition(this.mapId).playerSpawns?.[this.multiplayer.localSlot - 1] || { x: WORLD.width / 2 + (this.multiplayer.localSlot === 1 ? -44 : 44), y: WORLD.height / 2 };
    this.player.x = spawn.x;
    this.player.y = spawn.y;
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
    }
    this.mode = 'single';
    this.multiplayer.reset();
    this.mapId = 'city';
    this.reset();
    this.setState(GAME_STATE.START);
  }

  setState(state) {
    this.state = state;
    const gameplayActive = state === GAME_STATE.PLAYING && !this.shopOpen;
    this.input.setGameplayActive?.(gameplayActive);
    this.canvas.closest('.canvas-frame')?.classList.toggle('is-playing', gameplayActive);
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
    const upgrades = this.abilityPurchases.damage + this.abilityPurchases.speed;
    return `${result}Final Score ${this.score}. Money Remaining $${this.money}. Zombies Killed ${this.zombiesKilled}. Waves Survived ${this.wave}. Weapon Purchases ${this.weaponPurchases}. Ability Upgrades ${upgrades}.`;
  }

  toggleAudio() {
    const enabled = this.audio.toggleMute();
    this.addFloatingText(enabled ? 'Audio on' : 'Muted', this.player.x, this.player.y - 54, '#9ee7ff');
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
    this.money += Math.round(money * 1.6);
    const leveled = this.levelManager.update(this.score);
    if (leveled) this.handleLevelUp();
    if (label && (score || money)) {
      const moneyText = money ? ` $${Math.round(money * 1.6)}` : '';
      this.addFloatingText(`${label}${score ? ` +${score}` : ''}${moneyText}`, this.player.x, this.player.y - 48, '#ffd166');
    }
    this.broadcastEconomy();
  }

  handleLevelUp() {
    const healed = Math.min(10, this.player.maxHealth - this.player.health);
    this.player.health = Math.min(this.player.maxHealth, this.player.health + healed);
    this.specialRipples.push({ x: this.player.x, y: this.player.y, radius: 12, maxRadius: 120, life: 0.42 });
    this.addFloatingText('LEVEL UP! +10 HP', this.player.x, this.player.y - 72, '#ffd166');
    this.audio.pickup();
    if (this.isMultiplayer()) {
      this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.SYNC_STATE, nowPayload({
        levelUp: {
          playerId: this.multiplayer.localPlayerId,
          newLevel: this.levelManager.level,
          healedAmount: healed,
          newHealth: Math.ceil(this.player.health),
        },
      }));
    }
  }

  broadcastEconomy() {
    if (!this.isMultiplayer()) return;
    this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.SYNC_STATE, nowPayload({
      playerEconomy: {
        playerId: this.multiplayer.localPlayerId,
        score: this.score,
        money: this.money,
        armor: this.player.armor || 0,
        weapon: this.weaponManager.current().id,
        ammo: this.weaponAmmoLabel(),
        weaponPurchases: this.weaponPurchases,
        level: this.levelManager.level,
        specialCharge: this.special.percent(),
        isDowned: this.revive.isDowned,
        reviveTimer: this.revive.timer,
      },
    }));
  }

  openShop(message = '', tab = 'weapons') {
    this.shopOpen = true;
    this.input.setGameplayActive?.(false);
    this.canvas.closest('.canvas-frame')?.classList.remove('is-playing');
    if (!this.isMultiplayer()) this.state = GAME_STATE.PAUSED;
    this.ui.renderShop(this, message, tab);
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

  buyHealth(amount, cost) {
    if (this.player.health >= this.player.maxHealth) {
      this.ui.renderShop(this, 'HP is already full.', 'health');
      return;
    }
    if (this.money < cost) {
      this.ui.renderShop(this, 'Not enough money.', 'health');
      return;
    }
    const healed = Math.min(amount, this.player.maxHealth - this.player.health);
    this.money -= cost;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + healed);
    this.broadcastEconomy();
    this.addFloatingText(`+${Math.ceil(healed)} HP`, this.player.x, this.player.y - 42, '#7bed9f');
    this.audio.pickup();
    this.ui.renderShop(this, `Recovered ${Math.ceil(healed)} HP.`, 'health');
  }

  buyArmor(amount, cost) {
    if (this.player.armor >= this.player.maxArmor) {
      this.ui.renderShop(this, 'Armor is already full.', 'health');
      return;
    }
    if (this.money < cost) {
      this.ui.renderShop(this, 'Not enough money.', 'health');
      return;
    }
    const armored = Math.min(amount, this.player.maxArmor - this.player.armor);
    this.money -= cost;
    this.player.armor = Math.min(this.player.maxArmor, this.player.armor + armored);
    this.broadcastEconomy();
    this.addFloatingText(`+${Math.ceil(armored)} ARMOR`, this.player.x, this.player.y - 42, '#9ee7ff');
    this.audio.pickup();
    this.ui.renderShop(this, `Added ${Math.ceil(armored)} armor.`, 'health');
  }

  buyAbilityUpgrade(upgradeId) {
    const upgrade = SHOP_UPGRADES[upgradeId];
    if (!upgrade) return;
    const current = this.abilityPurchases[upgradeId] || 0;
    if (current >= upgrade.max) {
      this.ui.renderShop(this, 'Upgrade is already maxed.', 'abilities');
      return;
    }
    if (this.money < upgrade.cost) {
      this.ui.renderShop(this, 'Not enough money.', 'abilities');
      return;
    }
    this.money -= upgrade.cost;
    this.abilityPurchases[upgradeId] = current + 1;
    if (upgradeId === 'damage') {
      this.player.permanentDamageBonus += upgrade.amount;
      this.addFloatingText(`Permanent damage +${upgrade.amount}`, this.player.x, this.player.y - 52, '#ef476f');
    } else if (upgradeId === 'speed') {
      this.player.permanentSpeedBonus = Math.min(upgrade.amount * upgrade.max, this.player.permanentSpeedBonus + upgrade.amount);
      this.addFloatingText(`Move speed +${Math.round(upgrade.amount * 100)}%`, this.player.x, this.player.y - 52, '#4cc9a7');
    }
    this.audio.pickup();
    this.broadcastEconomy();
    this.ui.renderShop(this, 'Permanent run upgrade purchased.', 'abilities');
  }

  towerShopItems() {
    return Object.values(TOWER_TIERS).map((tower) => ({
      ...tower,
      description: tower.id === 'barricade'
        ? 'Budget tower with solid HP and steady close defense.'
        : tower.id === 'sentry'
          ? 'Better range, HP, and firepower for mid-wave defense.'
          : 'Expensive durable tower with strong coverage, but still destructible.',
    }));
  }

  buyTower(towerId) {
    const tier = getTowerTier(towerId);
    if (this.money < tier.price) {
      this.ui.renderShop(this, 'Not enough money.', 'towers');
      return;
    }
    if (isBlocked(this.player.x, this.player.y, 28, this.world)) {
      this.ui.renderShop(this, 'Move to open ground before building.', 'towers');
      return;
    }
    this.money -= tier.price;
    const tower = this.createTower({
      x: this.player.x,
      y: this.player.y,
      tierId: tier.id,
      ownerId: this.isMultiplayer() ? this.multiplayer.localPlayerId : null,
    });
    this.towers.push(tower);
    this.addFloatingText(`${tier.name} built`, tower.x, tower.y - 52, tier.color);
    this.audio.pickup();
    this.broadcastEconomy();
    if (this.isMultiplayer()) {
      this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.TOWER_PLACED, nowPayload({ tower: tower.serialize() }));
    }
    this.ui.renderShop(this, `${tier.name} deployed.`, 'towers');
  }

  createTower(data) {
    return new Tower(data);
  }

  useSpecial() {
    if (this.revive.isDowned) return;
    if (!this.special.canUse()) {
      this.addFloatingText('Charging...', this.player.x, this.player.y - 54, '#9ee7ff');
      return;
    }
    const target = this.specialTarget();
    if (!target) {
      this.addFloatingText('No target', this.player.x, this.player.y - 54, '#9ee7ff');
      return;
    }
    if (!this.special.use()) return;
    const damage = 80 + (this.levelManager.level - 1) * 6;
    const rocket = {
      x: this.player.x,
      y: this.player.y,
      targetX: target.x,
      targetY: target.y,
      damage,
      radius: 110,
      speed: 680,
      trail: [],
    };
    this.specialRockets.push(rocket);
    this.camera.addShake(4, 0.12);
    this.audio.shoot();
    this.addFloatingText('SPECIAL ROCKET', this.player.x, this.player.y - 62, '#b38cff');
    if (this.isMultiplayer()) {
      this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.SYNC_STATE, nowPayload({
        specialUsed: {
          playerId: this.multiplayer.localPlayerId,
          x: this.player.x,
          y: this.player.y,
          targetX: target.x,
          targetY: target.y,
          radius: rocket.radius,
          damage,
          level: this.levelManager.level,
        },
      }));
    }
  }

  specialTarget() {
    const living = this.enemies.filter((enemy) => !enemy.dead && distance(enemy, this.player) < 900);
    if (!living.length) return null;
    return living
      .map((enemy) => ({
        x: enemy.x,
        y: enemy.y,
        score: living.reduce((sum, other) => sum + (distance(enemy, other) < 170 ? 1 : 0), 0) * 1000 - distance(enemy, this.player),
      }))
      .sort((a, b) => b.score - a.score)[0];
  }

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;
    if (this.input.pausePressed && this.state !== GAME_STATE.START && this.state !== GAME_STATE.GAME_OVER) {
      this.setState(this.state === GAME_STATE.PLAYING ? GAME_STATE.PAUSED : GAME_STATE.PLAYING);
    }
    if (this.input.audioPressed) this.toggleAudio();
    if (this.input.shopPressed && this.state === GAME_STATE.PLAYING) this.openShop();
    if (this.input.specialPressed && this.state === GAME_STATE.PLAYING) this.useSpecial();
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
        theme: this.theme?.id,
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
    if (!this.revive.isDowned) this.player.update(dt, this.input, aimWorld, this.world);
    this.special.update(dt);
    this.specialRipples.forEach((ripple) => {
      ripple.life -= dt;
      ripple.radius += dt * 520;
    });
    this.updateSpecialRockets(dt);
    this.multiplayer.updateRemotePlayers(dt);
    this.camera.follow(this.player, dt);

    if (!this.revive.isDowned && (this.input.mouse.down || this.input.mouse.pressed || this.input.isMobileShooting()) && this.player.canShoot()) {
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
    this.updateTowers(dt);
    this.pickups.forEach((pickup) => pickup.update(dt));
    this.particles.forEach((particle) => particle.update(dt));
    this.floaters.forEach((text) => text.update(dt));
    this.handleHits();
    this.handleRevive(dt);
    this.cleanup();
    this.syncBossMusic();
    this.syncMultiplayer();

    if (this.player.health <= 0 && !this.revive.isDowned) {
      if (this.canUseCoopRevive()) {
        this.startCoopRevive();
        return;
      }
      this.setState(GAME_STATE.GAME_OVER);
      this.saveMultiplayerResult(false);
    }
  }

  firePlayer(mouseWorld) {
    const weapon = this.effectiveWeapon(this.weaponManager.current());
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
    this.audio.shoot();
    if (this.isMultiplayer()) this.sendShootEvent(mouseWorld, weapon, specs);
  }

  spawnBullet(spec) {
    this.bullets.push(new Bullet(spec));
  }

  effectiveWeapon(weapon) {
    return {
      ...weapon,
      damage: weapon.damage + this.levelManager.damageBonus(),
      fireDelay: weapon.fireDelay,
    };
  }

  sendShootEvent(aimWorld, weapon, specs = []) {
    const angle = Math.atan2(aimWorld.y - this.player.y, aimWorld.x - this.player.x);
    this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.PLAYER_SHOOT, nowPayload({
      x: this.player.x,
      y: this.player.y,
      angle,
      weaponType: weapon.id,
      damage: weapon.damage,
      bulletId: crypto.randomUUID(),
      bullets: specs.map((spec) => ({
        x: spec.x,
        y: spec.y,
        sourceX: spec.sourceX,
        sourceY: spec.sourceY,
        vx: spec.vx,
        vy: spec.vy,
        r: spec.r,
        damage: spec.damage,
        weaponType: spec.weaponType,
        color: spec.color,
        area: spec.area || 0,
      })),
    }));
  }

  spawnRemoteShot(event) {
    if (event.player_id === this.multiplayer.localPlayerId) return;
    const payload = event.payload || {};
    if (Array.isArray(payload.bullets) && payload.bullets.length) {
      payload.bullets.forEach((spec) => this.spawnBullet({
        x: Number(spec.x),
        y: Number(spec.y),
        sourceX: Number(spec.sourceX ?? payload.x),
        sourceY: Number(spec.sourceY ?? payload.y),
        vx: Number(spec.vx),
        vy: Number(spec.vy),
        r: Number(spec.r || 5),
        damage: Number(spec.damage || payload.damage || 1),
        friendly: true,
        ownerId: event.player_id,
        bulletId: payload.bulletId,
        weaponType: spec.weaponType || payload.weaponType || 'pistol',
        color: spec.color,
        area: Number(spec.area || 0),
      }));
      this.audio.shoot();
      return;
    }
    const weapon = getWeapon(payload.weaponType || 'pistol');
    const dir = { x: Math.cos(payload.angle || 0), y: Math.sin(payload.angle || 0) };
    for (let i = 0; i < weapon.pellets; i++) {
      const offset = weapon.pellets === 1 ? 0 : -weapon.spread / 2 + (weapon.spread / (weapon.pellets - 1)) * i;
      const angle = (payload.angle || 0) + offset;
      this.spawnBullet({
        x: Number(payload.x) + dir.x * 24,
        y: Number(payload.y) + dir.y * 24,
        sourceX: Number(payload.x),
        sourceY: Number(payload.y),
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
    this.audio.shoot();
  }

  applyRemotePickup(event) {
    if (event.player_id === this.multiplayer.localPlayerId) return;
    const payload = event.payload || {};
    const pickup = this.pickups.find((item) => item.id === payload.pickupId);
    if (!pickup) return;
    pickup.dead = true;
    this.burst(pickup.x, pickup.y, pickup.color, 8);
    const remote = this.multiplayer.remotePlayers.get(payload.playerId || event.player_id);
    if (remote) {
      const label = payload.pickupType === 'health'
        ? '+HP'
        : ABILITIES[payload.pickupType]?.label || 'Pickup';
      this.addFloatingText(label, remote.x, remote.y - 42, payload.pickupType === 'health' ? '#7bed9f' : ABILITIES[payload.pickupType]?.color || '#ffd166');
    }
    this.audio.pickup();
  }

  applyRemoteTower(event) {
    const data = event.payload?.tower;
    if (!data || this.towers.some((tower) => tower.id === data.id)) return;
    this.towers.push(this.createTower(data));
    if (event.player_id !== this.multiplayer.localPlayerId) {
      this.addFloatingText('Tower deployed', Number(data.x), Number(data.y) - 52, getTowerTier(data.tierId).color);
    }
  }

  handleNetworkEvent(event) {
    if (!this.isMultiplayer() || !this.multiplayer.markEventSeen(event.id)) return;
    if (event.event_type === NETWORK_EVENTS.PLAYER_SHOOT) this.spawnRemoteShot(event);
    if (event.event_type === NETWORK_EVENTS.PICKUP_COLLECTED) this.applyRemotePickup(event);
    if (event.event_type === NETWORK_EVENTS.TOWER_PLACED) this.applyRemoteTower(event);
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
      if (event.payload?.playerEconomy || event.payload?.reviveState || event.payload?.specialUsed) this.applySyncState(event.payload);
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

  handleStateSnapshot(snapshot = {}) {
    if (!this.isMultiplayer()) return;
    if (snapshot.room) this.handleRoomChange(snapshot.room);
    if (snapshot.players) this.multiplayer.applyPlayers(snapshot.players);
    if (snapshot.state && !this.multiplayer.isHost) this.applySyncState(snapshot.state);
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
        armor: Math.max(0, Math.ceil(this.player.armor || 0)),
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
      mapId: this.mapId,
      mapName: this.mapManager.current?.name || 'Abandoned City',
      spawnQueue: this.spawnQueue,
      theme: this.theme?.id || 'city',
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
      towers: this.towers.map((tower) => tower.serialize()),
    };
  }

  applySyncState(payload = {}) {
    if (payload.playerEconomy) {
      this.multiplayer.applyEconomy?.(payload.playerEconomy);
      return;
    }
    if (payload.reviveState) {
      this.multiplayer.applyReviveState?.(payload.reviveState);
      return;
    }
    if (payload.specialUsed) {
      const special = payload.specialUsed;
      if (special.playerId !== this.multiplayer.localPlayerId) {
        this.specialRockets.push({
          x: special.x,
          y: special.y,
          targetX: special.targetX,
          targetY: special.targetY,
          damage: special.damage,
          radius: special.radius,
          speed: 680,
          trail: [],
          visualOnly: true,
        });
      }
      return;
    }
    this.wave = payload.wave || this.wave;
    if (payload.theme) this.setTheme(payload.theme);
    this.roomMode = payload.mode || this.roomMode;
    this.difficultyId = payload.difficulty || this.difficultyId;
    if (payload.mapId && payload.mapId !== this.mapId) {
      this.mapId = payload.mapId;
      const selectedMap = this.mapManager.setMap(this.mapId);
      this.world = new World(selectedMap.id);
      this.world.setTheme(selectedMap.theme);
    }
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
    this.towers = (payload.towers || []).map((data) => {
      const existing = this.towers.find((tower) => tower.id === data.id);
      const tower = existing || this.createTower(data);
      tower.x = Number(data.x);
      tower.y = Number(data.y);
      tower.health = Number(data.health);
      tower.maxHealth = Number(data.maxHealth || tower.maxHealth);
      tower.angle = Number(data.angle || tower.angle || 0);
      tower.cooldown = Number(data.cooldown || tower.cooldown || 0);
      tower.dead = tower.health <= 0;
      return tower;
    });
  }

  nearestLivingPlayer(from) {
    const candidates = [{ ...this.player, isLocal: true }];
    if (this.isMultiplayer()) {
      for (const remote of this.multiplayer.remotePlayers.values()) {
        if (remote.isConnected && remote.health > 0) candidates.push({ ...remote, isLocal: false });
      }
    }
    for (const tower of this.towers) {
      if (!tower.dead && tower.health > 0) candidates.push({ ...tower, isLocal: false, isTower: true, towerRef: tower });
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

    this.enemies.push(this.createEnemy(x, y, this.chooseZombieType()));
    this.syncBossMusic();
  }

  createEnemy(x, y, typeId) {
    const type = getZombieType(typeId);
    const enemy = type.kind === 'rival'
      ? new Rival(x, y, this.wave, type.id, this.difficulty())
      : new Zombie(x, y, this.wave, type.id, this.difficulty());
    enemy.id = crypto.randomUUID();
    return enemy;
  }

  spawnEnemyNear(x, y, typeId = 'normal') {
    const angle = rand(0, Math.PI * 2);
    const distanceFromSource = rand(58, 118);
    let spawnX = Math.max(48, Math.min(WORLD.width - 48, x + Math.cos(angle) * distanceFromSource));
    let spawnY = Math.max(48, Math.min(WORLD.height - 48, y + Math.sin(angle) * distanceFromSource));
    const radius = getZombieType(typeId).radius || 16;
    if (isBlocked(spawnX, spawnY, radius, this.world)) {
      spawnX = Math.max(48, Math.min(WORLD.width - 48, x));
      spawnY = Math.max(48, Math.min(WORLD.height - 48, y));
    }
    this.enemies.push(this.createEnemy(spawnX, spawnY, typeId));
  }

  chooseZombieType() {
    const difficulty = this.difficulty();
    if (this.wave > 0 && this.wave % difficulty.bossEvery === 0 && !this.bossSpawnedThisWave) {
      this.bossSpawnedThisWave = true;
      const bossPool = zombieTypesFor({ wave: this.wave, theme: this.theme?.id, boss: true });
      return bossPool[Math.floor(rand(0, bossPool.length))]?.id || 'boss';
    }
    if (this.wave < difficulty.specialWave) return chance(0.7) ? 'normal' : 'walker';
    const pool = zombieTypesFor({ wave: this.wave, theme: this.theme?.id, boss: false });
    if (!pool.length) return 'normal';
    const roll = Math.random();
    const ranged = pool.filter((type) => type.kind === 'rival');
    const heavy = pool.filter((type) => ['tank', 'shield', 'giant', 'heavyBrute', 'armored'].includes(type.id) || type.behavior === 'tank');
    const quick = pool.filter((type) => ['runner', 'fast', 'dodger', 'charger', 'leaper', 'swarm'].includes(type.id) || ['dodger', 'charger', 'swarm'].includes(type.behavior));
    const basic = pool.filter((type) => !ranged.includes(type) && !heavy.includes(type) && !quick.includes(type));
    const bias = this.mapManager.current?.zombieBias || {};
    const rangedChance = Math.max(0.04, (this.difficultyId === 'hard' ? 0.24 : this.difficultyId === 'easy' ? 0.12 : 0.18) + (bias.ranged || 0));
    const heavyChance = Math.max(0.04, (this.difficultyId === 'hard' ? 0.2 : this.difficultyId === 'easy' ? 0.1 : 0.15) + (bias.heavy || 0));
    if (ranged.length && roll < rangedChance) return ranged[Math.floor(rand(0, ranged.length))].id;
    if (heavy.length && roll < rangedChance + heavyChance) return heavy[Math.floor(rand(0, heavy.length))].id;
    if (quick.length && roll < 0.68 + (bias.quick || 0)) return quick[Math.floor(rand(0, quick.length))].id;
    return (basic.length ? basic : pool)[Math.floor(rand(0, (basic.length ? basic : pool).length))].id;
  }

  nextWave() {
    if (this.wave > 0) this.award({ score: 50, money: 30, label: 'Wave clear' });
    this.wave += 1;
    this.bossSpawnedThisWave = false;
    const previousTheme = this.theme?.id;
    this.setTheme(this.mapId === 'city' ? themeForWave(this.wave).id : this.mapManager.current?.theme?.id);
    this.spawnQueue = Math.max(3, Math.round((5 + this.wave * 3 * this.difficulty().waveScale) * this.difficulty().spawnMultiplier));
    this.spawnTimer = 0.8;
    const themeChanged = previousTheme && previousTheme !== this.theme.id;
    this.addFloatingText(themeChanged ? `Wave ${this.wave}: ${this.theme.label}` : `Wave ${this.wave}`, this.player.x, this.player.y - 60, '#ffd166');
    this.syncBossMusic();
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

  setTheme(themeId) {
    this.theme = THEMES.find((theme) => theme.id === themeId) || themeForWave(this.wave || 1);
    this.world?.setTheme(this.theme);
  }

  hasBoss() {
    return this.enemies.some((enemy) => !enemy.dead && enemy.isBoss);
  }

  syncBossMusic() {
    this.audio.setMusic(this.theme?.music, this.hasBoss());
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
          const damage = this.damageForHit(bullet, enemy);
          enemy.damage(damage);
          bullet.dead = true;
          this.burst(bullet.x, bullet.y, '#ffe66d', 5);
          this.addFloatingText(`-${damage}`, enemy.x, enemy.y - 20, '#fff6d1');
          this.addSpecialChargeForHit(bullet, enemy);
          if (this.isMultiplayer() && this.multiplayer.isHost) {
            this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.ZOMBIE_HIT, nowPayload({
              zombieId: enemy.id,
              damage,
              shooterPlayerId: bullet.ownerId || this.multiplayer.localPlayerId,
            }));
          }
          if (enemy.dead) this.killEnemy(enemy, bullet.ownerId);
          break;
        }
      } else if (this.hitTowerWithEnemyBullet(bullet)) {
        continue;
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

  hitTowerWithEnemyBullet(bullet) {
    if (bullet.friendly) return false;
    const tower = this.towers.find((candidate) => !candidate.dead && distance(bullet, candidate) < bullet.r + candidate.r);
    if (!tower) return false;
    bullet.dead = true;
    tower.damage(bullet.damage);
    this.burst(bullet.x, bullet.y, tower.color, 5);
    this.addFloatingText(`-${bullet.damage}`, tower.x, tower.y - 36, '#9ee7ff');
    return true;
  }

  updateTowers(dt) {
    for (const tower of this.towers) {
      if (tower.dead) continue;
      if (!this.isMultiplayer() || this.multiplayer.isHost) tower.update(dt, this);
      else tower.updateBase(dt);
    }
  }

  addSpecialChargeForHit(bullet, enemy) {
    if (bullet.weaponType === 'shotgun') this.special.addCharge(0.01);
    else if (bullet.weaponType === 'rocket') this.special.addCharge(0.08);
    else this.special.addCharge(enemy.typeId?.includes('boss') || enemy.isBoss ? 0.02 : 0.03);
  }

  damageForHit(bullet, target) {
    if (bullet.weaponType !== 'shotgun') return bullet.damage;
    const origin = { x: bullet.sourceX ?? this.player.x, y: bullet.sourceY ?? this.player.y };
    const range = distance(origin, target);
    const multiplier = range <= 120 ? 1 : range <= 250 ? 0.7 : range <= 400 ? 0.45 : 0.25;
    return Math.max(1, Math.round(bullet.damage * multiplier));
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

  canUseCoopRevive() {
    return this.isMultiplayer() && this.roomMode === 'coop' && this.hasLivingRemotePlayer();
  }

  hasLivingRemotePlayer() {
    return [...this.multiplayer.remotePlayers.values()].some((player) => player.isConnected && !player.isDowned && player.health > 0);
  }

  startCoopRevive() {
    this.player.health = 0;
    const delay = this.revive.down();
    this.addFloatingText(`Reviving in ${Math.ceil(delay)}`, this.player.x, this.player.y - 62, '#9ee7ff');
    this.syncReviveState();
  }

  handleRevive(dt) {
    if (!this.revive.isDowned) return;
    if (!this.hasLivingRemotePlayer()) {
      this.endMessage = 'Co-op run ended. Both players are down.';
      this.setState(GAME_STATE.GAME_OVER);
      this.saveMultiplayerResult(false);
      return;
    }
    if (this.revive.update(dt)) {
      this.revive.revive();
      this.player.health = Math.ceil(this.player.maxHealth * 0.5);
      this.weaponManager.resetToPistol();
      this.addFloatingText('REVIVED! 50% HP', this.player.x, this.player.y - 62, '#7bed9f');
      this.audio.pickup();
      this.syncReviveState();
      this.broadcastEconomy();
    }
  }

  syncReviveState() {
    if (!this.isMultiplayer()) return;
    this.roomManager.insertEvent(this.multiplayer.room.id, NETWORK_EVENTS.SYNC_STATE, nowPayload({
      reviveState: {
        playerId: this.multiplayer.localPlayerId,
        isDowned: this.revive.isDowned,
        reviveTimer: this.revive.timer,
        deathCount: this.revive.deathCount,
        health: Math.ceil(this.player.health),
      },
    }));
  }

  killEnemy(enemy, ownerId = null) {
    const reward = enemy.reward || (enemy.kind === 'rival' ? 90 : 45);
    const moneyReward = enemy.moneyReward || Math.max(1, Math.round(reward / 2));
    const localKill = !this.isMultiplayer() || !ownerId || ownerId === this.multiplayer.localPlayerId;
    if (localKill) {
      this.award({ score: reward, money: moneyReward, label: enemy.label || 'Kill' });
      this.zombiesKilled += 1;
      this.special.addCharge(enemy.isBoss || enemy.typeId?.includes('boss') ? 0.15 : 0.05);
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
    this.towers = this.towers.filter((tower) => !tower.dead);
    this.pickups = this.pickups.filter((pickup) => !pickup.dead);
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.floaters = this.floaters.filter((text) => text.life > 0);
    this.specialRipples = this.specialRipples.filter((ripple) => ripple.life > 0 && ripple.radius < ripple.maxRadius);
    this.specialRockets = this.specialRockets.filter((rocket) => !rocket.dead);
  }

  updateSpecialRockets(dt) {
    for (const rocket of this.specialRockets) {
      rocket.trail.push({ x: rocket.x, y: rocket.y, life: 0.22 });
      rocket.trail.forEach((dot) => (dot.life -= dt));
      rocket.trail = rocket.trail.filter((dot) => dot.life > 0);
      const dx = rocket.targetX - rocket.x;
      const dy = rocket.targetY - rocket.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        this.explodeSpecialRocket(rocket);
        continue;
      }
      const step = Math.min(dist, rocket.speed * dt);
      rocket.x += (dx / (dist || 1)) * step;
      rocket.y += (dy / (dist || 1)) * step;
    }
  }

  explodeSpecialRocket(rocket) {
    rocket.dead = true;
    this.specialRipples.push({ x: rocket.x, y: rocket.y, radius: 12, maxRadius: rocket.radius, life: 0.42 });
    this.burst(rocket.x, rocket.y, '#b38cff', 18);
    this.camera.addShake(9, 0.18);
    this.audio.hit();
    if (rocket.visualOnly) return;
    for (const enemy of this.enemies) {
      if (enemy.dead || distance(enemy, rocket) > rocket.radius + enemy.r) continue;
      enemy.damage(rocket.damage);
      enemy.flash = 0.25;
      this.addFloatingText(`-${rocket.damage}`, enemy.x, enemy.y - 20, '#b38cff');
      if (enemy.dead) this.killEnemy(enemy);
    }
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
    this.towers.forEach((tower) => drawTower(this.ctx, tower));
    this.bullets.forEach((bullet) => drawBullet(this.ctx, bullet));
    this.enemies
      .slice()
      .sort((a, b) => a.y - b.y)
      .forEach((enemy) => (enemy.kind === 'rival' ? drawRival(this.ctx, enemy) : drawZombie(this.ctx, enemy)));
    if (this.isMultiplayer()) {
      for (const remote of this.multiplayer.remotePlayers.values()) {
        if (!remote.isConnected) continue;
        drawPlayer(this.ctx, remote, {
          name: remote.isDowned ? `${remote.playerName} DOWN` : remote.playerName,
          shirt: remote.playerSlot === 1 ? '#4cc9a7' : '#57b8ff',
          glow: remote.playerSlot === 1 ? '#4cc9a7' : '#57b8ff',
          labelColor: remote.playerSlot === 1 ? '#9ff3d8' : '#9ee7ff',
          downed: remote.isDowned,
        });
      }
    }
    drawPlayer(this.ctx, this.player, this.isMultiplayer()
      ? {
          name: this.revive.isDowned ? `Reviving ${Math.ceil(this.revive.timer)}s` : `${this.multiplayer.localPlayerName} (You)`,
          shirt: this.multiplayer.localSlot === 1 ? '#4cc9a7' : '#57b8ff',
          glow: '#ffd166',
          labelColor: '#fff6d1',
          downed: this.revive.isDowned,
        }
      : {});
    this.drawSpecialRockets();
    this.drawSpecialRipples();
    this.particles.forEach((particle) => particle.draw(this.ctx));
    this.floaters.forEach((text) => text.draw(this.ctx));
    this.ctx.restore();
    this.drawVignette();
    this.drawBossBar();
    if (this.state === GAME_STATE.PLAYING) this.drawMinimap();
  }

  drawMinimap() {
    const width = 156;
    const height = 104;
    const x = this.canvas.width - width - 14;
    const y = 74;
    const sx = width / this.world.width;
    const sy = height / this.world.height;
    const dot = (entity, color, size = 3) => {
      const px = x + entity.x * sx;
      const py = y + entity.y * sy;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(px - size / 2, py - size / 2, size, size);
    };

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(10, 15, 19, 0.76)';
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeStyle = '#53606b';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (const road of this.world.roads || []) {
      this.ctx.fillRect(x + road.x * sx, y + road.y * sy, road.w * sx, road.h * sy);
    }
    for (const enemy of this.enemies) {
      if (!enemy.dead) dot(enemy, '#ef476f', enemy.isBoss ? 5 : 3);
    }
    for (const tower of this.towers) {
      if (!tower.dead) dot(tower, '#9ee7ff', 4);
    }
    if (this.isMultiplayer()) {
      for (const remote of this.multiplayer.remotePlayers.values()) {
        if (remote.isConnected && remote.health > 0) dot(remote, '#4cc9a7', 5);
      }
    }
    dot(this.player, '#ffd166', 5);
    this.ctx.fillStyle = '#fff6d1';
    this.ctx.font = '9px monospace';
    this.ctx.fillText('MAP', x + 6, y + 12);
    this.ctx.restore();
  }

  drawBossBar() {
    const boss = this.enemies.find((enemy) => !enemy.dead && enemy.isBoss);
    if (!boss) return;
    const width = 360;
    const height = 14;
    const x = (this.canvas.width - width) / 2;
    const y = this.canvas.height - 30;
    const percent = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(11, 16, 20, 0.82)';
    this.ctx.fillRect(x - 4, y - 14, width + 8, height + 22);
    this.ctx.strokeStyle = '#2f3c45';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x - 4, y - 14, width + 8, height + 22);
    this.ctx.fillStyle = '#fff6d1';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(boss.label || 'Boss', x, y - 4);
    this.ctx.fillStyle = '#2a1724';
    this.ctx.fillRect(x, y, width, height);
    this.ctx.fillStyle = '#ef476f';
    this.ctx.fillRect(x, y, width * percent, height);
    this.ctx.strokeStyle = '#111820';
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.restore();
  }

  drawSpecialRipples() {
    for (const ripple of this.specialRipples) {
      const alpha = Math.max(0, ripple.life / 0.48);
      this.ctx.save();
      this.ctx.strokeStyle = `rgba(179, 140, 255, ${alpha})`;
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawSpecialRockets() {
    for (const rocket of this.specialRockets) {
      this.ctx.save();
      for (const dot of rocket.trail) {
        this.ctx.globalAlpha = Math.max(0, dot.life / 0.22) * 0.7;
        this.ctx.fillStyle = '#ffd166';
        this.ctx.fillRect(dot.x - 3, dot.y - 3, 6, 6);
      }
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = '#b38cff';
      this.ctx.fillRect(rocket.x - 6, rocket.y - 4, 12, 8);
      this.ctx.fillStyle = '#fff6d1';
      this.ctx.fillRect(rocket.x + 2, rocket.y - 2, 5, 4);
      this.ctx.restore();
    }
  }

  drawVignette() {
    const gradient = this.ctx.createRadialGradient(480, 270, 80, 480, 270, 560);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
