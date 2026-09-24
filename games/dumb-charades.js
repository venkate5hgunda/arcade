// Dumb Charades — act it, guess it. 2-8 players in teams.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { TELUGU_MOVIES } from '../js/party-prompts.js';

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
const promptsFor = (category) => category === 'telugu-movies' ? TELUGU_MOVIES.map(movie => movie.title) : WORDS;
const movieFor = (category, title) => category === 'telugu-movies' ? TELUGU_MOVIES.find(movie => movie.title === title) : null;

export function validCheckpoint(s) {
  if (!s || !CATEGORIES.includes(s.category ?? 'classic')) return false;
  const prompts = promptsFor(s.category ?? 'classic');
  return [2, 4, 6, 8].includes(s.players) && [30, 45, 60, 90].includes(s.duration) &&
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
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Dumb Charades', meta: 'Act it out · guess it fast' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('dc-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':dumb-charades', { players: '4', timer: '60', category: 'classic' });
    const checkpoint = validCheckpoint(session?.state) ? session.state : null;
    const settings = checkpoint ? { players: String(checkpoint.players), timer: String(checkpoint.duration), category: checkpoint.category ?? 'classic' } : await renderSetup(stage, {
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
          key: 'timer', label: 'Turn Timer',
          options: [30, 45, 60, 90].map(n => ({ value: String(n), label: `${n}s` })),
          default: saved.timer,
        },
        {
          key: 'category', label: 'Category',
          options: [{ value: 'classic', label: 'Classic prompts' }, { value: 'telugu-movies', label: 'Telugu movies' }],
          default: CATEGORIES.includes(saved.category) ? saved.category : 'classic',
        },
      ],
      startLabel: 'Start Acting',
    });
    saveJSON(KEYS.SETTINGS + ':dumb-charades', settings);
    const playerCount = Math.max(2, Math.min(8, parseInt(settings.players, 10) || 4));
    const timerDuration = parseInt(settings.timer, 10) || 60;
    const category = settings.category;
    const prompts = promptsFor(category);
    shell.root.querySelector('.game-meta').textContent = `${playerCount} players · ${timerDuration}s per turn · ${category === 'telugu-movies' ? 'Telugu movies' : 'Classic prompts'}`;

    let phase = 'setup'; // setup -> acting -> scoring -> next
    let currentTeam = 0, currentActor = 0;
    let score = { 0: 0, 1: 0 };
    let currentWord = '', timeLeft = timerDuration, timer = null;
    let wordsUsed = [], guessedCorrect = false, deadline = 0;

    function checkpointGame() {
      if (phase === 'gameover') { session?.finish(); return; }
      session?.save({
        players: playerCount, duration: timerDuration, category, phase, team: currentTeam,
        actor: currentActor, score: [score[0], score[1]], word: currentWord,
        wordsUsed: [...wordsUsed], guessedCorrect, deadline,
      });
    }

    const card = document.createElement('div');
    card.className = 'dc-card';
    stage.appendChild(card);

    const status = document.createElement('div');
    status.className = 'dc-status';
    stage.appendChild(status);

    function render() {
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
            <p class="dc-word">${currentWord}</p>
            <p class="dc-hint">No speaking! No mouthing words!</p>
            <div class="dc-timer-display">${timeLeft}s</div>
            <button class="dc-btn" id="guessed">Team Guessed It!</button>
            <button class="dc-btn dc-btn-secondary" id="skip">Skip</button>
          </div>`;
        card.querySelector('#guessed').addEventListener('click', () => guessed(true));
        card.querySelector('#skip').addEventListener('click', () => guessed(false));
      } else if (phase === 'scoring') {
        const movie = movieFor(category, currentWord);
        card.innerHTML = `
          <div class="dc-scoring">
            <h3>${guessedCorrect ? '✅ Correct!' : '❌ Skipped'}</h3>
            <p>The word was: <strong>${currentWord}</strong></p>
            ${movie ? `<p>${movie.year} · ${movie.cast}</p><p>${movie.story}</p>` : ''}
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
        if (totalGuessed >= 10) { phase = 'gameover'; checkpointGame(); render(); return; }
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
