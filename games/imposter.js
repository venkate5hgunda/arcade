// Imposter — find the spies among you. 3-20 players, pass-and-play.
// Classic: imposters know their role and may see the category/hint.
// Pair: imposters secretly get a close decoy word and don't know their role.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { createTurnIndicator } from '../js/turn-indicator.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { playerName } from '../js/player-names.js';
import { TELUGU_MOVIES } from '../js/party-prompts.js';
import { IMPOSTER_CATEGORIES, WORD_CATEGORY_IDS, LEGACY_EVERYDAY } from '../js/imposter-words.js';
import { escapeHTML, loadMovieScreen, filterMovies, uniquePrompts, movieFilterFields, movieSetupError, movieDetails, difficultyLabel } from '../js/movie-library.js';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;
export const MAX_IMPOSTERS = 6;
const MOVIES = 'telugu-movies';
const LEGACY = 'everyday';
const INTEL = ['category', 'hint', 'team'];
const MODES = ['classic', 'pair'];
const CATEGORY_IDS = [...WORD_CATEGORY_IDS, MOVIES];
const byId = new Map(IMPOSTER_CATEGORIES.map(category => [category.id, category]));

export const maxImposters = players => Math.max(1, Math.min(MAX_IMPOSTERS, Math.floor((players - 1) / 2)));
const nameOf = index => playerName(index);
const categoryLabel = id => id === MOVIES ? 'Telugu movies' : id === LEGACY ? 'Everyday words' : byId.get(id)?.label ?? id;
const movieSettings = s => ({ ...s, category: s.categories?.includes(MOVIES) ? MOVIES : '' });
const random = list => list[Math.floor(Math.random() * list.length)];

// A movie's decoy is another film at the same difficulty with the nearest year.
function movieDecoy(movie, pool) {
  const others = pool.filter(entry => (entry.prompt ?? entry.title) !== (movie.prompt ?? movie.title));
  if (!others.length) return '';
  const distance = entry => (entry.difficulty === movie.difficulty ? 0 : 1000) + Math.abs((entry.year ?? 0) - (movie.year ?? 0));
  const best = Math.min(...others.map(distance));
  const closest = others.filter(entry => distance(entry) === best);
  return (closest[0].prompt ?? closest[0].title);
}

export function drawWord(categories, movies) {
  const usable = categories.filter(id => id !== MOVIES || movies.length);
  const id = random(usable);
  if (id === MOVIES) {
    const movie = random(movies);
    return { category: MOVIES, word: movie.prompt ?? movie.title, hint: movie.clue, decoy: movieDecoy(movie, movies) };
  }
  const entry = random(byId.get(id).words);
  return { category: id, ...entry };
}

function wordExists(s, movies) {
  if (s.category === LEGACY) return s.legacy && LEGACY_EVERYDAY.some(entry => entry.word === s.word && entry.hint === s.hint);
  if (s.category === MOVIES) {
    const pool = uniquePrompts(filterMovies(movies, movieSettings(s)));
    if (s.legacy && s.period === undefined && !s.yearRange && !s.difficulties) pool.push(...TELUGU_MOVIES);
    return pool.some(movie => ((movie.prompt ?? movie.title) === s.word || movie.title === s.word) && movie.clue === s.hint);
  }
  return !!byId.get(s.category)?.words.some(entry => entry.word === s.word && entry.hint === s.hint && entry.decoy === s.decoy);
}

// Saves from before multi-imposter support had one imposterIndex and clue.
function migrate(s) {
  if (!s || s.imposters || !Number.isInteger(s.imposterIndex)) return s;
  const category = s.category ?? LEGACY;
  if (![LEGACY, MOVIES].includes(category)) return null;
  return {
    ...s, legacy: true, mode: 'classic', intel: [...INTEL], imposterRange: [1, 1], imposters: [s.imposterIndex],
    categories: [category], category, hint: s.clue, decoy: '', out: [], history: [], round: 1, starter: 0,
  };
}

export function validCheckpoint(raw, movies = TELUGU_MOVIES) {
  const s = migrate(raw);
  if (!s) return false;
  const n = s.players;
  const seat = value => Number.isInteger(value) && value >= 0 && value < n;
  const unique = list => Array.isArray(list) && new Set(list).size === list.length;
  if (!Number.isInteger(n) || n < MIN_PLAYERS || n > MAX_PLAYERS || !MODES.includes(s.mode)) return false;
  if (!Array.isArray(s.intel) || !s.intel.every(item => INTEL.includes(item))) return false;
  if (!unique(s.categories) || !s.categories.length || !s.categories.every(id => CATEGORY_IDS.includes(id) || (s.legacy && id === LEGACY))) return false;
  if (!s.categories.includes(s.category)) return false;
  if (s.categories.includes(MOVIES) && movieSetupError(movies, movieSettings(s))) return false;
  if (!unique(s.imposters) || !s.imposters.length || s.imposters.length > maxImposters(n) || !s.imposters.every(seat)) return false;
  if (!unique(s.out) || !s.out.every(seat) || !Array.isArray(s.history)) return false;
  const living = index => !s.out.includes(index);
  const imposterCount = s.imposters.filter(living).length;
  if (!imposterCount || imposterCount >= n - s.out.length - imposterCount) return false;
  if (!['setup', 'reveal', 'discuss', 'vote', 'verdict'].includes(s.phase)) return false;
  if (['setup', 'reveal'].includes(s.phase) && s.out.length) return false;
  if (!seat(s.currentPlayer) || !living(s.currentPlayer) || !Number.isInteger(s.round) || s.round < 1) return false;
  if (typeof s.word !== 'string' || typeof s.hint !== 'string' || typeof s.decoy !== 'string') return false;
  if (s.mode === 'pair' && !s.decoy) return false;
  if (!wordExists(s, movies)) return false;
  if (!Array.isArray(s.votes) || s.votes.length !== n) return false;
  if (!s.votes.every((vote, voter) => vote === null || (living(voter) && seat(vote) && living(vote) && vote !== voter))) return false;
  return s.phase !== 'vote' || s.votes.slice(s.currentPlayer + 1).every(vote => vote === null);
}

function setupFields(saved, movies) {
  const players = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Number(saved.players) || 4));
  const range = Array.isArray(saved.imposterRange) ? saved.imposterRange.map(Number) : [1, 1];
  const categories = Array.isArray(saved.categories) ? saved.categories.filter(id => CATEGORY_IDS.includes(id)) :
    saved.category === MOVIES ? [MOVIES] : [...WORD_CATEGORY_IDS];
  const plural = count => `${count} imposter${count === 1 ? '' : 's'}`;
  return [
    {
      key: 'players', label: 'Players',
      options: Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => ({ value: String(i + MIN_PLAYERS), label: `${i + MIN_PLAYERS} Players` })),
      default: String(players),
    },
    {
      key: 'mode', label: 'Mode',
      options: [{ value: 'classic', label: 'Classic' }, { value: 'pair', label: 'Pair (decoy word)' }],
      default: MODES.includes(saved.mode) ? saved.mode : 'classic',
      help: 'Classic tells imposters who they are. Pair mode gives imposters a close but different word, and nobody is told their role.',
    },
    {
      key: 'imposterRange', label: 'Imposters', type: 'range', min: 1, max: MAX_IMPOSTERS,
      default: [Math.max(1, Math.min(range[0], range[1], MAX_IMPOSTERS)) || 1, Math.max(1, Math.min(Math.max(range[0], range[1]), MAX_IMPOSTERS)) || 1],
      toggle: {
        key: 'imposterRandom', label: 'Random',
        default: saved.imposterRandom ?? String(range[0] !== range[1]),
        lockedTitle: 'Add players to allow a random count',
      },
      limit: values => ({ max: maxImposters(Number(values.players)) }),
      limitNote: (values, [, most]) => most < MAX_IMPOSTERS ?
        `${values.players} players allow up to ${plural(most)}${most === 1 ? ' — add players for more.' : '.'}` : '',
      format: ([low, high]) => low === high ? plural(low) : `${low}–${high} imposters`,
      valueText: count => plural(count), handleLabels: ['Fewest imposters', 'Most imposters'],
      boundLabels: ['1', String(MAX_IMPOSTERS)],
      help: 'Turn on Random to pick a secret count within a range each round.',
    },
    {
      key: 'intel', label: 'Imposters can see', type: 'multiple', when: values => values.mode === 'classic',
      options: [
        { value: 'category', label: 'Category' },
        { value: 'hint', label: 'Hint' },
        { value: 'team', label: 'Fellow imposters' },
      ],
      default: Array.isArray(saved.intel) ? saved.intel.filter(item => INTEL.includes(item)) : [...INTEL],
      allLabel: 'Category + hint + team', noneLabel: 'Nothing',
      optionState: (option, values) => option.value === 'team' && values.imposterRange[1] < 2 ?
        { disabled: true, fixed: true, title: 'Only matters with two or more imposters' } : {},
      help: 'Turn things off to make it harder for imposters.',
    },
    {
      key: 'categories', label: 'Categories', type: 'multiple', collapsible: true, bulk: true,
      options: [
        ...IMPOSTER_CATEGORIES.map(category => ({ value: category.id, label: category.label, icon: category.emoji })),
        { value: MOVIES, label: 'Telugu movies', icon: '🎬' },
      ],
      default: categories.length ? categories : [...WORD_CATEGORY_IDS],
      allLabel: 'Everything', noneLabel: 'None', format: list => list.length === WORD_CATEGORY_IDS.length && !list.includes(MOVIES) ? 'All words' : '',
      error: values => categoryError(movies, values),
      help: 'Each round picks a category at random, then a word from it.',
    },
    ...movieFilterFields(saved, movies, values => values.categories?.includes(MOVIES), movieSettings),
  ];
}

function categoryError(movies, values) {
  if (!values.categories?.length) return 'Pick at least one word category.';
  if (values.mode === 'pair' && values.categories.length === 1 && values.categories[0] === MOVIES &&
      uniquePrompts(filterMovies(movies, movieSettings(values))).length < 2) return 'Pair mode needs at least two matching movies, or another category.';
  return '';
}

// The setup form prevents these live; this guards saved or scripted settings.
export function setupError(movies, values) {
  const players = Number(values.players);
  const categoryProblem = categoryError(movies, values);
  if (categoryProblem) return categoryProblem;
  const limit = maxImposters(players);
  if (values.imposterRange[1] > limit) return `With ${players} players, use at most ${limit} imposter${limit === 1 ? '' : 's'}.`;
  return movieSetupError(movies, movieSettings(values));
}

export default {
  async render(el, game, { navigate, session, movieLibrary } = {}) {
    const shell = createShell(el, game, { title: 'Imposter', meta: 'Pass the device · find the spies' });
    const showTurn = createTurnIndicator(shell.root);
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('imp-vibe');
    const movies = movieLibrary ?? await loadMovieScreen(stage);

    const saved = loadJSON(KEYS.SETTINGS + ':imposter', { players: '4' });
    const checkpoint = validCheckpoint(session?.state, movies) ? migrate(session.state) : null;
    const settings = checkpoint ? { ...checkpoint, players: String(checkpoint.players) } : await renderSetup(stage, {
      title: '🕵️ Imposter',
      subtitle: 'Pick your table, then deal secret cards',
      themeClass: 'imp-theme',
      fields: setupFields(saved, movies),
      validate: values => setupError(movies, values),
      summary: values => {
        const words = values.categories.reduce((total, id) => total + (id === MOVIES ?
          uniquePrompts(filterMovies(movies, movieSettings(values))).length : byId.get(id).words.length), 0);
        return `${words.toLocaleString()} words across ${values.categories.length} categor${values.categories.length === 1 ? 'y' : 'ies'}` +
          (values.categories.includes(MOVIES) ? ` · Movies: ${difficultyLabel(values.difficulties)}` : '');
      },
      startLabel: 'Deal the Cards',
    });
    if (!checkpoint) saveJSON(KEYS.SETTINGS + ':imposter', settings);
    const playerCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, parseInt(settings.players, 10) || 4));
    const mode = MODES.includes(settings.mode) ? settings.mode : 'classic';
    const intel = mode === 'classic' ? settings.intel ?? [...INTEL] : [];
    const categories = settings.categories;
    const range = settings.imposterRange ?? [1, 1];
    const limit = maxImposters(playerCount);
    const randomCount = range[0] !== range[1];
    const selectedMovies = categories.includes(MOVIES) ? uniquePrompts(filterMovies(movies, movieSettings(settings))) : [];
    const countLabel = randomCount ? `${range[0]}–${Math.min(range[1], limit)} imposters` : `${range[0]} imposter${range[0] === 1 ? '' : 's'}`;
    shell.root.querySelector('.game-meta').textContent =
      `${playerCount} players · ${mode === 'pair' ? 'Pair mode' : 'Classic'} · ${countLabel}`;

    let phase = 'setup'; // setup -> reveal -> discuss -> vote -> verdict -> ... -> result
    let currentPlayer = 0, round = 1, starter = 0;
    let imposters = [], out = [], history = [], votes = [];
    let word = '', hint = '', decoy = '', category = categories[0];
    let lastVerdict = null;

    const living = () => Array.from({ length: playerCount }, (_, i) => i).filter(i => !out.includes(i));
    const isImposter = index => imposters.includes(index);
    const livingImposters = () => imposters.filter(index => !out.includes(index));
    const winner = () => !livingImposters().length ? 'town' :
      livingImposters().length >= living().length - livingImposters().length ? 'imposters' : null;

    function checkpointGame() {
      if (phase === 'result') { session?.finish(); return; }
      session?.save({
        players: playerCount, mode, intel: [...intel], imposterRange: [...range], categories: [...categories],
        yearRange: settings.yearRange, difficulties: settings.difficulties, period: settings.period,
        fromYear: settings.fromYear, toYear: settings.toYear, difficulty: settings.difficulty, legacy: settings.legacy,
        phase, currentPlayer, round, starter, imposters: [...imposters], out: [...out], history: history.map(entry => ({ ...entry })),
        word, hint, decoy, category, votes: [...votes],
      });
    }

    const card = document.createElement('div');
    card.className = 'imp-card';
    stage.appendChild(card);
    const status = document.createElement('div');
    status.className = 'imp-status';
    stage.appendChild(status);

    const feedback = kind => {
      const audio = window.arcadeAudio;
      audio?.prepare?.();
      audio?.tap?.();
      if (kind === 'select') window.haptics?.select();
    };
    const names = list => list.map(index => escapeHTML(nameOf(index))).join(', ');

    function revealCard() {
      const spy = isImposter(currentPlayer);
      const who = `<h3>${escapeHTML(nameOf(currentPlayer))}</h3>`;
      if (mode === 'pair') {
        return `<div class="imp-reveal">
          ${who}
          <p class="imp-role">🤫 Your secret word</p>
          <p class="imp-word"><strong>${escapeHTML(spy ? decoy : word)}</strong></p>
          <p class="imp-hint">Most players share your word, but someone's is slightly different. Describe yours carefully.</p>`;
      }
      if (!spy) {
        return `<div class="imp-reveal">
          ${who}
          <p class="imp-role">👤 You're in the crew</p>
          <p class="imp-word">Word: <strong>${escapeHTML(word)}</strong></p>
          <p class="imp-intel"><span>Category</span>${escapeHTML(categoryLabel(category))}</p>
          <p class="imp-hint">Prove you know it without giving it away.</p>`;
      }
      const partners = imposters.filter(index => index !== currentPlayer);
      const lines = [
        intel.includes('category') ? `<p class="imp-intel"><span>Category</span>${escapeHTML(categoryLabel(category))}</p>` : '',
        intel.includes('hint') ? `<p class="imp-intel imp-clue"><span>Hint</span>${escapeHTML(hint)}</p>` : '',
        intel.includes('team') ? `<p class="imp-intel"><span>Team</span>${partners.length ? `With ${names(partners)}` : 'You are the only imposter'}</p>` : '',
      ].join('');
      return `<div class="imp-reveal imposter">
        ${who}
        <p class="imp-role">🕵️ You are an imposter</p>
        ${lines || '<p class="imp-intel"><span>Intel</span>None. Listen closely and bluff.</p>'}
        <p class="imp-hint">Blend in. Don't get voted out.</p>`;
    }

    function tallies() {
      const counts = Array(playerCount).fill(0);
      votes.forEach(vote => { if (vote !== null) counts[vote]++; });
      return counts;
    }

    function verdictMarkup(verdict) {
      if (!verdict) return '';
      if (verdict.out === null) return '<p class="imp-verdict">🤝 Tied vote. Nobody leaves this round.</p>';
      return `<p class="imp-verdict ${isImposter(verdict.out) ? 'caught' : 'innocent'}">
        <strong>${escapeHTML(nameOf(verdict.out))}</strong> was voted out and
        ${isImposter(verdict.out) ? 'was an imposter! 🎯' : 'was innocent. 😬'}</p>`;
    }

    function render() {
      const turnPhase = ['setup', 'reveal', 'vote'].includes(phase);
      showTurn(currentPlayer, turnPhase, turnPhase ? nameOf(currentPlayer) : null);
      card.innerHTML = '';
      status.textContent = '';
      if (phase === 'setup') {
        card.innerHTML = `
          <div class="imp-setup">
            <p class="imp-step">Card ${currentPlayer + 1} of ${playerCount}</p>
            <h3>Pass the device to ${escapeHTML(nameOf(currentPlayer))}</h3>
            <p class="imp-hint">Make sure nobody else can see, then tap "Show My Card".</p>
            <button class="imp-btn" id="showCard">Show My Card</button>
          </div>`;
        card.querySelector('#showCard').addEventListener('click', showCard);
      } else if (phase === 'reveal') {
        card.innerHTML = `${revealCard()}
          <button class="imp-btn" id="nextPlayer">${currentPlayer < playerCount - 1 ? 'Hide & Pass On' : 'Hide & Start Discussion'}</button>
        </div>`;
        card.querySelector('#nextPlayer').addEventListener('click', nextPlayerReveal);
      } else if (phase === 'discuss') {
        const left = livingImposters().length;
        card.innerHTML = `
          <div class="imp-discuss">
            <p class="imp-step">Round ${round}</p>
            ${verdictMarkup(lastVerdict)}
            <h3>Discussion</h3>
            <p><strong>${escapeHTML(nameOf(starter))}</strong> gives the first clue, then go around the table.</p>
            <p class="imp-hint">${living().length} players remain · ${randomCount ? 'Imposter count is secret' : `${left} imposter${left === 1 ? '' : 's'} left`}</p>
            <button class="imp-btn" id="startVote">Start Voting</button>
          </div>`;
        card.querySelector('#startVote').addEventListener('click', startVote);
      } else if (phase === 'vote') {
        card.innerHTML = `
          <div class="imp-vote">
            <p class="imp-step">Round ${round} vote</p>
            <h3>${escapeHTML(nameOf(currentPlayer))}, who is suspicious?</h3>
            <div class="imp-vote-options">
              ${Array.from({ length: playerCount }, (_, i) => `
                <button class="imp-vote-btn ${votes[currentPlayer] === i ? 'selected' : ''} ${out.includes(i) ? 'out' : ''}" data-vote="${i}" ${i === currentPlayer || out.includes(i) ? 'disabled' : ''} aria-pressed="${votes[currentPlayer] === i}">
                  ${escapeHTML(nameOf(i))}${out.includes(i) ? ' · out' : ''}
                </button>`).join('')}
            </div>
            <button class="imp-btn" id="submitVote" ${votes[currentPlayer] === null ? 'disabled' : ''}>Lock In Vote</button>
          </div>`;
        card.querySelectorAll('.imp-vote-btn').forEach(btn => {
          btn.addEventListener('click', () => selectVote(parseInt(btn.dataset.vote, 10)));
        });
        card.querySelector('#submitVote').addEventListener('click', submitVote);
      } else if (phase === 'verdict') {
        card.innerHTML = `
          <div class="imp-discuss">
            <p class="imp-step">Round ${round - 1} result</p>
            ${verdictMarkup(lastVerdict)}
            <p class="imp-hint">The game continues. Imposters are still hiding.</p>
            <button class="imp-btn" id="nextRound">Next Round</button>
          </div>`;
        card.querySelector('#nextRound').addEventListener('click', nextRound);
      } else if (phase === 'result') {
        const movie = category === MOVIES ? selectedMovies.find(entry => (entry.prompt ?? entry.title) === word || entry.title === word) : null;
        const town = winner() === 'town';
        const counts = tallies();
        const maxVotes = Math.max(...counts);
        card.innerHTML = `
          <div class="imp-result ${town ? 'win' : 'lose'}">
            ${verdictMarkup(lastVerdict)}
            <h3>${town ? '🎉 The crew caught every imposter!' : '🕵️ The imposters win!'}</h3>
            <p>Imposter${imposters.length === 1 ? '' : 's'}: <strong>${names(imposters)}</strong></p>
            <p>The word was <strong>${escapeHTML(word)}</strong>${mode === 'pair' ? ` · decoy <strong>${escapeHTML(decoy)}</strong>` : ''}</p>
            <p class="imp-hint">${escapeHTML(categoryLabel(category))} · Hint: ${escapeHTML(hint)}</p>
            ${movieDetails(movie)}
            ${history.length ? `<ol class="imp-history">${history.map(entry => `<li>Round ${entry.round}: ${entry.out === null ? 'tie' :
              `${escapeHTML(nameOf(entry.out))} out${isImposter(entry.out) ? ' 🎯' : ''}`}</li>`).join('')}</ol>` : ''}
            <p class="imp-step">Final vote</p>
            <div class="imp-vote-breakdown">
              ${counts.map((count, i) => out.includes(i) && !count ? '' : `<span class="imp-vote-bar ${isImposter(i) ? 'spy' : ''}" style="--count:${count}; --max:${maxVotes || 1}"><span>${escapeHTML(nameOf(i))}</span><strong>${count}</strong></span>`).join('')}
            </div>
            <button class="imp-btn" id="playAgain">Play Again</button>
          </div>`;
        card.querySelector('#playAgain').addEventListener('click', newGame);
      }
    }

    function newGame() {
      shell.root.querySelector('.arcade-victory')?.remove();
      ({ word, hint, decoy, category } = drawWord(categories, selectedMovies));
      const count = Math.min(limit, range[0] + Math.floor(Math.random() * (Math.min(range[1], limit) - range[0] + 1)));
      const seats = Array.from({ length: playerCount }, (_, i) => i);
      for (let i = seats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seats[i], seats[j]] = [seats[j], seats[i]];
      }
      imposters = seats.slice(0, Math.max(1, count)).sort((a, b) => a - b);
      out = []; history = []; lastVerdict = null;
      round = 1; currentPlayer = 0; starter = Math.floor(Math.random() * playerCount);
      phase = 'setup';
      votes = Array(playerCount).fill(null);
      checkpointGame();
      render();
    }

    function showCard() {
      phase = 'reveal';
      feedback('select');
      // A refresh must always return to the face-down handoff, never expose a role.
      render();
    }

    function nextPlayerReveal() {
      feedback('select');
      if (currentPlayer < playerCount - 1) {
        currentPlayer++;
        phase = 'setup';
      } else {
        phase = 'discuss';
        currentPlayer = starter;
      }
      checkpointGame();
      render();
    }

    function startVote() {
      phase = 'vote';
      votes = Array(playerCount).fill(null);
      currentPlayer = living()[0];
      feedback();
      checkpointGame();
      render();
    }

    function selectVote(vote) {
      if (vote === currentPlayer || out.includes(vote)) return;
      votes[currentPlayer] = vote;
      feedback('select');
      checkpointGame();
      render();
    }

    function submitVote() {
      if (!Number.isInteger(votes[currentPlayer])) return;
      const next = living().find(index => index > currentPlayer);
      if (next !== undefined) {
        currentPlayer = next;
        feedback();
        checkpointGame();
        render();
        return;
      }
      const counts = tallies();
      const maxVotes = Math.max(...counts);
      const leaders = counts.flatMap((count, index) => count === maxVotes ? [index] : []);
      const eliminated = leaders.length === 1 ? leaders[0] : null;
      if (eliminated !== null) out.push(eliminated);
      lastVerdict = { round, out: eliminated };
      history.push(lastVerdict);
      round++;
      const result = winner();
      if (result) {
        phase = 'result';
        if (result === 'town') celebrate(shell.root, 'The crew caught every imposter!');
        else { window.arcadeAudio?.buzz?.(); window.haptics?.failure?.(); }
      } else {
        phase = 'verdict';
        if (eliminated !== null && isImposter(eliminated)) window.haptics?.success?.();
        currentPlayer = living()[0];
      }
      checkpointGame();
      render();
    }

    function nextRound() {
      feedback();
      phase = 'discuss';
      const alive = living();
      starter = alive[Math.floor(Math.random() * alive.length)];
      currentPlayer = starter;
      checkpointGame();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    if (checkpoint) {
      ({ currentPlayer, round, starter, word, hint, decoy, category } = checkpoint);
      imposters = [...checkpoint.imposters]; out = [...checkpoint.out];
      history = checkpoint.history.map(entry => ({ ...entry })); votes = [...checkpoint.votes];
      lastVerdict = history.at(-1) ?? null;
      phase = checkpoint.phase === 'reveal' ? 'setup' : checkpoint.phase;
      checkpointGame();
      render();
    } else newGame();
    const onVisibility = () => {
      if (document.hidden && phase === 'reveal') {
        phase = 'setup';
        checkpointGame();
        render();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return { dispose: () => {
      window.removeEventListener('arcade:themechange', onTheme);
      document.removeEventListener('visibilitychange', onVisibility);
    } };
  },
};
