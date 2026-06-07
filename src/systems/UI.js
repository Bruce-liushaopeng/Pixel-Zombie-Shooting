import { ABILITIES, GAME_STATE } from '../game/constants.js';

export class UI {
  constructor(hud, overlay) {
    this.hud = hud;
    this.overlay = overlay;
    this.lastHud = '';
    this.onStart = () => {};
    this.onMultiplayer = () => {};
    this.onJoinRoom = () => {};
    this.onLeaveRoom = () => {};
    this.onRestart = () => {};
    this.onResume = () => {};
  }

  renderHud(game) {
    const healthPercent = Math.max(0, game.player.health / game.player.maxHealth) * 100;
    const cooldown = Math.max(0, 1 - game.player.cooldown / game.player.fireDelay);
    const abilityTags = [...game.player.abilities.entries()]
      .map(([key, time]) => {
        const ability = ABILITIES[key];
        return `<span class="ability" style="--ability:${ability.color}"><b>${ability.icon}</b>${ability.label} ${time.toFixed(0)}s</span>`;
      })
      .join('');

    const multiplayer = game.isMultiplayer?.()
      ? this.renderMultiplayerHud(game)
      : '';

    const markup = `
      <div class="hud-row">
        <div class="meter"><span style="width:${healthPercent}%"></span><p>HP ${Math.ceil(game.player.health)}/${game.player.maxHealth}</p></div>
        <div class="stat">Score <b>${game.score}</b></div>
        <div class="stat">Wave <b>${game.wave}</b></div>
        <div class="cooldown"><span style="transform:scaleX(${cooldown})"></span><p>Fire</p></div>
        ${game.isMultiplayer?.() ? '<button class="hud-button" type="button" data-action="leave-room">Leave</button>' : ''}
      </div>
      <div class="ability-row">${abilityTags || '<span class="empty-abilities">No active abilities</span>'}</div>
      ${multiplayer}
    `;
    if (markup !== this.lastHud) {
      this.hud.innerHTML = markup;
      const leaveButton = this.hud.querySelector('[data-action="leave-room"]');
      if (leaveButton) leaveButton.onclick = () => this.onLeaveRoom();
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
        const score = isLocal ? game.score : remote?.score ?? player.score ?? 0;
        return `<span class="player-stat player-${player.player_slot || 1}">${isLocal ? 'You' : player.player_name}: HP ${Math.ceil(health)} Score ${score}</span>`;
      })
      .join('');
    return `<div class="multiplayer-hud">${rows}<span class="connection-copy">${game.multiplayer.statusMessage || 'Connected'}</span></div>`;
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
        body: `Final score ${game.score}. You reached wave ${game.wave}.`,
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
          <button class="pixel-button" type="button" data-action="single-player">Single Player</button>
          <button class="pixel-button secondary" type="button" data-action="multiplayer">Multiplayer</button>
        </div>
      </div>
    `;
    this.overlay.querySelector('[data-action="single-player"]').onclick = () => this.onStart();
    this.overlay.querySelector('[data-action="multiplayer"]').onclick = () => this.onMultiplayer();
  }

  renderMultiplayerMenu({ playerName = '', roomCode = '', error = '', status = '' } = {}) {
    this.overlay.classList.add('is-visible');
    this.overlay.innerHTML = `
      <div class="menu multiplayer-menu">
        <p class="eyebrow">Supabase realtime</p>
        <h1>Multiplayer</h1>
        <p>Join or create a two-player room. The first player hosts shared waves and zombie state.</p>
        <form class="multiplayer-form">
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

  escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
