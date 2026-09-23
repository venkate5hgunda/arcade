// Imposter — find the spy among you. 3-8 players.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack } from '../js/game-shell.js';
import { loadJSON, KEYS } from '../js/storage.js';

const WORD_PAIRS = [
  { word: 'COFFEE', clue: 'Hot drink' },
  { word: 'PIZZA', clue: 'Italian food' },
  { word: 'GUITAR', clue: 'String instrument' },
  { word: 'SOCCER', clue: 'Ball sport' },
  { word: 'LAPTOP', clue: 'Portable computer' },
  { word: 'SUNGLASSES', clue: 'Eye wear' },
  { word: 'BACKPACK', clue: 'Carry bag' },
  { word: 'SMARTPHONE', clue: 'Mobile device' },
  { word: 'BICYCLE', clue: 'Two wheels' },
  { word: 'CAMERA', clue: 'Photo device' },
  { word: 'HEADPHONES', clue: 'Audio gear' },
  { word: 'WALLET', clue: 'Money holder' },
  { word: 'UMBRELLA', clue: 'Rain shield' },
  { word: 'KEYBOARD', clue: 'Typing tool' },
  { word: 'MICROWAVE', clue: 'Kitchen appliance' },
  { word: 'TELESCOPE', clue: 'Star viewer' },
  { word: 'MICROSCOPE', clue: 'Tiny viewer' },
  { word: 'HAMMOCK', clue: 'Outdoor bed' },
  { word: 'LANTERN', clue: 'Light source' },
  { word: 'COMPASS', clue: 'Direction finder' },
];

export default {
  render(el, game, { navigate } = {}) {
    const settings = loadJSON(KEYS.SETTINGS + ':imposter', { players: 4 });
    const playerCount = Math.max(3, Math.min(8, settings.players || 4));

    const shell = createShell(el, game, {
      title: 'Imposter',
      meta: `${playerCount} players · Pass device · One spy`,
    });
    const { stage, getResetButton, getBackButton } = shell;

    if (navigate) wireBack(shell, navigate);

    let phase = 'setup'; // setup -> reveal -> discuss -> vote -> result
    let currentPlayer = 0;
    let imposterIndex = -1;
    let word = '', clue = '';
    let votes = [];

    const card = document.createElement('div');
    card.className = 'imp-card';
    stage.appendChild(card);

    const status = document.createElement('div');
    status.className = 'imp-status';
    stage.appendChild(status);

    function render() {
      card.innerHTML = '';
      if (phase === 'setup') {
        card.innerHTML = `
          <div class="imp-setup">
            <h3>Pass the device to Player ${currentPlayer + 1}</h3>
            <p class="imp-hint">Tap "Show My Card" when ready</p>
            <button class="imp-btn" id="showCard">Show My Card</button>
          </div>`;
        card.querySelector('#showCard').addEventListener('click', showCard);
      } else if (phase === 'reveal') {
        const isImposter = currentPlayer === imposterIndex;
        card.innerHTML = `
          <div class="imp-reveal ${isImposter ? 'imposter' : ''}">
            <h3>Player ${currentPlayer + 1}</h3>
            ${isImposter ? `
              <p class="imp-role">🕵️ YOU ARE THE IMPOSTER</p>
              <p class="imp-clue">Clue: ${clue}</p>
              <p class="imp-hint">Blend in! Don't let them catch you.</p>
            ` : `
              <p class="imp-role">👤 YOU ARE A PLAYER</p>
              <p class="imp-word">Word: <strong>${word}</strong></p>
              <p class="imp-hint">Convince others you know the word.</p>
            `}
            <button class="imp-btn" id="nextPlayer">${currentPlayer < playerCount - 1 ? 'Pass to Next Player' : 'Start Discussion'}</button>
          </div>`;
        card.querySelector('#nextPlayer').addEventListener('click', nextPlayerReveal);
      } else if (phase === 'discuss') {
        card.innerHTML = `
          <div class="imp-discuss">
            <h3>Discussion Phase</h3>
            <p>Everyone talks about the word. The imposter must pretend to know it.</p>
            <button class="imp-btn" id="startVote">Start Voting</button>
          </div>`;
        card.querySelector('#startVote').addEventListener('click', startVote);
      } else if (phase === 'vote') {
        card.innerHTML = `
          <div class="imp-vote">
            <h3>Vote for the Imposter</h3>
            <p>Player ${currentPlayer + 1}, select who you think is the imposter:</p>
            <div class="imp-vote-options">
              ${Array.from({ length: playerCount }, (_, i) => `
                <button class="imp-vote-btn ${votes[currentPlayer] === i ? 'selected' : ''}" data-vote="${i}" ${i === currentPlayer ? 'disabled' : ''}>
                  Player ${i + 1}
                </button>
              `).join('')}
            </div>
            <button class="imp-btn" id="submitVote" ${votes[currentPlayer] === undefined ? 'disabled' : ''}>Submit Vote</button>
          </div>`;
        card.querySelectorAll('.imp-vote-btn').forEach(btn => {
          btn.addEventListener('click', () => selectVote(parseInt(btn.dataset.vote)));
        });
        card.querySelector('#submitVote').addEventListener('click', submitVote);
      } else if (phase === 'result') {
        const voteCounts = Array(playerCount).fill(0);
        votes.forEach(v => { if (v !== undefined) voteCounts[v]++; });
        const maxVotes = Math.max(...voteCounts);
        const votedOut = voteCounts.indexOf(maxVotes);
        const imposterCaught = votedOut === imposterIndex;
        const tie = voteCounts.filter(v => v === maxVotes).length > 1;

        card.innerHTML = `
          <div class="imp-result ${imposterCaught ? 'win' : 'lose'}">
            <h3>${imposterCaught && !tie ? '🎉 Imposter Caught!' : tie ? '🤝 Tie - Imposter Escapes!' : '🕵️ Imposter Escapes!'}</h3>
            <p>The imposter was <strong>Player ${imposterIndex + 1}</strong>.</p>
            <p>The word was: <strong>${word}</strong></p>
            <p>Clue: ${clue}</p>
            <div class="imp-vote-breakdown">
              ${voteCounts.map((c, i) => `<span class="imp-vote-bar" style="--count:${c}; --max:${maxVotes}"><span>P${i + 1}</span><strong>${c}</strong></span>`).join('')}
            </div>
            <button class="imp-btn" id="playAgain">Play Again</button>
          </div>`;
        card.querySelector('#playAgain').addEventListener('click', newGame);
      }
    }

    function newGame() {
      const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
      word = pair.word; clue = pair.clue;
      imposterIndex = Math.floor(Math.random() * playerCount);
      currentPlayer = 0;
      phase = 'setup';
      votes = Array(playerCount).fill(undefined);
      render();
    }

    function showCard() {
      phase = 'reveal';
      render();
    }

    function nextPlayerReveal() {
      if (currentPlayer < playerCount - 1) {
        currentPlayer++;
        phase = 'setup';
      } else {
        phase = 'discuss';
        currentPlayer = 0;
      }
      render();
    }

    function startVote() {
      phase = 'vote';
      currentPlayer = 0;
      render();
    }

    function selectVote(vote) {
      votes[currentPlayer] = vote;
      render();
    }

    function submitVote() {
      if (currentPlayer < playerCount - 1) {
        currentPlayer++;
      } else {
        phase = 'result';
      }
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
