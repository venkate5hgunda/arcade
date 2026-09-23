// Router — minimal client-side router for the single-page Arcade.
// On load it reads the URL hash (#/game-id) and mounts the matching game.
// Pushes/pops state so the back button and deep links work.

import { loadJSON, saveJSON, KEYS } from './storage.js';
import { loadGameModule, getGame, GAMES, playerLabel } from './game-catalog.js';

const STAGE_ID = 'game-stage';

function parseHash(hash) {
  if (!hash) return null;
  const match = hash.match(/^#\/games\/([^/?#]+)/);
  return match ? match[1] : null;
}

function syncHash(gameId) {
  const next = gameId ? `#/games/${gameId}` : '#/';
  if (location.hash !== next) location.hash = next;
}

export async function navigate(gameId, { pushState = true } = {}) {
  const game = gameId ? getGame(gameId) : null;
  const stage = document.getElementById(STAGE_ID);
  if (!stage) return;

  // Clear previous game.
  stage.innerHTML = '';
  stage.dataset.game = '';

  if (!game) {
    stage.innerHTML = renderLanding();
    if (pushState) syncHash('');
    wireGrid();
    return;
  }

  stage.dataset.game = game.id;
  if (pushState) syncHash(game.id);

  const module = await loadGameModule(game.id);
  saveJSON(KEYS.ACTIVE_GAME, game.id);

  if (!module || typeof module.render !== 'function') {
    stage.innerHTML = renderComingSoon(game);
    return;
  }

  try {
    await module.render(stage, game);
  } catch (err) {
    console.error(`Failed to mount game ${game.id}`, err);
    stage.innerHTML = renderError(game, err);
  }
}

export function renderGameGrid(container) {
  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'game-grid';
  list.setAttribute('role', 'list');

  GAMES.forEach((game) => {
    const card = document.createElement('article');
    card.className = 'game-card';
    card.setAttribute('role', 'listitem');
    card.style.setProperty('--accent', game.color);
    card.innerHTML = `
      <button class="game-card-btn" type="button" data-game="${game.id}">
        <span class="game-card-icon" aria-hidden="true">${game.icon}</span>
        <span class="game-card-name">${game.name}</span>
        <span class="game-card-tagline">${game.tagline}</span>
        <span class="game-card-meta">${playerLabel(game)} · ${game.category}</span>
      </button>`;
    list.appendChild(card);
  });

  container.appendChild(list);
}

function wireGrid() {
  const grid = document.querySelector('#game-grid');
  if (!grid) return;
  renderGameGrid(grid);
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-game]');
    if (btn) navigate(btn.dataset.game);
  });
}

function renderLanding() {
  return `
    <div class="landing">
      <div class="landing-hero">
        <img src="assets/logo.svg" class="landing-logo" alt="" width="72" height="72">
        <h1 class="landing-title">Arcade</h1>
        <p class="landing-sub">Pick a game and start playing. Local multiplayer, group games, and puzzles — all in your browser.</p>
      </div>
      <div id="game-grid" class="game-grid" role="list"></div>
    </div>`;
}

function renderComingSoon(game) {
  return `
    <div class="game-shell coming-soon">
      <button class="back-btn" data-nav="back" type="button">← Back to games</button>
      <div class="game-hero">
        <span class="game-emoji" style="--accent:${game.color}">${game.icon}</span>
        <h2>${game.name}</h2>
        <p>${game.tagline}</p>
      </div>
      <div class="coming-soon-card">
        <h3>Coming soon</h3>
        <p>We're building ${game.name} right now. It'll be a polished, responsive, light/dark-mode experience with sound and haptics — just like the rest of Arcade.</p>
      </div>
    </div>`;
}

function renderError(game, err) {
  return `
    <div class="game-shell error">
      <button class="back-btn" data-nav="back" type="button">← Back to games</button>
      <div class="game-hero">
        <span class="game-emoji" style="--accent:${game.color}">${game.icon}</span>
        <h2>${game.name}</h2>
        <p>Something went wrong loading this game.</p>
      </div>
      <pre class="error-detail">${String(err && err.message ? err.message : err)}</pre>
    </div>`;
}

export function initRouter() {
  window.addEventListener('hashchange', () => {
    const id = parseHash(location.hash);
    navigate(id, { pushState: false });
  });

  // Wire up back buttons rendered by router templates.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav="back"]');
    if (btn) {
      e.preventDefault();
      navigate(null);
    }
  });

  // Restore last active game, else landing.
  const stored = loadJSON(KEYS.ACTIVE_GAME, null);
  const initial = parseHash(location.hash) || (stored ? stored : null);
  navigate(initial);
}
