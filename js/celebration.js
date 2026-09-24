export function celebrate(root, title) {
  if (!(root instanceof Element) || typeof title !== 'string' || !title.trim())
    throw new TypeError('A game and victory announcement are required.');
  const stage = root.querySelector('.game-stage');
  if (!stage) throw new Error('Cannot celebrate without a game stage.');
  stage.querySelector('.arcade-victory')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'arcade-victory';
  const banner = document.createElement('p');
  banner.className = 'arcade-victory-banner';
  banner.setAttribute('role', 'status');
  banner.textContent = `🏆 ${title}`;
  overlay.appendChild(banner);

  if (!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    const pieces = document.createElement('div');
    pieces.className = 'arcade-confetti';
    pieces.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 36; i++) {
      const bit = document.createElement('i');
      bit.style.setProperty('--x', `${Math.random() * 100}%`);
      bit.style.setProperty('--delay', `${Math.random() * 0.8}s`);
      bit.style.setProperty('--duration', `${2.1 + Math.random() * 1.1}s`);
      bit.style.setProperty('--color', ['#f8c757', '#ff6585', '#53cfb5', '#91a9fb'][i % 4]);
      pieces.appendChild(bit);
    }
    overlay.appendChild(pieces);
  }
  stage.appendChild(overlay);
  const audio = window.arcadeAudio;
  if (audio) {
    if (audio.context) audio.goal();
    else void audio.prepare().then(() => audio.goal())
      .catch(error => console.warn('Victory sound unavailable:', error));
  }
  window.haptics?.success();
  window.setTimeout(() => overlay.remove(), 4400);
}
