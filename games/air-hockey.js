// Air Hockey — fast two-player puck battle on a glowing table.
// Canvas-based for smooth physics. Listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Air Hockey', meta: 'Two players · glowing rink' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ah-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':air-hockey', { target: '7' });
    const settings = await renderSetup(stage, {
      title: '🏒 Air Hockey',
      subtitle: 'First to score wins — pick the target',
      themeClass: 'ah-theme',
      fields: [{
        key: 'target', label: 'Winning score',
        options: [
          { value: '5', label: 'First to 5' },
          { value: '7', label: 'First to 7' },
          { value: '10', label: 'First to 10' },
        ],
        default: saved.target,
      }],
      startLabel: 'Drop the Puck',
    });
    saveJSON(KEYS.SETTINGS + ':air-hockey', settings);
    const winTarget = parseInt(settings.target, 10) || 7;
    shell.root.querySelector('.game-meta').textContent = `Two players · First to ${winTarget} wins · P1 ↑↓ · P2 W/S`;

    const canvas = document.createElement('canvas');
    canvas.className = 'ah-canvas';
    stage.appendChild(canvas);

    const status = document.createElement('div');
    status.className = 'ah-status';
    stage.appendChild(status);

    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, dpr = 1;

    // Game state
    const puck = { x: 0, y: 0, vx: 0, vy: 0, r: 0 };
    const paddles = [
      { x: 0, y: 0, r: 0, vy: 0, score: 0, color: '#ff5a3c' }, // Player 1 (bottom)
      { x: 0, y: 0, r: 0, vy: 0, score: 0, color: '#38bdf8' }, // Player 2 (top)
    ];
    const keys = { w: false, s: false, ArrowUp: false, ArrowDown: false };
    let gameOver = false, winner = null, animating = false;
    let lastTime = 0;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = stage.getBoundingClientRect();
      width = Math.min(rect.width, 600);
      height = width * 1.6; // 5:8 aspect ratio
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Puck radius ~ 3% of width
      puck.r = width * 0.03;
      puck.x = width / 2;
      puck.y = height / 2;

      // Paddle radius ~ 6% of width
      const pr = width * 0.06;
      paddles[0].r = pr; paddles[1].r = pr;
      paddles[0].x = width / 2; paddles[0].y = height - pr - 10;
      paddles[1].x = width / 2; paddles[1].y = pr + 10;
    }

    function resetPuck(toward = 1) {
      puck.x = width / 2;
      puck.y = height / 2;
      const angle = (toward === 1 ? Math.PI : 0) + (Math.random() - 0.5) * 0.5;
      const speed = width * 0.008;
      puck.vx = Math.cos(angle) * speed;
      puck.vy = Math.sin(angle) * speed;
    }

    function newGame() {
      paddles[0].score = 0; paddles[1].score = 0;
      gameOver = false; winner = null;
      status.textContent = '';
      resetPuck();
      render();
    }

    function draw() {
      // Clear
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-soft').trim() || '#fff';
      ctx.fillRect(0, 0, width, height);

      // Center line
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#ddd';
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center circle
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, width * 0.15, 0, Math.PI * 2);
      ctx.stroke();

      // Goals (top and bottom)
      const goalW = width * 0.4;
      ctx.fillStyle = 'rgba(255,90,60,0.1)';
      ctx.fillRect((width - goalW) / 2, 0, goalW, 20);
      ctx.fillStyle = 'rgba(56,189,248,0.1)';
      ctx.fillRect((width - goalW) / 2, height - 20, goalW, 20);

      // Paddles
      for (const p of paddles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Puck
      const theme = document.documentElement.getAttribute('data-theme');
      ctx.fillStyle = theme === 'dark' ? '#eef1f6' : '#1a1d23';
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
      ctx.fill();
      // Puck highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(puck.x - puck.r * 0.2, puck.y - puck.r * 0.2, puck.r * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Scores
      ctx.font = `bold ${width * 0.08}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillStyle = paddles[0].color;
      ctx.fillText(paddles[0].score, width / 2, height * 0.75);
      ctx.fillStyle = paddles[1].color;
      ctx.fillText(paddles[1].score, width / 2, height * 0.25);
    }

    function update(dt) {
      if (gameOver) return;

      // Paddle movement (keyboard for now)
      const paddleSpeed = width * 0.015 * dt;
      if (keys.w) paddles[1].y = Math.max(paddles[1].r + 5, paddles[1].y - paddleSpeed);
      if (keys.s) paddles[1].y = Math.min(height / 2 - paddles[1].r - 5, paddles[1].y + paddleSpeed);
      if (keys.ArrowUp) paddles[0].y = Math.max(height / 2 + paddles[0].r + 5, paddles[0].y - paddleSpeed);
      if (keys.ArrowDown) paddles[0].y = Math.min(height - paddles[0].r - 5, paddles[0].y + paddleSpeed);

      // Puck physics
      puck.x += puck.vx * dt;
      puck.y += puck.vy * dt;

      // Wall collisions (left/right)
      if (puck.x - puck.r < 0) { puck.x = puck.r; puck.vx *= -1; }
      if (puck.x + puck.r > width) { puck.x = width - puck.r; puck.vx *= -1; }

      // Paddle collisions
      for (let i = 0; i < 2; i++) {
        const p = paddles[i];
        const dx = puck.x - p.x;
        const dy = puck.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < puck.r + p.r) {
          // Push puck out
          const overlap = puck.r + p.r - dist;
          const nx = dx / dist || 1;
          const ny = dy / dist || 0;
          puck.x += nx * overlap;
          puck.y += ny * overlap;
          // Reflect with paddle velocity influence
          puck.vx = nx * Math.abs(puck.vx) * 1.05;
          puck.vy = ny * Math.abs(puck.vy) * 1.05 + p.vy * 0.5;
          // Clamp speed
          const maxSpeed = width * 0.02;
          const speed = Math.hypot(puck.vx, puck.vy);
          if (speed > maxSpeed) { puck.vx = puck.vx / speed * maxSpeed; puck.vy = puck.vy / speed * maxSpeed; }
        }
      }

      // Goal detection (top/bottom)
      const goalW = width * 0.4;
      const goalLeft = (width - goalW) / 2;
      const goalRight = goalLeft + goalW;

      if (puck.y - puck.r < 20 && puck.x > goalLeft && puck.x < goalRight) {
        // Player 1 scores (bottom)
        paddles[0].score++;
        if (window.arcadeAudio) { window.arcadeAudio.prepare(); window.arcadeAudio.goal(); }
        if (window.haptics) window.haptics.success();
        checkWin();
      } else if (puck.y + puck.r > height - 20 && puck.x > goalLeft && puck.x < goalRight) {
        // Player 2 scores (top)
        paddles[1].score++;
        if (window.arcadeAudio) { window.arcadeAudio.prepare(); window.arcadeAudio.goal(); }
        if (window.haptics) window.haptics.success();
        checkWin();
      } else if (puck.y - puck.r < 0 || puck.y + puck.r > height) {
        // Hit post - bounce
        if (puck.y < 0) { puck.y = puck.r; puck.vy *= -1; }
        if (puck.y > height) { puck.y = height - puck.r; puck.vy *= -1; }
      }

      // Friction
      puck.vx *= 0.998;
      puck.vy *= 0.998;
    }

    function checkWin() {
      if (paddles[0].score >= winTarget) {
        gameOver = true; winner = 0;
        status.textContent = '🎉 Player 1 wins!';
        if (window.arcadeAudio) window.arcadeAudio.chime();
        if (window.haptics) window.haptics.success();
      } else if (paddles[1].score >= winTarget) {
        gameOver = true; winner = 1;
        status.textContent = '🎉 Player 2 wins!';
        if (window.arcadeAudio) window.arcadeAudio.chime();
        if (window.haptics) window.haptics.success();
      } else { resetPuck(winner === 0 ? 2 : 1); }
    }

    function loop(time) {
      if (!animating) return;
      const dt = Math.min((time - lastTime) / 16, 2); // cap at 2 frames
      lastTime = time;
      update(dt);
      draw();
      requestAnimationFrame(loop);
    }

    function render() {
      draw();
    }

    // Input
    window.addEventListener('keydown', (e) => { if (e.key in keys) keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

    // Touch for mobile
    let touchId1 = null, touchId2 = null;
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const y = touch.clientY - canvas.getBoundingClientRect().top;
        if (y > height / 2) { // Bottom half - player 1
          touchId1 = touch.identifier;
        } else { // Top half - player 2
          touchId2 = touch.identifier;
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const x = touch.clientX - canvas.getBoundingClientRect().left;
        const y = touch.clientY - canvas.getBoundingClientRect().top;
        if (touch.identifier === touchId1) {
          paddles[0].x = Math.max(paddles[0].r, Math.min(width - paddles[0].r, x));
          paddles[0].y = Math.max(height / 2 + paddles[0].r + 5, Math.min(height - paddles[0].r - 5, y));
        } else if (touch.identifier === touchId2) {
          paddles[1].x = Math.max(paddles[1].r, Math.min(width - paddles[1].r, x));
          paddles[1].y = Math.max(paddles[1].r + 5, Math.min(height / 2 - paddles[1].r - 5, y));
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchId1) touchId1 = null;
        if (touch.identifier === touchId2) touchId2 = null;
      }
    });

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => { resize(); render(); };
    window.addEventListener('arcade:themechange', onTheme);
    window.addEventListener('resize', () => { resize(); render(); });

    resize();
    animating = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
    newGame();

    return { dispose: () => { animating = false; window.removeEventListener('arcade:themechange', onTheme); } };
  },
};
