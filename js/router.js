// Router — minimal client-side router for the single-page Arcade.
// On load it reads the URL hash (#/game-id) and mounts the matching game.
// Pushes/pops state so the back button and deep links work.

import { loadJSON, remove, saveJSON, KEYS } from './storage.js';
import { loadGameModule, getGame, CATEGORIES, gamesByCategory, playerLabel } from './game-catalog.js';
import { createGameSession, recentUnfinishedGame } from './game-session.js';
import { room } from './multiplayer.js';

const STAGE_ID = 'game-stage';
const MAX_RECENT = 6;

function recordRecentlyPlayed(id) {
  const list = loadJSON(KEYS.RECENT_GAMES, []).filter((e) => e.id !== id);
  list.unshift({ id, at: Date.now() });
  saveJSON(KEYS.RECENT_GAMES, list.slice(0, MAX_RECENT));
}

function getRecentlyPlayed() {
  return loadJSON(KEYS.RECENT_GAMES, [])
    .map((entry) => getGame(entry.id))
    .filter(Boolean);
}

function parseHash(hash) {
  if (!hash) return null;
  const match = hash.match(/^#\/games\/([^/?#]+)/);
  return match ? match[1] : null;
}

function syncHash(gameId) {
  const next = gameId ? `#/games/${gameId}` : '#/';
  if (location.hash !== next) location.hash = next;
}

// Guards against a subtle race: syncHash() sets location.hash, which fires an
// async 'hashchange' event that re-enters navigate() for the same route while
// the first call is still awaiting its dynamic import — both calls would
// otherwise render into the stage and double-mount the game. Each call gets a
// token; only the most recent one is allowed to touch the DOM after an await.
let navToken = 0;
let mountedGame = null;
let mountedSession = null;
let activeRoute = null;

export async function navigate(gameId, { pushState = true } = {}) {
  const myToken = ++navToken;
  if (!mountedSession?.isExpired()) mountedSession?.touch();
  mountedSession?.stop();
  mountedSession = null;
  mountedGame?.dispose?.();
  mountedGame = null;
  const game = gameId ? getGame(gameId) : null;
  activeRoute = game?.id ?? null;
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
  if (myToken !== navToken) return; // a newer navigation has since taken over
  if (!module || typeof module.render !== 'function') {
    stage.innerHTML = renderComingSoon(game);
    return;
  }

  recordRecentlyPlayed(game.id);
  const session = room.activeGame?.id === game.id ? null : createGameSession(game.id);

  try {
    // Pass navigate so games can wire their back buttons
    const instance = await module.render(stage, game, { navigate, multiplayer: room, session });
    if (myToken !== navToken) {
      instance?.dispose?.();
      session?.stop();
      return;
    }
    mountedGame = instance;
    mountedSession = session;
  } catch (err) {
    session?.stop();
    if (myToken !== navToken) return; // superseded mid-render; newer call owns the stage
    console.error(`Failed to mount game ${game.id}`, err);
    stage.innerHTML = renderError(game, err);
  }
}

export function renderGameGrid(container, category = 'All') {
  renderGameList(container, gamesByCategory(category));
}

function renderGameList(container, games) {
  container.innerHTML = '';
  container.setAttribute('role', 'list');

  games.forEach((game) => {
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
    container.appendChild(card);
  });

  if (!games.length) {
    container.innerHTML = `<p class="game-grid-empty">No games in this category yet.</p>`;
  }
}

function wireGrid() {
  const grid = document.querySelector('#game-grid');
  const tabs = document.querySelector('#category-tabs');
  const landing = document.querySelector('.landing');
  if (!grid) return;

  let active = 'All';
  renderGameGrid(grid, active);

  const recentSection = document.querySelector('#recent-section');
  const recentGrid = document.querySelector('#recent-grid');
  const recent = getRecentlyPlayed();
  if (recentSection && recentGrid && recent.length) {
    recentSection.hidden = false;
    renderGameList(recentGrid, recent);
  }

  landing.addEventListener('click', (e) => {
    const btn = e.target.closest('.game-card-btn[data-game]');
    if (!btn) return;
    window.arcadeAudio?.prepare();
    window.arcadeAudio?.tap();
    window.haptics?.select();
    navigate(btn.dataset.game);
  });

  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (!btn) return;
      active = btn.dataset.category;
      tabs.querySelectorAll('[data-category]').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      window.arcadeAudio?.prepare();
      window.arcadeAudio?.tap();
      renderGameGrid(grid, active);
    });
  }
}

function renderLanding() {
  return `
    <div class="landing">
      <div class="landing-hero">
        <img src="assets/logo.svg" class="landing-logo" alt="" width="72" height="72">
        <h1 class="landing-title">Arcade</h1>
        <p class="landing-sub">Pick a game and start playing. Local multiplayer, group games, and puzzles — all in your browser.</p>
      </div>
      <section id="recent-section" class="recent-section" hidden>
        <h2 class="section-heading">↻ Recently Played</h2>
        <div id="recent-grid" class="game-grid recent-grid" role="list"></div>
      </section>
      <div id="category-tabs" class="category-tabs" role="tablist">
        ${CATEGORIES.map((c) => `<button type="button" class="category-tab${c === 'All' ? ' active' : ''}" data-category="${c}" role="tab" aria-selected="${c === 'All'}">${c}</button>`).join('')}
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
    if (id === activeRoute) return;
    navigate(id, { pushState: false });
  });

  // Wire up back buttons rendered by router templates.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const btn = e.target.closest('[data-nav="back"]');
    if (btn) {
      e.preventDefault();
      navigate(null);
    }
  });

  // A bookmarked game route is not an unfinished round. Start at home unless
  // there is a recent, resumable checkpoint from this browser.
  remove(KEYS.ACTIVE_GAME);
  const initial = recentUnfinishedGame();
  history.replaceState(null, '', `${location.pathname}${location.search}${initial ? `#/games/${initial}` : '#/'}`);
  navigate(initial, { pushState: false });
  window.addEventListener('pagehide', () => mountedSession?.touch());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) mountedSession?.touch();
    else if (mountedSession?.isExpired()) navigate(null);
  });
  window.setInterval(() => {
    const activeExpired = mountedSession?.isExpired();
    recentUnfinishedGame();
    if (!document.hidden && activeExpired) navigate(null);
  }, 15_000);
}
