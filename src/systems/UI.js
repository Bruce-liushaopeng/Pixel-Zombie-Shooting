import { ABILITIES, GAME_STATE } from '../game/constants.js';

export class UI {
  constructor(hud, overlay) {
    this.hud = hud;
    this.overlay = overlay;
    this.lastHud = '';
    this.onStart = () => {};
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

    const markup = `
      <div class="hud-row">
        <div class="meter"><span style="width:${healthPercent}%"></span><p>HP ${Math.ceil(game.player.health)}/${game.player.maxHealth}</p></div>
        <div class="stat">Score <b>${game.score}</b></div>
        <div class="stat">Wave <b>${game.wave}</b></div>
        <div class="cooldown"><span style="transform:scaleX(${cooldown})"></span><p>Fire</p></div>
      </div>
      <div class="ability-row">${abilityTags || '<span class="empty-abilities">No active abilities</span>'}</div>
    `;
    if (markup !== this.lastHud) {
      this.hud.innerHTML = markup;
      this.lastHud = markup;
    }
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
}
