// Shared chrome for game views. Each game module calls `createShell(el, game)`
// once to get a consistent header (back button, title, meta, reset button) and
// a stage container it can fill. Keeping this in one place means every game
// automatically gets the same polished, responsive frame.

import { openNameEditor } from './player-names.js';
import { room } from './multiplayer.js';
import { GAME_HELP, openGameHelp } from './game-help.js';

export function createShell(container, game, { title, meta, resetLabel = 'Reset' } = {}) {
  const shell = document.createElement('div');
  shell.className = 'game-shell';
  shell.style.setProperty('--accent', game.color);
  shell.innerHTML = `
    <div class="game-head">
      <button class="back-btn" type="button" data-nav="back">← Back to games</button>
      <div class="game-head-center">
        <h2 class="game-title">${title || game.name}</h2>
        ${meta ? `<p class="game-meta">${meta}</p>` : ''}
      </div>
      <button class="reset-btn" type="button" data-action="reset">${resetLabel}</button>
    </div>
    <div class="game-stage"></div>`;

  container.appendChild(shell);
  if (GAME_HELP[game.id]) {
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'game-help-btn';
    help.textContent = 'ⓘ How to play';
    help.addEventListener('click', () => openGameHelp(game.id));
    shell.querySelector('.game-head-center').appendChild(help);
  }
  if (game.players?.max > 1 && room.activeGame?.id !== game.id) {
    const names = document.createElement('button');
    names.type = 'button';
    names.className = 'game-names-btn';
    names.textContent = '✎ Player names';
    names.addEventListener('click', () => openNameEditor(game.players.max));
    shell.querySelector('.game-head-center').appendChild(names);
  }
  return {
    root: shell,
    stage: shell.querySelector('.game-stage'),
    getBackButton: () => shell.querySelector('[data-nav="back"]'),
    getResetButton: () => shell.querySelector('[data-action="reset"]'),
  };
}

// Wire the back button to the router's navigate(null).
// Accepts either the shell object returned by createShell() or a raw element.
export function wireBack(shell, navigate) {
  const root = shell instanceof Element ? shell : shell.root;
  const btn = root.querySelector('[data-nav="back"]');
  if (btn) btn.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(null);
  });
}

// Reusable pre-game setup step. Every game can call this to gather choices
// (mode, player count, difficulty, ...) before the board renders — a small,
// generic "wizard" so new games get a consistent way to ask questions without
// each one hand-rolling its own picker wiring. Visual skin is left to the
// caller via `themeClass` + each game's own CSS, so games still get their own
// vibe; only the interaction plumbing is shared.
//
// fields: [{ key, label, options: [{ value, label }], default }]
// Returns a Promise that resolves with { [key]: value } when the user starts.
export function renderSetup(stage, { title, subtitle, fields, startLabel = 'Start', themeClass = '' } = {}) {
  return new Promise((resolve) => {
    const values = {};
    for (const f of fields) values[f.key] = f.default ?? f.options[0].value;

    const card = document.createElement('div');
    card.className = `setup-card${themeClass ? ' ' + themeClass : ''}`;
    card.innerHTML = `
      ${title ? `<h3 class="setup-title">${title}</h3>` : ''}
      ${subtitle ? `<p class="setup-subtitle">${subtitle}</p>` : ''}
      <div class="setup-fields"></div>
      <button class="setup-start-btn" type="button">${startLabel}</button>`;
    stage.appendChild(card);

    const fieldsEl = card.querySelector('.setup-fields');

    function renderFields() {
      fieldsEl.innerHTML = '';
      for (const f of fields) {
        const group = document.createElement('div');
        group.className = 'setup-field';
        group.innerHTML = `<span class="setup-field-label">${f.label}</span>
          <div class="setup-options" role="group" aria-label="${f.label}"></div>`;
        const optionsEl = group.querySelector('.setup-options');
        for (const opt of f.options) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'setup-option' + (values[f.key] === opt.value ? ' active' : '');
          btn.textContent = opt.label;
          btn.addEventListener('click', () => {
            values[f.key] = opt.value;
            window.arcadeAudio?.prepare();
            window.arcadeAudio?.tap();
            window.haptics?.select();
            renderFields();
          });
          optionsEl.appendChild(btn);
        }
        fieldsEl.appendChild(group);
      }
    }

    renderFields();

    card.querySelector('.setup-start-btn').addEventListener('click', () => {
      window.arcadeAudio?.prepare();
      window.arcadeAudio?.chime();
      window.haptics?.medium();
      card.remove();
      resolve(values);
    });
  });
}
