// Shared chrome for game views. Each game module calls `createShell(el, game)`
// once to get a consistent header (back button, title, meta, reset button) and
// a stage container it can fill. Keeping this in one place means every game
// automatically gets the same polished, responsive frame.

import { getGame } from './game-catalog.js';

export function createShell(container, game, { title, meta, resetLabel = 'Reset' } = {}) {
  const shell = document.createElement('div');
  shell.className = 'game-shell';
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
  return {
    root: shell,
    stage: shell.querySelector('.game-stage'),
    getBackButton: () => shell.querySelector('[data-nav="back"]'),
    getResetButton: () => shell.querySelector('[data-action="reset"]'),
  };
}

// Wire the back button to the router's navigate(null).
export function wireBack(shell, navigate) {
  const btn = shell.querySelector('[data-nav="back"]');
  if (btn) btn.addEventListener('click', () => navigate(null));
}
