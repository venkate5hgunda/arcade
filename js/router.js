// Router — minimal client-side router for the single-page Arcade.
// On load it reads the URL hash (#/game-id) and mounts the matching game.
// Pushes/pops state so the back button and deep links work.

import { loadJSON, remove, saveJSON, KEYS } from './storage.js';
import { loadGameModule, getGame, CATEGORIES, gamesByCategory, playerLabel } from './game-catalog.js';
import { createGameSession, unfinishedGames } from './game-session.js';
import { room } from './multiplayer.js';
import { iconMarkup } from './icons.js';

const STAGE_ID = 'game-stage';
const MAX_RECENT = 6;
const CATEGORY_ICONS = {
  All: 'tabler:layout-grid',
  Action: 'tabler:bolt',
  Board: 'tabler:chess',
  Cards: 'tabler:cards',
  Party: 'tabler:confetti',
  Puzzle: 'tabler:puzzle',
  Word: 'tabler:abc',
};

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

export function initialGameFromHash(hash) {
  return getGame(parseHash(hash))?.id ?? null;
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

  games.forEach((game, index) => {
    const card = document.createElement('article');
    card.className = 'game-card';
    card.setAttribute('role', 'listitem');
    card.style.setProperty('--accent', game.color);
    card.innerHTML = `
      <button class="game-card-btn" type="button" data-game="${game.id}">
        <span class="game-card-visual" aria-hidden="true">
          <span class="game-card-icon">${iconMarkup(game.icon, 'catalog-icon')}</span>
          <span class="game-card-number">${String(index + 1).padStart(2, '0')}</span>
        </span>
        <span class="game-card-copy">
          <span class="game-card-category">${game.category}</span>
          <span class="game-card-name">${game.name}</span>
          <span class="game-card-tagline">${game.tagline}</span>
          <span class="game-card-bottom">
            <span class="game-card-meta">${iconMarkup('tabler:users')} ${playerLabel(game)}</span>
            <span class="game-card-play" aria-hidden="true">Play ${iconMarkup('tabler:arrow-right')}</span>
          </span>
        </span>
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
  renderResumeGames();

  const recentSection = document.querySelector('#recent-section');
  const recentGrid = document.querySelector('#recent-grid');
  const recent = getRecentlyPlayed();
  if (recentSection && recentGrid && recent.length) {
    recentSection.hidden = false;
    renderGameList(recentGrid, recent);
  }

  landing.addEventListener('click', (e) => {
    const btn = e.target.closest('.game-card-btn[data-game], .resume-game[data-game]');
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

function renderResumeGames() {
  const section = document.querySelector('#resume-section');
  if (!section) return;
  const games = unfinishedGames().map((id) => getGame(id)).filter(Boolean);
  const ids = games.map((game) => game.id).join(',');
  if (section.dataset.games === ids) return;
  section.dataset.games = ids;
  section.hidden = games.length === 0;
  section.querySelector('.resume-games').innerHTML = games.map((game) => `
    <button class="resume-game" type="button" data-game="${game.id}" style="--accent:${game.color}" aria-label="Resume ${game.name}">
      <span class="resume-icon">${iconMarkup(game.icon, 'catalog-icon')}</span>
      <span class="resume-game-copy"><strong>${game.name}</strong><small>Continue playing</small></span>
      ${iconMarkup('tabler:arrow-right')}
    </button>`).join('');
}

function renderLanding() {
  return `
    <div class="landing">
      <div class="landing-hero">
        <p class="landing-eyebrow">YOUR NEXT GAME NIGHT STARTS HERE</p>
        <img src="assets/logo.svg" class="landing-logo" alt="" width="72" height="72">
        <h1 class="landing-title">Arcade</h1>
        <p class="landing-sub">Pick a game and start playing. Local multiplayer, group games, and puzzles — all in your browser.</p>
      </div>
      <section id="resume-section" class="resume-section" aria-labelledby="resume-heading" hidden>
        <div class="resume-heading">
          <span class="resume-heading-icon">${iconMarkup('tabler:history')}</span>
          <div>
            <h2 id="resume-heading">Pick up where you left off</h2>
            <p>Your unfinished games are ready when you are.</p>
          </div>
        </div>
        <div class="resume-games"></div>
      </section>
      <section id="recent-section" class="recent-section" hidden>
        <h2 class="section-heading">${iconMarkup('tabler:history')} Recently played</h2>
        <div id="recent-grid" class="game-grid recent-grid" role="list"></div>
      </section>
      <div class="catalog-toolbar">
        <h2 class="section-heading">${iconMarkup('tabler:layout-grid')} Explore games</h2>
        <div id="category-tabs" class="category-tabs" role="tablist" aria-label="Game categories">
          ${CATEGORIES.map((c) => `<button type="button" class="category-tab${c === 'All' ? ' active' : ''}" data-category="${c}" role="tab" aria-selected="${c === 'All'}">${iconMarkup(CATEGORY_ICONS[c])}${c}</button>`).join('')}
        </div>
      </div>
      <div id="game-grid" class="game-grid" role="list"></div>
    </div>`;
}

function renderComingSoon(game) {
  return `
    <div class="game-shell coming-soon">
      <button class="back-btn" data-nav="back" type="button">${iconMarkup('tabler:arrow-left')} Back to games</button>
      <div class="game-hero">
        <span class="game-emoji" style="--accent:${game.color}">${iconMarkup(game.icon, 'catalog-icon')}</span>
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
      <button class="back-btn" data-nav="back" type="button">${iconMarkup('tabler:arrow-left')} Back to games</button>
      <div class="game-hero">
        <span class="game-emoji" style="--accent:${game.color}">${iconMarkup(game.icon, 'catalog-icon')}</span>
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

  // The URL tracks where the player last navigated; saved rounds are offered
  // on home but must never override an explicit return to home on refresh.
  remove(KEYS.ACTIVE_GAME);
  const initial = initialGameFromHash(location.hash);
  history.replaceState(null, '', `${location.pathname}${location.search}${initial ? `#/games/${initial}` : '#/'}`);
  navigate(initial, { pushState: false });
  window.addEventListener('pagehide', () => mountedSession?.touch());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) mountedSession?.touch();
    else if (mountedSession?.isExpired()) navigate(null);
  });
  window.setInterval(() => {
    const activeExpired = mountedSession?.isExpired();
    if (activeRoute === null && !document.hidden) renderResumeGames();
    else unfinishedGames();
    if (!document.hidden && activeExpired) navigate(null);
  }, 15_000);
}
