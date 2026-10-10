// Dumb Charades — act it, guess it. 2-8 players in teams.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { createTurnIndicator } from '../js/turn-indicator.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { TELUGU_MOVIES } from '../js/party-prompts.js';
import { escapeHTML, loadMovieScreen, filterMovies, uniquePrompts, movieFilterFields, movieSetupError, movieDetails, movieBrief, difficultyLabel } from '../js/movie-library.js';

const WORDS = [
  'MOVIE', 'BRUSH TEETH', 'ELEPHANT', 'SWIMMING', 'COOKING', 'DRIVING',
  'SLEEPING', 'DANCING', 'SINGING', 'READING', 'PAINTING', 'FISHING',
  'CAMPING', 'SKIING', 'SURFING', 'CLIMBING', 'RUNNING', 'JUMPING',
  'FLYING KITE', 'WALKING DOG', 'WASHING CAR', 'MOWING LAWN', 'SHOPPING',
  'SUPERMAN', 'SPIDERMAN', 'BATMAN', 'HARRY POTTER', 'FROZEN', 'TOY STORY',
  'TITANIC', 'AVATAR', 'JAWS', 'STAR WARS', 'INDIANA JONES', 'ROCKY',
  'GHOSTBUSTERS', 'BACK TO THE FUTURE', 'ETERNAL SUNSHINE', 'INCEPTION',
  'LION KING', 'ALADDIN', 'BEAUTY BEAST', 'CINDERELLA', 'SNOW WHITE',
  'EATING SPAGHETTI', 'BLOWING CANDLES', 'OPENING PRESENT', 'WRAPPING GIFT',
  'BUILDING SNOWMAN', 'MAKING SNOW ANGEL', 'ROASTING MARSHMALLOW',
  'PLAYING PIANO', 'PLAYING GUITAR', 'PLAYING DRUMS', 'PLAYING VIOLIN',
  'ACTING', 'DIRECTING', 'FILMING', 'EDITING', 'WRITING SCRIPT',
];

const CATEGORIES = ['classic', 'telugu-movies'];
const promptsFor = (category, movies) => category === 'telugu-movies' ? movies.map(movie => movie.prompt ?? movie.title) : WORDS;
const movieFor = (category, title, movies) => category === 'telugu-movies' ? movies.find(movie => (movie.prompt ?? movie.title) === title || movie.title === title) : null;

export function validCheckpoint(s, movies = TELUGU_MOVIES) {
  if (!s || !CATEGORIES.includes(s.category ?? 'classic')) return false;
  if (movieSetupError(movies, s)) return false;
  const prompts = [...promptsFor(s.category ?? 'classic', filterMovies(movies, s)),
    ...(s.category === 'telugu-movies' && s.period === undefined && !s.yearRange && !s.difficulties ? movies.map(movie => movie.title) : [])];
  const validDuration = Number.isInteger(s.duration) && s.duration >= 10 && s.duration <= 360;
  return [2, 4, 6, 8].includes(s.players) && validDuration &&
    ['setup', 'acting', 'scoring'].includes(s.phase) &&
    (s.team === 0 || s.team === 1) &&
    Number.isInteger(s.actor) && s.actor >= 0 && s.actor < s.players / 2 &&
    Array.isArray(s.score) && s.score.length === 2 &&
    s.score.every((n) => Number.isInteger(n) && n >= 0 && n <= 10) &&
    (s.phase === 'setup' ? s.word === '' : prompts.includes(s.word)) &&
    Array.isArray(s.wordsUsed) && s.wordsUsed.length <= prompts.length &&
    s.wordsUsed.every((word) => prompts.includes(word)) &&
    typeof s.guessedCorrect === 'boolean' &&
    Number.isFinite(s.deadline) && s.deadline >= 0 &&
    (s.phase !== 'acting' || s.deadline > 0) &&
    (s.phase === 'setup' || s.wordsUsed.includes(s.word));
}

export default {
  async render(el, game, { navigate, session, movieLibrary } = {}) {
    const shell = createShell(el, game, { title: 'Dumb Charades', meta: 'Act it out · guess it fast' });
    const showTurn = createTurnIndicator(shell.root);
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('dc-vibe');
    const movies = movieLibrary ?? await loadMovieScreen(stage);

    const saved = loadJSON(KEYS.SETTINGS + ':dumb-charades', { players: '4', timer: '60', category: 'classic' });
    const checkpoint = validCheckpoint(session?.state, movies) ? session.state : null;
    const settings = checkpoint ? { ...checkpoint, players: String(checkpoint.players), timer: String(checkpoint.duration), category: checkpoint.category ?? 'classic' } : await renderSetup(stage, {
      title: '🎭 Dumb Charades',
      subtitle: 'Set your team size and turn timer',
      themeClass: 'dc-theme',
      fields: [
        {
          key: 'players', label: 'Players',
          options: [2, 4, 6, 8].map(n => ({ value: String(n), label: `${n} Players` })),
          default: saved.players,
        },
        {
          key: 'timer', label: 'Turn timer', type: 'clock', step: 30, stepDegrees: 90, maxTurns: 3, min: 10,
          default: saved.timer ?? '60',
          help: 'Spin to any time. Quarter turns are 30 seconds, with a gentle stop at each mark; up to three turns.',
        },
        {
          key: 'category', label: 'Category',
          options: [{ value: 'classic', label: 'Classic prompts' }, { value: 'telugu-movies', label: 'Telugu movies' }],
          default: CATEGORIES.includes(saved.category) ? saved.category : 'classic',
        },
        ...movieFilterFields(saved, movies),
      ],
      validate: values => movieSetupError(movies, values),
      summary: values => values.category === 'telugu-movies' ? `${uniquePrompts(filterMovies(movies, values)).length.toLocaleString()} movies ready · ${difficultyLabel(values.difficulties)}` : '',
      startLabel: 'Start Acting',
    });
    saveJSON(KEYS.SETTINGS + ':dumb-charades', settings);
    const playerCount = Math.max(2, Math.min(8, parseInt(settings.players, 10) || 4));
    const timerDuration = parseInt(settings.timer, 10) || 60;
    const category = settings.category;
    const selectedMovies = uniquePrompts(filterMovies(movies, settings));
    const prompts = promptsFor(category, selectedMovies);
    shell.root.querySelector('.game-meta').textContent = `${playerCount} players · ${timerDuration}s per turn · ${category === 'telugu-movies' ? `Telugu movies · ${difficultyLabel(settings.difficulties ?? settings.difficulty)}` : 'Classic prompts'}`;

    let phase = 'setup'; // setup -> acting -> scoring -> next
    let currentTeam = 0, currentActor = 0;
    let score = { 0: 0, 1: 0 };
    let currentWord = '', timeLeft = timerDuration, timer = null;
    let wordsUsed = [], guessedCorrect = false, deadline = 0;

    function checkpointGame() {
      if (phase === 'gameover') { session?.finish(); return; }
      session?.save({
        players: playerCount, duration: timerDuration, category,
        period: settings.period, fromYear: settings.fromYear, toYear: settings.toYear, difficulty: settings.difficulty,
        yearRange: settings.yearRange, difficulties: settings.difficulties,
        phase, team: currentTeam,
        actor: currentActor, score: [score[0], score[1]], word: currentWord,
        wordsUsed: [...wordsUsed], guessedCorrect, deadline,
      });
    }

    const card = document.createElement('div');
    card.className = 'dc-card';
    stage.appendChild(card);

    const status = document.createElement('div');
    status.className = 'dc-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    stage.appendChild(status);

    function render() {
      const actor = currentTeam * (playerCount / 2) + currentActor;
      showTurn(actor, phase === 'setup' || phase === 'acting',
        `Team ${currentTeam + 1} · ${playerName(actor)}`);
      card.innerHTML = '';
      status.textContent = phase === 'gameover' ? '' : `Team 1: ${score[0]} · Team 2: ${score[1]}`;
      if (phase === 'setup') {
        card.innerHTML = `
          <div class="dc-setup">
            <h3>Team ${currentTeam + 1} — Actor: Player ${currentActor + 1}</h3>
            <p class="dc-hint">Pass device to actor. Tap "Show Word" when ready.</p>
            <button class="dc-btn" id="showWord">Show Word</button>
          </div>`;
        card.querySelector('#showWord').addEventListener('click', startActing);
      } else if (phase === 'acting') {
        card.innerHTML = `
          <div class="dc-acting">
            <h3>Act This Out:</h3>
            <p class="dc-word">${escapeHTML(currentWord)}</p>
            <div class="dc-timer-display">${timeLeft}s</div>
            <button class="dc-btn" id="guessed">Team Guessed It!</button>
            <button class="dc-btn dc-btn-secondary" id="skip">Skip</button>
            <p class="dc-hint">No speaking! No mouthing words!</p>
            ${movieBrief(movieFor(category, currentWord, selectedMovies), { compact: true })}
          </div>`;
        card.querySelector('#guessed').addEventListener('click', () => guessed(true));
        card.querySelector('#skip').addEventListener('click', () => guessed(false));
      } else if (phase === 'scoring') {
        const movie = movieFor(category, currentWord, selectedMovies);
        card.innerHTML = `
          <div class="dc-scoring">
            <h3>${guessedCorrect ? '✅ Correct!' : '❌ Skipped'}</h3>
            <p>The word was: <strong>${escapeHTML(currentWord)}</strong></p>
            ${movieDetails(movie)}
            <p>Team ${currentTeam + 1} score: ${score[currentTeam]}</p>
            <button class="dc-btn" id="nextTurn">${currentTeam === 1 ? 'Next Round' : 'Switch Teams'}</button>
          </div>`;
        card.querySelector('#nextTurn').addEventListener('click', nextTurn);
      } else if (phase === 'gameover') {
        const winner = score[0] > score[1] ? 1 : (score[1] > score[0] ? 2 : 0);
        card.innerHTML = `
          <div class="dc-gameover">
            <h3>${winner ? `🎉 Team ${winner} Wins!` : '🤝 Tie Game!'}</h3>
            <p>Final Score: Team 1: ${score[0]} — Team 2: ${score[1]}</p>
            <button class="dc-btn" id="playAgain">Play Again</button>
          </div>`;
        card.querySelector('#playAgain').addEventListener('click', newGame);
      }
    }

    function newGame() {
      shell.root.querySelector('.arcade-victory')?.remove();
      clearInterval(timer);
      score = { 0: 0, 1: 0 };
      currentTeam = 0; currentActor = 0;
      wordsUsed = []; guessedCorrect = false;
      currentWord = ''; deadline = 0; timeLeft = timerDuration;
      phase = 'setup';
      checkpointGame();
      render();
    }

    function getRandomWord() {
      const available = prompts.filter(w => !wordsUsed.includes(w));
      if (available.length === 0) wordsUsed = [];
      const choices = available.length ? available : prompts;
      const w = choices[Math.floor(Math.random() * choices.length)];
      wordsUsed.push(w);
      return w;
    }

    function startActing() {
      currentWord = getRandomWord();
      timeLeft = timerDuration;
      deadline = Date.now() + timerDuration * 1000;
      phase = 'acting';
      checkpointGame();
      render();
      startTimer();
    }

    function startTimer() {
      clearInterval(timer);
      function tick() {
        if (phase !== 'acting') return;
        timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const el = card.querySelector('.dc-timer-display');
        if (el) el.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
          clearInterval(timer);
          guessed(false);
        }
      }
      tick();
      if (phase === 'acting') timer = setInterval(tick, 250);
    }

    function guessed(correct) {
      clearInterval(timer);
      guessedCorrect = correct;
      if (correct) {
        score[currentTeam]++;
        if (window.arcadeAudio) { window.arcadeAudio.prepare(); window.arcadeAudio.chime(); }
        if (window.haptics) window.haptics.success();
      } else {
        if (window.arcadeAudio) { window.arcadeAudio.prepare(); window.arcadeAudio.buzz(); }
        if (window.haptics) window.haptics.failure();
      }
      phase = 'scoring';
      deadline = 0;
      checkpointGame();
      render();
    }

    function nextTurn() {
      currentTeam = 1 - currentTeam;
      if (currentTeam === 0) {
        currentActor = (currentActor + 1) % Math.ceil(playerCount / 2);
        const totalGuessed = score[0] + score[1];
        if (totalGuessed >= 10) {
          phase = 'gameover';
          const winner = score[0] > score[1] ? 1 : score[1] > score[0] ? 2 : 0;
          if (winner) celebrate(shell.root, `Team ${winner} wins Charades!`);
          checkpointGame(); render(); return;
        }
      }
      phase = 'setup';
      currentWord = '';
      checkpointGame();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => { if (phase === 'acting') timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); render(); };
    window.addEventListener('arcade:themechange', onTheme);
    if (checkpoint) {
      currentTeam = checkpoint.team; currentActor = checkpoint.actor;
      score = { 0: checkpoint.score[0], 1: checkpoint.score[1] };
      currentWord = checkpoint.word; wordsUsed = [...checkpoint.wordsUsed];
      guessedCorrect = checkpoint.guessedCorrect; deadline = checkpoint.deadline;
      phase = checkpoint.phase;
      timeLeft = phase === 'acting' ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : timerDuration;
      if (phase === 'acting' && !timeLeft) guessed(false);
      else { render(); if (phase === 'acting') startTimer(); }
    } else newGame();
    return { dispose: () => { clearInterval(timer); window.removeEventListener('arcade:themechange', onTheme); } };
  },
};
