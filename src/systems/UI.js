import { ABILITIES, GAME_STATE } from '../game/constants.js';
import { MAPS } from '../game/MapDefinitions.js';

export class UI {
  constructor(hud, overlay) {
    this.hud = hud;
    this.overlay = overlay;
    this.lastHud = '';
    this.onStart = () => {};
    this.onMultiplayer = () => {};
    this.onMapSelected = () => {};
    this.onJoinRoom = () => {};
    this.onLeaveRoom = () => {};
    this.onOpenShop = () => {};
    this.onCloseShop = () => {};
    this.onBuyWeapon = () => {};
    this.onBuyHealth = () => {};
    this.onBuyArmor = () => {};
    this.onBuyUpgrade = () => {};
    this.onSpecial = () => {};
    this.onAudioToggle = () => {};
    this.onRestart = () => {};
    this.onResume = () => {};
  }

  renderHud(game) {
    if (game.state !== GAME_STATE.PLAYING) {
      if (this.lastHud) {
        this.hud.innerHTML = '';
        this.lastHud = '';
      }
      return;
    }
    const healthPercent = Math.max(0, game.player.health / game.player.maxHealth) * 100;
    const level = game.levelManager?.progress(game.score) || { level: 1, earned: 0, next: 100, percent: 0 };
    const specialPercent = game.special?.percent() ?? 0;
    const specialLabel = game.special?.canUse() ? 'READY' : `${specialPercent}%`;
    const abilityTags = [...game.player.abilities.entries()]
      .map(([key, time]) => {
        const ability = ABILITIES[key];
        return `<span class="ability" style="--ability:${ability.color}"><b>${ability.icon}</b>${ability.label} ${time.toFixed(0)}s</span>`;
      })
      .join('');

    const multiplayer = game.isMultiplayer?.()
      ? this.renderMultiplayerHud(game)
      : '';
    const downed = game.revive?.isDowned
      ? `<div class="downed-banner"><b>Reviving in ${Math.ceil(game.revive.timer)}s</b><span>Return with 50% HP and pistol. Money stays.</span></div>`
      : '';

    const markup = `
      <div class="hud-row">
        <div class="hud-group hud-left">
          <div class="meter"><span style="width:${healthPercent}%"></span><p>HP ${Math.ceil(game.player.health)}/${game.player.maxHealth}</p></div>
          ${game.player.armor > 0 ? `<div class="stat stat-armor">Armor <b>${Math.ceil(game.player.armor)}</b></div>` : ''}
          <div class="stat stat-level">Lv <b>${level.level}</b> <span>${game.score}/${level.next}</span></div>
        </div>
        <div class="hud-group hud-center">
          <div class="stat stat-score">Score <b>${game.score}</b></div>
          <div class="stat stat-money">$<b>${game.money}</b></div>
        </div>
        <div class="hud-group hud-right">
          <div class="stat stat-weapon">${game.weaponManager?.current().name || 'Pistol'} <b>${game.weaponAmmoLabel?.() || '∞'}</b></div>
          <div class="stat stat-wave">W<b>${game.wave}</b></div>
          <button class="hud-button shop-button" type="button" data-action="shop">Shop</button>
          <button class="hud-button audio-button" type="button" data-action="audio-toggle">${game.audio?.enabled ? 'Mute' : 'Sound'}</button>
          ${game.isMultiplayer?.() ? '<button class="hud-button leave-button" type="button" data-action="leave-room">Leave</button>' : ''}
        </div>
        <button class="hud-button special-button ${game.special?.canUse() ? 'is-ready' : ''}" style="--charge:${specialPercent}%" type="button" data-action="special">${specialLabel}</button>
      </div>
      ${abilityTags ? `<div class="ability-row">${abilityTags}</div>` : ''}
      ${downed}
      ${multiplayer}
    `;
    if (markup !== this.lastHud) {
      this.hud.innerHTML = markup;
      const leaveButton = this.hud.querySelector('[data-action="leave-room"]');
      if (leaveButton) leaveButton.onclick = () => this.onLeaveRoom();
      const shopButton = this.hud.querySelector('[data-action="shop"]');
      if (shopButton) shopButton.onclick = () => this.onOpenShop();
      const audioButton = this.hud.querySelector('[data-action="audio-toggle"]');
      if (audioButton) audioButton.onclick = () => this.onAudioToggle();
      const specialButton = this.hud.querySelector('[data-action="special"]');
      if (specialButton) specialButton.onclick = () => this.onSpecial();
      this.lastHud = markup;
    }
  }

  renderMultiplayerHud(game) {
    const players = game.multiplayer.connectedPlayers();
    const rows = players
      .map((player) => {
        const isLocal = player.player_id === game.multiplayer.localPlayerId;
        const remote = game.multiplayer.remotePlayers.get(player.player_id);
        const health = isLocal ? game.player.health : remote?.health ?? player.health ?? 100;
        const armor = isLocal ? game.player.armor || 0 : remote?.armor ?? 0;
        const score = isLocal ? game.score : remote?.score ?? player.score ?? 0;
        const money = isLocal ? game.money : remote?.money ?? 0;
        const revive = isLocal && game.revive?.isDowned
          ? ` Revive ${Math.ceil(game.revive.timer)}s`
          : remote?.isDowned
            ? ` Down ${Math.ceil(remote.reviveTimer)}s`
            : '';
        return `<span class="player-stat player-${player.player_slot || 1}">${isLocal ? 'You' : player.player_name}: HP ${Math.ceil(health)}${armor ? ` AR ${Math.ceil(armor)}` : ''} Lv ${isLocal ? game.levelManager.level : remote?.level || 1} Score ${score} $${money}${revive}</span>`;
      })
      .join('');
    const status = game.multiplayer.statusMessage
      ? `<span class="connection-copy">${game.multiplayer.statusMessage}</span>`
      : '';
    return `<div class="multiplayer-hud">${rows}${status}</div>`;
  }

  renderOverlay(state, game) {
    if (state === GAME_STATE.PLAYING) {
      this.overlay.classList.remove('is-visible');
      this.overlay.innerHTML = '';
      return;
    }

    const copy = {
      [GAME_STATE.START]: {
        title: 'Pixel Outbreak Survivor',
        body: 'A top-down city survival shooter built with Vite, Canvas, and procedural pixel sprites.',
        button: 'Start Run',
      },
      [GAME_STATE.PAUSED]: {
        title: 'Paused',
        body: 'Catch your breath, reload your instincts, then step back into the block.',
        button: 'Resume',
      },
      [GAME_STATE.GAME_OVER]: {
        title: 'Run Ended',
        body: game.gameOverSummary?.() || game.endMessage || `Final score ${game.score}. You reached wave ${game.wave}.`,
        button: 'Restart',
      },
    }[state];

    this.overlay.classList.add('is-visible');
    if (state === GAME_STATE.START) {
      this.renderMainMenu(copy);
      return;
    }

    this.overlay.innerHTML = `
      <div class="menu">
        <p class="eyebrow">Canvas survival demo</p>
        <h1>${copy.title}</h1>
        <p>${copy.body}</p>
        <button class="pixel-button" type="button">${copy.button}</button>
      </div>
    `;
    this.overlay.querySelector('button').onclick = () => {
      if (state === GAME_STATE.START) this.onStart();
      if (state === GAME_STATE.PAUSED) this.onResume();
      if (state === GAME_STATE.GAME_OVER) this.onRestart();
    };
  }

  renderMainMenu(copy) {
    this.overlay.innerHTML = `
      <div class="menu">
        <p class="eyebrow">Canvas survival demo</p>
        <h1>${copy.title}</h1>
        <p>${copy.body}</p>
        <div class="menu-actions">
          ${this.renderDifficultySelector('medium')}
          <button class="pixel-button" type="button" data-action="single-player">Single Player</button>
          <button class="pixel-button secondary" type="button" data-action="coop">Multiplayer Co-op</button>
          <button class="pixel-button secondary" type="button" data-action="pvp">Multiplayer PvP</button>
        </div>
      </div>
    `;
    const selectedDifficulty = () => this.overlay.querySelector('input[name="difficulty"]:checked')?.value || 'medium';
    this.overlay.querySelector('[data-action="single-player"]').onclick = () => this.renderMapSelect({ mode: 'single', difficulty: selectedDifficulty() });
    this.overlay.querySelector('[data-action="coop"]').onclick = () => this.renderMapSelect({ mode: 'coop', difficulty: selectedDifficulty() });
    this.overlay.querySelector('[data-action="pvp"]').onclick = () => this.renderMapSelect({ mode: 'pvp', difficulty: selectedDifficulty() });
  }

  renderMapSelect({ mode = 'single', difficulty = 'medium', selectedMapId = 'city' } = {}) {
    this.overlay.classList.add('is-visible');
    const title = mode === 'single' ? 'Choose Map' : `${mode === 'pvp' ? 'PvP' : 'Co-op'} Map`;
    this.overlay.innerHTML = `
      <div class="menu map-menu">
        <p class="eyebrow">Deployment zone</p>
        <h1>${title}</h1>
        <p>Pick the battlefield before the run starts.</p>
        <div class="map-grid">
          ${MAPS.map((map) => `
            <button class="map-card ${map.id === selectedMapId ? 'is-selected' : ''}" type="button" data-map="${this.escape(map.id)}">
              <span class="map-preview" style="--c1:${map.preview[0]};--c2:${map.preview[1]};--c3:${map.preview[2]};--c4:${map.preview[3]}"></span>
              <b>${this.escape(map.name)}</b>
              <span>${this.escape(map.description)}</span>
              <em>${this.escape(map.flavor)}</em>
            </button>
          `).join('')}
        </div>
        <div class="menu-actions">
          <button class="pixel-button secondary" type="button" data-action="back">Back</button>
        </div>
      </div>
    `;
    this.overlay.querySelectorAll('[data-map]').forEach((button) => {
      button.onclick = () => this.onMapSelected({ mode, difficulty, mapId: button.dataset.map });
    });
    this.overlay.querySelector('[data-action="back"]').onclick = () => this.renderOverlay(GAME_STATE.START, { score: 0, wave: 0 });
  }

  renderMultiplayerMenu({ playerName = '', roomCode = '', mode = 'coop', difficulty = 'medium', mapId = 'city', error = '', status = '' } = {}) {
    const map = MAPS.find((candidate) => candidate.id === mapId) || MAPS[0];
    this.overlay.classList.add('is-visible');
    this.overlay.innerHTML = `
      <div class="menu multiplayer-menu">
        <p class="eyebrow">Socket.IO realtime</p>
        <h1>${mode === 'pvp' ? 'PvP Room' : 'Co-op Room'}</h1>
        <p>Join or create a two-player room. Mode: ${this.escape(mode.toUpperCase())}. Difficulty: ${this.escape(difficulty)}. Map: ${this.escape(map.name)}.</p>
        <form class="multiplayer-form">
          <input type="hidden" name="mode" value="${this.escape(mode)}" />
          <input type="hidden" name="difficulty" value="${this.escape(difficulty)}" />
          <input type="hidden" name="mapId" value="${this.escape(map.id)}" />
          <label>
            <span>Player name</span>
            <input name="playerName" maxlength="18" autocomplete="nickname" value="${this.escape(playerName)}" placeholder="Survivor" />
          </label>
          <label>
            <span>Room code</span>
            <input name="roomCode" maxlength="16" autocapitalize="characters" value="${this.escape(roomCode)}" placeholder="ZOMBIE-1" />
          </label>
          <div class="menu-actions">
            <button class="pixel-button" type="submit">Join / Create Room</button>
            <button class="pixel-button secondary" type="button" data-action="back">Back</button>
          </div>
        </form>
        ${status ? `<p class="status-copy">${this.escape(status)}</p>` : ''}
        ${error ? `<p class="error-copy">${this.escape(error)}</p>` : ''}
      </div>
    `;
    const form = this.overlay.querySelector('form');
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(form);
      this.onJoinRoom({
        playerName: data.get('playerName'),
        roomCode: data.get('roomCode'),
        mode: data.get('mode'),
        difficulty: data.get('difficulty'),
        mapId: data.get('mapId'),
      });
    };
    this.overlay.querySelector('[data-action="back"]').onclick = () => this.renderOverlay(GAME_STATE.START, { score: 0, wave: 0 });
  }

  renderWaitingRoom({ room, players = [], status = '', error = '' }) {
    const player1 = players.find((player) => player.player_slot === 1);
    const player2 = players.find((player) => player.player_slot === 2);
    this.overlay.classList.add('is-visible');
    this.overlay.innerHTML = `
      <div class="menu multiplayer-menu">
        <p class="eyebrow">Waiting room</p>
        <h1>${this.escape(room.room_code)}</h1>
        <p class="status-copy">Mode ${this.escape(room.game_state?.mode || 'coop')} / ${this.escape(room.game_state?.difficulty || 'medium')} / Map ${this.escape(room.game_state?.mapName || room.game_state?.mapId || 'city')}</p>
        <div class="room-list">
          <div class="room-player player-1"><b>Player 1</b><span>${this.escape(player1?.player_name || 'Open')}</span></div>
          <div class="room-player player-2"><b>Player 2</b><span>${this.escape(player2?.player_name || 'Waiting for second player...')}</span></div>
        </div>
        <p class="status-copy">${this.escape(status || 'Connected. The game starts automatically when two players are present.')}</p>
        ${error ? `<p class="error-copy">${this.escape(error)}</p>` : ''}
        <button class="pixel-button secondary" type="button" data-action="leave-room">Leave Room</button>
      </div>
    `;
    this.overlay.querySelector('[data-action="leave-room"]').onclick = () => this.onLeaveRoom();
  }

  renderShop(game, message = '', tab = 'weapons') {
    const weapons = game.weaponManager.list();
    const damageBonus = (game.levelManager?.damageBonus() || 0) + (game.player?.permanentDamageBonus || 0);
    const activeTab = ['weapons', 'health', 'abilities'].includes(tab) ? tab : 'weapons';
    const missingHp = Math.max(0, game.player.maxHealth - game.player.health);
    const missingArmor = Math.max(0, (game.player.maxArmor || 100) - (game.player.armor || 0));
    const healthItems = [
      { label: '+25 HP', amount: 25, cost: 55 },
      { label: '+50 HP', amount: 50, cost: 90 },
      { label: 'Full Heal', amount: game.player.maxHealth, cost: 135 },
    ];
    const armorItems = [
      { label: '+25 Armor', amount: 25, cost: 50 },
      { label: '+50 Armor', amount: 50, cost: 85 },
      { label: 'Full Armor', amount: game.player.maxArmor || 100, cost: 130 },
    ];
    const upgrades = [
      {
        id: 'damage',
        title: 'Damage Training',
        description: 'Permanently adds +1 bullet damage for this run. Capped so weapons stay balanced.',
        price: 200,
        level: game.abilityPurchases?.damage || 0,
        max: 8,
        current: `+${game.player?.permanentDamageBonus || 0} damage`,
      },
      {
        id: 'speed',
        title: 'Footwork Drill',
        description: 'Permanently increases movement speed by 4% for this run. Stacks up to +20%.',
        price: 200,
        level: game.abilityPurchases?.speed || 0,
        max: 5,
        current: `+${Math.round((game.player?.permanentSpeedBonus || 0) * 100)}% speed`,
      },
    ];
    this.overlay.classList.add('is-visible');
    this.overlay.innerHTML = `
      <div class="menu shop-menu">
        <button class="shop-close" type="button" data-action="close-shop" aria-label="Close shop">X</button>
        <p class="eyebrow">${game.isMultiplayer?.() ? 'Game continues while shopping' : 'Paused shop'}</p>
        <h1>Shop</h1>
        <p>Weapons cost money only. Current money: $${game.money}. Score is never spent.</p>
        <div class="shop-tabs" role="tablist" aria-label="Shop tabs">
          <button class="${activeTab === 'weapons' ? 'is-active' : ''}" type="button" data-shop-tab="weapons">Weapons</button>
          <button class="${activeTab === 'health' ? 'is-active' : ''}" type="button" data-shop-tab="health">HP Back</button>
          <button class="${activeTab === 'abilities' ? 'is-active' : ''}" type="button" data-shop-tab="abilities">Ability</button>
        </div>
        ${activeTab === 'weapons' ? `
          <div class="shop-grid">
            ${weapons.map((weapon) => `
              <article class="weapon-card ${weapon.equipped ? 'is-equipped' : ''}">
                <h2>${this.escape(weapon.name)}</h2>
                <p>${this.escape(weapon.description)}</p>
                <dl>
                  <div><dt>Price</dt><dd>${weapon.price}</dd></div>
                  <div><dt>Damage</dt><dd>${weapon.damage}${damageBonus ? ` +${damageBonus}` : ''}${weapon.pellets > 1 ? ` x${weapon.pellets}` : ''}</dd></div>
                  <div><dt>Fire</dt><dd>${Math.round(1000 / weapon.fireDelay)}/s</dd></div>
                  <div><dt>Ammo</dt><dd>${weapon.purchaseAmmo === Infinity ? '∞' : weapon.purchaseAmmo}</dd></div>
                </dl>
                <p class="ammo-copy">Owned: ${weapon.ownedAmmo === Infinity ? '∞' : weapon.ownedAmmo}</p>
                <button class="pixel-button ${game.money < weapon.price ? 'secondary' : ''}" type="button" data-weapon="${weapon.id}">
                  ${weapon.equipped ? 'Refill / Buy' : 'Buy / Equip'}
                </button>
              </article>
            `).join('')}
          </div>
        ` : activeTab === 'health' ? `
          <p class="shop-section-copy">HP is direct healing. Armor is a cheaper damage buffer and absorbs part of incoming hits before HP.</p>
          <div class="shop-grid health-grid">
            ${healthItems.map((item) => `
              <article class="weapon-card health-card">
                <h2>${this.escape(item.label)}</h2>
                <p>Recover HP during a run. Missing HP: ${Math.ceil(missingHp)}.</p>
                <dl>
                  <div><dt>Price</dt><dd>${item.cost}</dd></div>
                  <div><dt>Recover</dt><dd>${Math.min(item.amount, Math.ceil(missingHp))}</dd></div>
                </dl>
                <button class="pixel-button ${game.money < item.cost || missingHp <= 0 ? 'secondary' : ''}" type="button" data-health-amount="${item.amount}" data-health-cost="${item.cost}">
                  Buy HP
                </button>
              </article>
            `).join('')}
            ${armorItems.map((item) => `
              <article class="weapon-card armor-card">
                <h2>${this.escape(item.label)}</h2>
                <p>Add armor plating during a run. Current armor: ${Math.ceil(game.player.armor || 0)}/${game.player.maxArmor || 100}.</p>
                <dl>
                  <div><dt>Price</dt><dd>${item.cost}</dd></div>
                  <div><dt>Armor</dt><dd>${Math.min(item.amount, Math.ceil(missingArmor))}</dd></div>
                </dl>
                <button class="pixel-button ${game.money < item.cost || missingArmor <= 0 ? 'secondary' : ''}" type="button" data-armor-amount="${item.amount}" data-armor-cost="${item.cost}">
                  Buy Armor
                </button>
              </article>
            `).join('')}
          </div>
        ` : `
          <div class="shop-grid ability-upgrade-grid">
            ${upgrades.map((upgrade) => {
              const maxed = upgrade.level >= upgrade.max;
              return `
                <article class="weapon-card ability-upgrade-card ${maxed ? 'is-equipped' : ''}">
                  <h2>${this.escape(upgrade.title)}</h2>
                  <p>${this.escape(upgrade.description)}</p>
                  <dl>
                    <div><dt>Price</dt><dd>${upgrade.price}</dd></div>
                    <div><dt>Level</dt><dd>${upgrade.level}/${upgrade.max}</dd></div>
                    <div><dt>Current</dt><dd>${this.escape(upgrade.current)}</dd></div>
                    <div><dt>Type</dt><dd>Permanent</dd></div>
                  </dl>
                  <button class="pixel-button ${game.money < upgrade.price || maxed ? 'secondary' : ''}" type="button" data-upgrade="${upgrade.id}">
                    ${maxed ? 'Maxed' : 'Buy Upgrade'}
                  </button>
                </article>
              `;
            }).join('')}
          </div>
        `}
        ${message ? `<p class="${message.includes('Not enough') ? 'error-copy' : 'status-copy'}">${this.escape(message)}</p>` : ''}
        <button class="pixel-button secondary" type="button" data-action="close-shop">Close</button>
      </div>
    `;
    this.overlay.querySelectorAll('[data-shop-tab]').forEach((button) => {
      button.onclick = () => this.renderShop(game, '', button.dataset.shopTab);
    });
    this.overlay.querySelectorAll('[data-weapon]').forEach((button) => {
      button.onclick = () => this.onBuyWeapon(button.dataset.weapon);
    });
    this.overlay.querySelectorAll('[data-health-amount]').forEach((button) => {
      button.onclick = () => this.onBuyHealth(Number(button.dataset.healthAmount), Number(button.dataset.healthCost));
    });
    this.overlay.querySelectorAll('[data-armor-amount]').forEach((button) => {
      button.onclick = () => this.onBuyArmor(Number(button.dataset.armorAmount), Number(button.dataset.armorCost));
    });
    this.overlay.querySelectorAll('[data-upgrade]').forEach((button) => {
      button.onclick = () => this.onBuyUpgrade(button.dataset.upgrade);
    });
    this.overlay.querySelectorAll('[data-action="close-shop"]').forEach((button) => {
      button.onclick = () => this.onCloseShop();
    });
  }

  renderDifficultySelector(selected) {
    return `
      <div class="difficulty-selector" role="radiogroup" aria-label="Difficulty">
        ${['easy', 'medium', 'hard'].map((id) => `
          <label>
            <input type="radio" name="difficulty" value="${id}" ${id === selected ? 'checked' : ''} />
            <span>${id[0].toUpperCase()}${id.slice(1)}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
