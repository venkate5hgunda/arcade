// Two-player air hockey; fixed world coordinates keep touch, desktop and HiDPI
// play identical. Both puck and moving paddles use the shared disc solver.
import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { canvasPoint, clamp, createFixedStepper, stepDiscs } from '../js/disc-physics.js';

const W = 600, H = 900;
const GOAL_LEFT = 195, GOAL_RIGHT = 405;
const BOUNDS = { left: 23, right: 577, top: -10000, bottom: 10000 };
const PADDLE_SPEED = 690;

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Air Hockey', meta: 'Two players · first to 7' });
    const { stage } = shell;
    shell.root.classList.add('ah-vibe');
    if (navigate) wireBack(shell, navigate);
    const saved = loadJSON(KEYS.SETTINGS + ':air-hockey', { target: '7' });
    const settings = await renderSetup(stage, {
      title: '🏒 Air Hockey',
      subtitle: 'Player 1 defends the bottom; Player 2 defends the top.',
      themeClass: 'ah-theme',
      fields: [{
        key: 'target', label: 'Winning score',
        options: [5, 7, 10].map((n) => ({ value: String(n), label: `First to ${n}` })),
        default: saved.target,
      }],
      startLabel: 'Drop the Puck',
    });
    saveJSON(KEYS.SETTINGS + ':air-hockey', settings);
    const target = Number(settings.target) || 7;
    shell.root.querySelector('.game-meta').textContent = `First to ${target} · P1 arrows · P2 WASD`;

    const canvas = document.createElement('canvas');
    canvas.className = 'ah-canvas';
    canvas.width = W; canvas.height = H;
    canvas.setAttribute('aria-label', 'Air hockey table: player 1 at bottom, player 2 at top. Touch or drag paddles on your half, or use arrow keys and WASD.');
    const status = document.createElement('div');
    status.className = 'ah-status';
    status.setAttribute('aria-live', 'polite');
    const help = document.createElement('p');
    help.className = 'ah-help';
    help.textContent = 'P1 (bottom): arrow keys · P2 (top): WASD · Drag each paddle with a finger or mouse.';
    stage.append(canvas, status, help);
    const ctx = canvas.getContext('2d');
    const puck = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 17 };
    const paddles = [
      { x: W / 2, y: 740, vx: 0, vy: 0, r: 37, invMass: 0, score: 0, color: '#ff6747' },
      { x: W / 2, y: 160, vx: 0, vy: 0, r: 37, invMass: 0, score: 0, color: '#57d4f6' },
    ];
    const pointers = [null, null];
    const positions = [null, null];
    const keys = new Set();
    let winner = null, disposed = false, raf;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function serve(toward = 0) {
      puck.x = W / 2; puck.y = H / 2;
      puck.vx = (Math.random() - .5) * 160;
      puck.vy = (toward === 0 ? 1 : -1) * 340;
    }
    function updateStatus(text = '') {
      status.textContent = winner === null
        ? `P1 ${paddles[0].score} : ${paddles[1].score} P2${text ? ` · ${text}` : ''}`
        : `🏆 Player ${winner + 1} wins! ${paddles[0].score} – ${paddles[1].score}`;
    }
    function reset() {
      winner = null;
      for (const [i, p] of paddles.entries()) {
        p.score = 0; p.x = W / 2; p.y = i ? 160 : 740; p.vx = p.vy = 0;
        positions[i] = null;
      }
      serve();
      stepper.reset();
      updateStatus();
      draw();
    }
    function goal(scorer) {
      paddles[scorer].score++;
      window.arcadeAudio?.prepare().then(() => window.arcadeAudio?.goal());
      window.haptics?.success();
      if (paddles[scorer].score >= target) {
        winner = scorer;
        puck.vx = puck.vy = 0;
        window.arcadeAudio?.chime();
      } else serve(1 - scorer);
      updateStatus(winner === null ? `Player ${scorer + 1} scores!` : '');
    }
    function movePaddles(dt) {
      paddles.forEach((p, i) => {
        const dx = (i ? Number(keys.has('d')) - Number(keys.has('a')) :
          Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')));
        const dy = (i ? Number(keys.has('s')) - Number(keys.has('w')) :
          Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp')));
        const direction = Math.hypot(dx, dy) || 1;
        let x = p.x + dx / direction * PADDLE_SPEED * dt;
        let y = p.y + dy / direction * PADDLE_SPEED * dt;
        if (positions[i]) {
          const remainingX = positions[i].x - p.x, remainingY = positions[i].y - p.y;
          const distance = Math.hypot(remainingX, remainingY);
          const fraction = Math.min(1, PADDLE_SPEED * dt / (distance || 1));
          x = p.x + remainingX * fraction;
          y = p.y + remainingY * fraction;
        }
        x = clamp(x, 23 + p.r, 577 - p.r);
        y = clamp(y, i ? 23 + p.r : H / 2 + p.r + 5,
          i ? H / 2 - p.r - 5 : 877 - p.r);
        p.vx = (x - p.x) / dt;
        p.vy = (y - p.y) / dt;
        p.x = x; p.y = y;
      });
    }
    const stepper = createFixedStepper((dt) => {
      if (winner !== null) return;
      movePaddles(dt);
      stepDiscs([puck, ...paddles], dt, {
        bounds: BOUNDS, friction: 13, restitution: .93,
        onCollision(a, b, force) {
          if (a === puck || b === puck) {
            if (force > 80) window.arcadeAudio?.impact(Math.min(force / 650, .7));
            const speed = Math.hypot(puck.vx, puck.vy);
            if (speed > 1050) {
              puck.vx *= 1050 / speed; puck.vy *= 1050 / speed;
            }
          }
        },
      });
      if (puck.y - puck.r <= 23) {
        if (puck.x > GOAL_LEFT && puck.x < GOAL_RIGHT) goal(0);
        else { puck.y = 23 + puck.r; puck.vy = Math.abs(puck.vy) * .94; }
      } else if (puck.y + puck.r >= 877) {
        if (puck.x > GOAL_LEFT && puck.x < GOAL_RIGHT) goal(1);
        else { puck.y = 877 - puck.r; puck.vy = -Math.abs(puck.vy) * .94; }
      }
      if (winner === null && Math.hypot(puck.vx, puck.vy) < 70) {
        const length = Math.hypot(puck.vx, puck.vy);
        if (length) { puck.vx *= 70 / length; puck.vy *= 70 / length; }
        else { puck.vy = puck.y < H / 2 ? 70 : -70; }
      }
    });

    function draw() {
      ctx.fillStyle = '#101b2c'; ctx.fillRect(0, 0, W, H);
      const ice = ctx.createLinearGradient(0, 23, W, 877);
      ice.addColorStop(0, '#133750'); ice.addColorStop(.5, '#1a5260'); ice.addColorStop(1, '#18314d');
      ctx.fillStyle = ice; ctx.fillRect(23, 23, 554, 854);
      ctx.lineWidth = 4; ctx.strokeStyle = '#8de5e566';
      ctx.strokeRect(23, 23, 554, 854);
      ctx.beginPath(); ctx.moveTo(23, H / 2); ctx.lineTo(577, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 105, 0, Math.PI * 2); ctx.stroke();
      for (const y of [205, 695]) {
        ctx.beginPath(); ctx.arc(W / 2, y, 92, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#071321';
      ctx.fillRect(GOAL_LEFT, 0, GOAL_RIGHT - GOAL_LEFT, 30);
      ctx.fillRect(GOAL_LEFT, 870, GOAL_RIGHT - GOAL_LEFT, 30);
      ctx.fillStyle = '#57d4f6';
      ctx.fillRect(GOAL_LEFT, 24, GOAL_RIGHT - GOAL_LEFT, 5);
      ctx.fillStyle = '#ff6747';
      ctx.fillRect(GOAL_LEFT, 870, GOAL_RIGHT - GOAL_LEFT, 5);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 64px system-ui';
      ctx.fillStyle = '#57d4f655'; ctx.fillText(paddles[1].score, W / 2, 327);
      ctx.fillStyle = '#ff674755'; ctx.fillText(paddles[0].score, W / 2, 585);
      paddles.forEach((p) => {
        ctx.shadowBlur = 24; ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 21, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffffff66';
        ctx.beginPath(); ctx.arc(p.x - 9, p.y - 10, 7, 0, Math.PI * 2); ctx.fill();
      });
      ctx.shadowBlur = 15; ctx.shadowColor = '#f8f3db';
      ctx.fillStyle = '#f6f2e6';
      ctx.beginPath(); ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#68778b';
      ctx.beginPath(); ctx.arc(puck.x, puck.y, 7, 0, Math.PI * 2); ctx.fill();
    }
    function frame(time) {
      if (disposed) return;
      if (!shell.root.isConnected) { dispose(); return; }
      stepper.tick(time);
      draw();
      raf = requestAnimationFrame(frame);
    }
    function pointerDown(event) {
      const point = canvasPoint(canvas, event, W, H);
      const i = point.y > H / 2 ? 0 : 1;
      if (pointers[i] !== null) return;
      pointers[i] = event.pointerId;
      positions[i] = point;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
    function pointerMove(event) {
      const i = pointers.indexOf(event.pointerId);
      if (i < 0) return;
      positions[i] = canvasPoint(canvas, event, W, H);
      event.preventDefault();
    }
    function pointerUp(event) {
      const i = pointers.indexOf(event.pointerId);
      if (i < 0) return;
      pointers[i] = null; positions[i] = null;
    }
    function keyDown(event) {
      if (!shell.root.isConnected || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'w', 'a', 's', 'd'].includes(event.key)) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'BUTTON'].includes(event.target.tagName)) return;
      keys.add(event.key); event.preventDefault();
    }
    function keyUp(event) { keys.delete(event.key); }
    function onBlur() { keys.clear(); }
    const onReset = () => reset();
    const onResize = () => size();
    const onTheme = () => draw();
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    window.addEventListener('arcade:themechange', onTheme);
    shell.getResetButton().addEventListener('click', onReset);
    reset();
    size();
    raf = requestAnimationFrame(frame);
    function dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('arcade:themechange', onTheme);
      shell.getResetButton().removeEventListener('click', onReset);
    }
    return { dispose };
  },
};
