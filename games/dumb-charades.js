// Dumb Charades — act it, guess it. 2-8 players in teams.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack } from '../js/game-shell.js';
import { loadJSON, KEYS } from '../js/storage.js';

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

export default {
  render(el, game, { navigate } = {}) {
    const settings = loadJSON(KEYS.SETTINGS + ':dumb-charades', { players: 4, timer: 60 });
    const playerCount = Math.max(2, Math.min(8, settings.players || 4));
    const timerDuration = settings.timer || 60;

    const shell = createShell(el, game, {
      title: 'Dumb Charades',
      meta: `${playerCount} players · ${timerDuration}s per turn`,
    });
    const { stage, getResetButton, getBackButton } = shell;

    if (navigate) wireBack(shell, navigate);

    let phase = 'setup'; // setup -> acting -> scoring -> next
    let currentTeam = 0, currentActor = 0;
    let score = { 0: 0, 1: 0 };
    let currentWord = '', timeLeft = timerDuration, timer = null;
    let wordsUsed = [], guessedCorrect = false;

    const card = document.createElement('div');
    card.className = 'dc-card';
    stage.appendChild(card);

    const timerEl = document.createElement('div');
    timerEl.className = 'dc-timer';
    stage.appendChild(timerEl);

    const status = document.createElement('div');
    status.className = 'dc-status';
    stage.appendChild(status);

    function render() {
      card.innerHTML = '';
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
        card.innerHTML = `
          <div class="dc-scoring">
            <h3>${guessedCorrect ? '✅ Correct!' : '❌ Skipped'}</h3>
            <p>The word was: <strong>${currentWord}</strong></p>
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
      score = { 0: 0, 1: 0 };
      currentTeam = 0; currentActor = 0;
      wordsUsed = []; guessedCorrect = false;
      phase = 'setup';
      render();
    }

    function getRandomWord() {
      const available = WORDS.filter(w => !wordsUsed.includes(w));
      if (available.length === 0) { wordsUsed = []; return WORDS[Math.floor(Math.random() * WORDS.length)]; }
      const w = available[Math.floor(Math.random() * available.length)];
      wordsUsed.push(w);
      return w;
    }

    function startActing() {
      currentWord = getRandomWord();
      timeLeft = timerDuration;
      phase = 'acting';
      render();
      startTimer();
    }

    function startTimer() {
      timerEl.textContent = `${timeLeft}s`;
      timer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
          clearInterval(timer);
          guessed(false);
        }
      }, 1000);
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
      render();
    }

    function nextTurn() {
      currentTeam = 1 - currentTeam;
      if (currentTeam === 0) {
        currentActor = (currentActor + 1) % Math.ceil(playerCount / 2);
        const totalGuessed = score[0] + score[1];
        if (totalGuessed >= 10) { phase = 'gameover'; render(); return; }
      }
      phase = 'setup';
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => { clearInterval(timer); window.removeEventListener('arcade:themechange', onTheme); } };
  },
};
