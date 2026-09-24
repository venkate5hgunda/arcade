const EMBLEMS = [
  '<path d="M24 5 8 12v12c0 11 8 17 16 20 8-3 16-9 16-20V12Z"/><path d="M24 13v22M15 24h18" fill="none" stroke="#1b3040" stroke-width="3"/>',
  '<path d="M24 5 43 24 24 43 5 24Z"/><path d="m24 11 13 13-13 13-13-13Z" fill="none" stroke="#1b3040" stroke-width="3"/>',
  '<path d="m24 4 5.6 12.8 14 1.6-10.5 9.4 3 14-12.1-7.3-12.1 7.3 3-14L4.4 18.4l14-1.6Z"/>',
  '<path d="M5 15 14 23 23 8 32 23 43 15 39 38H9Z"/><path d="M11 34h26" fill="none" stroke="#1b3040" stroke-width="3"/>',
];

export function decorateBoardToken(element, player, number) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('board-token-icon');
  icon.setAttribute('viewBox', '0 0 48 48');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = EMBLEMS[player];
  const badge = document.createElement('span');
  badge.className = 'board-token-number';
  badge.textContent = number;
  element.append(icon, badge);
  return element;
}

export function boardCellPoint(board, cell) {
  const boardRect = board.getBoundingClientRect();
  const rect = cell.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - boardRect.left - board.clientLeft,
    y: rect.top + rect.height / 2 - boardRect.top - board.clientTop,
  };
}

export async function travelBoardToken(board, token, segments, signal, onArrive) {
  if (signal.aborted) return false;
  if (!token.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    for (const segment of segments) onArrive?.(segment);
    return true;
  }
  const sprite = token.cloneNode(true);
  sprite.classList.add('board-traveler');
  sprite.classList.remove('ld-piece-ready');
  sprite.disabled = true;
  sprite.setAttribute('aria-hidden', 'true');
  board.appendChild(sprite);
  token.style.visibility = 'hidden';
  try {
    for (const segment of segments) {
      if (signal.aborted) return false;
      const { points, duration, kind = 'step' } = segment;
      sprite.dataset.motion = kind;
      const frames = points.map(({ x, y }, i) => ({
        offset: i / (points.length - 1),
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${kind === 'snake' ? .48 + .52 * Math.pow(Math.abs(2 * i / (points.length - 1) - 1), 2) : 1})`,
      }));
      const animation = sprite.animate(frames, {
        duration, fill: 'forwards',
        easing: kind === 'ladder' ? 'cubic-bezier(.25,.05,.3,1)' : 'ease-in-out',
      });
      const abort = () => animation.cancel();
      signal.addEventListener('abort', abort, { once: true });
      try { await animation.finished; }
      catch (error) {
        if (signal.aborted) return false;
        throw error;
      } finally {
        signal.removeEventListener('abort', abort);
      }
      onArrive?.(segment);
    }
    return true;
  } finally {
    token.style.visibility = '';
    sprite.remove();
  }
}
