import { playerName } from './player-names.js';
import { seat } from './remote-match.js';

export function createTurnIndicator(root, match = null) {
  const banner = document.createElement('div');
  banner.className = 'arcade-turn';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.hidden = true;
  root.querySelector('.game-head').after(banner);
  let previous;

  return (current, active = true) => {
    if (!active || !Number.isInteger(current) || current < 0) {
      banner.hidden = true;
      previous = null;
      return;
    }
    const mine = !match || seat(match) === current + 1;
    banner.hidden = false;
    banner.classList.toggle('arcade-turn--mine', mine);
    banner.textContent = match
      ? mine ? `Your turn · ${playerName(current, match)}` :
        `${playerName(current, match)}'s turn · Waiting for your turn`
      : `${playerName(current)}'s turn`;
    if (previous !== undefined && previous !== current && mine) {
      window.arcadeAudio?.chime();
      window.haptics?.select();
    }
    previous = current;
  };
}
