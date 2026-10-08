// Shared chrome for game views. Each game module calls `createShell(el, game)`
// once to get a consistent header (back button, title, meta, reset button) and
// a stage container it can fill. Keeping this in one place means every game
// automatically gets the same polished, responsive frame.

import { openNameEditor } from './player-names.js';
import { room } from './multiplayer.js';
import { GAME_HELP, openGameHelp } from './game-help.js';
import { iconMarkup } from './icons.js';

export function createShell(container, game, { title, meta, resetLabel = 'Reset' } = {}) {
  const shell = document.createElement('div');
  shell.className = 'game-shell';
  shell.style.setProperty('--accent', game.color);
  shell.innerHTML = `
    <div class="game-head">
      <button class="back-btn game-ui-action game-ui-action--secondary" type="button" data-nav="back">${iconMarkup('tabler:arrow-left')} Back to games</button>
      <div class="game-head-center">
        <div class="game-head-identity">
          ${game.icon ? `<span class="game-head-art">${iconMarkup(game.icon, 'catalog-icon')}</span>` : ''}
          <div>
            <h2 class="game-title">${title || game.name}</h2>
            ${meta ? `<p class="game-meta">${meta}</p>` : ''}
          </div>
        </div>
      </div>
      <button class="reset-btn game-ui-action game-ui-action--secondary" type="button" data-action="reset">${iconMarkup('tabler:refresh')} ${resetLabel}</button>
    </div>
    <div class="game-stage"></div>`;

  container.appendChild(shell);
  const resetButton = shell.querySelector('[data-action="reset"]');
  const resetToast = document.createElement('div');
  resetToast.className = 'reset-toast';
  resetToast.setAttribute('role', 'status');
  resetToast.hidden = true;
  shell.querySelector('.game-head').appendChild(resetToast);
  let resetToastTimer;
  resetButton.addEventListener('click', () => {
    if (resetButton.disabled || shell.querySelector('.setup-card')) return;
    resetToast.textContent = room.activeGame?.id === game.id ? 'Restart requested' : 'Game reset';
    resetToast.hidden = false;
    clearTimeout(resetToastTimer);
    resetToastTimer = setTimeout(() => { resetToast.hidden = true; }, 2400);
  });
  const hasNames = game.players?.max > 1 && room.activeGame?.id !== game.id;
  const tools = GAME_HELP[game.id] || hasNames ? document.createElement('details') : null;
  if (tools) {
    tools.className = 'game-tools';
    const summary = document.createElement('summary');
    summary.textContent = 'Help & player options';
    tools.appendChild(summary);
    shell.querySelector('.game-head-center').appendChild(tools);
  }
  if (GAME_HELP[game.id]) {
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'game-help-btn';
    help.innerHTML = `${iconMarkup('tabler:info-circle')} How to play`;
    help.addEventListener('click', () => openGameHelp(game.id));
    tools.appendChild(help);
  }
  if (hasNames) {
    const names = document.createElement('button');
    names.type = 'button';
    names.className = 'game-names-btn';
    names.innerHTML = `${iconMarkup('tabler:pencil')} Player names`;
    names.addEventListener('click', () => openNameEditor(game.players.max));
    tools.appendChild(names);
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
// fields: [{ key, label, help?, options: [{ value, label }], default }]
// Returns a Promise that resolves with { [key]: value } when the user starts.
export function renderSetup(stage, { title, subtitle, fields, startLabel = 'Start', themeClass = '', validate, summary } = {}) {
  return new Promise((resolve) => {
    const values = {};
    for (const f of fields) values[f.key] = f.default ?? f.options?.[0].value ?? '';
    const configurable = fields.filter(f => f.type === 'number' || f.options.length > 1);

    const card = document.createElement('div');
    card.className = `setup-card${themeClass ? ' ' + themeClass : ''}`;
    card.innerHTML = `
      ${title ? `<h3 class="setup-title">${title}</h3>` : ''}
      ${subtitle ? `<p class="setup-subtitle">${subtitle}</p>` : ''}
      <p class="setup-guide">${configurable.length ?
        'Ready with the choices below. Expand configuration to customize, then start playing.' :
        'Everything is ready. Start when you are.'}</p>
      ${configurable.length ? `<p class="setup-preview" aria-live="polite"></p>
      <details class="setup-config">
        <summary>Game configuration</summary>
        <div class="setup-fields"></div>
      </details>` : ''}
      <button class="setup-start-btn" type="button">${startLabel} ${iconMarkup('tabler:arrow-right')}</button>`;
    stage.appendChild(card);
    const feedback = validate || summary ? document.createElement('p') : null;
    if (feedback) {
      feedback.className = 'setup-field-help';
      feedback.setAttribute('aria-live', 'polite');
      card.appendChild(feedback);
    }
    function updateFeedback() {
      if (!feedback) return;
      const error = validate?.(values) ?? '';
      feedback.textContent = error || summary?.(values) || '';
      card.querySelector('.setup-start-btn').disabled = !!error;
    }

    const fieldsEl = card.querySelector('.setup-fields');

    function renderFields() {
      if (!fieldsEl) { updateFeedback(); return; }
      fieldsEl.innerHTML = '';
      const visible = configurable.filter(f => !f.when || f.when(values));
      card.querySelector('.setup-preview').textContent = visible.slice(0, 3).map(f =>
        `${f.label}: ${f.options?.find(opt => opt.value === values[f.key])?.label ?? values[f.key]}`).join(' · ') +
        (visible.length > 3 ? ` · ${visible.length - 3} more options in configuration` : '');
      for (const f of visible) {
        const group = document.createElement('div');
        group.className = 'setup-field';
        group.innerHTML = `<span class="setup-field-label">${f.label}</span>
          <div class="setup-options" role="group" aria-label="${f.label}"></div>`;
        const optionsEl = group.querySelector('.setup-options');
        if (f.type === 'number') {
          const input = document.createElement('input');
          input.type = 'number';
          input.min = String(f.min); input.max = String(f.max); input.step = '1';
          input.value = values[f.key];
          input.setAttribute('aria-label', f.label);
          input.addEventListener('input', () => { values[f.key] = input.value; updateFeedback(); });
          optionsEl.appendChild(input);
        }
        for (const opt of f.options ?? []) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'setup-option' + (values[f.key] === opt.value ? ' active' : '');
          btn.setAttribute('aria-pressed', String(values[f.key] === opt.value));
          btn.textContent = opt.label;
          btn.addEventListener('click', () => {
            values[f.key] = opt.value;
            window.arcadeAudio?.prepare();
            window.arcadeAudio?.tap();
            window.haptics?.select();
            renderFields();
            fieldsEl.querySelector(`[data-setup-key="${f.key}"] [aria-pressed="true"]`)?.focus();
          });
          optionsEl.appendChild(btn);
        }
        group.dataset.setupKey = f.key;
        if (f.help) {
          const hint = document.createElement('p');
          hint.className = 'setup-field-help';
          hint.textContent = f.help;
          group.appendChild(hint);
        }
        fieldsEl.appendChild(group);
      }
      updateFeedback();
    }

    renderFields();

    card.querySelector('.setup-start-btn').addEventListener('click', () => {
      if (validate?.(values)) { updateFeedback(); return; }
      window.arcadeAudio?.prepare();
      window.arcadeAudio?.chime();
      window.haptics?.medium();
      card.remove();
      resolve(values);
    });
  });
}
