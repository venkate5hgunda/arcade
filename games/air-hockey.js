// Two-player air hockey; fixed world coordinates keep touch, desktop and HiDPI
// play identical. Both puck and moving paddles use the shared disc solver.
import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { canvasPoint, clamp, createFixedStepper, stepDiscs } from '../js/disc-physics.js';

const W = 600, H = 900;
const GOAL_LEFT = 195, GOAL_RIGHT = 405;
const BOUNDS = { left: 23, right: 577, top: -10000, bottom: 10000 };
const PADDLE_SPEED = 690;
const DRAG_SPEED = 950;
const PADDLE_ACCEL = 22000;
const PUCK_SPEED_LIMIT = 1050;
export const PUCK_FRICTION = 190;
const RESTITUTION = .93;

export function parkPuck(puck, receiver) {
  puck.x = W / 2;
  puck.y = receiver === 0 ? 610 : 290;
  puck.vx = puck.vy = 0;
}

export function parkOpeningPuck(puck) {
  puck.x = W / 2;
  puck.y = H / 2;
  puck.vx = puck.vy = 0;
}

export function strikeParkedPuck(puck, paddle) {
  const dx = puck.x - paddle.x, dy = puck.y - paddle.y;
  const distance = Math.hypot(dx, dy);
  if (!distance || distance > puck.r + paddle.r) return false;
  const nx = dx / distance, ny = dy / distance;
  const impactSpeed = paddle.vx * nx + paddle.vy * ny;
  if (impactSpeed <= 0) return false;
  const speed = Math.min(PUCK_SPEED_LIMIT, (1 + RESTITUTION) * impactSpeed);
  puck.vx = nx * speed;
  puck.vy = ny * speed;
  return true;
}

export function acceleratePaddle(paddle, desiredVx, desiredVy, dt, bounds) {
  const deltaX = desiredVx - paddle.vx, deltaY = desiredVy - paddle.vy;
  const delta = Math.hypot(deltaX, deltaY);
  const fraction = delta ? Math.min(1, PADDLE_ACCEL * dt / delta) : 1;
  const vx = paddle.vx + deltaX * fraction, vy = paddle.vy + deltaY * fraction;
  const x = clamp(paddle.x + vx * dt, bounds.left, bounds.right);
  const y = clamp(paddle.y + vy * dt, bounds.top, bounds.bottom);
  paddle.vx = (x - paddle.x) / dt;
  paddle.vy = (y - paddle.y) / dt;
  paddle.x = x;
  paddle.y = y;
}

function validCheckpoint(s) {
  const point = (p, minY, maxY) => p && Number.isFinite(p.x) && p.x >= 60 && p.x <= 540 &&
    Number.isFinite(p.y) && p.y >= minY && p.y <= maxY;
  return s && [5, 7, 10].includes(s.target) &&
    Array.isArray(s.paddles) && s.paddles.length === 2 &&
    s.paddles.every((p, i) => point(p, i ? 60 : 492, i ? 408 : 840) &&
      Number.isInteger(p.score) && p.score >= 0 && p.score < s.target) &&
    s.puck && Number.isFinite(s.puck.x) && s.puck.x >= 0 && s.puck.x <= W &&
    Number.isFinite(s.puck.y) && s.puck.y >= 0 && s.puck.y <= H &&
    Number.isFinite(s.puck.vx) && Math.abs(s.puck.vx) <= 1200 &&
    Number.isFinite(s.puck.vy) && Math.abs(s.puck.vy) <= 1200 &&
    (s.waitingFor === undefined || s.waitingFor === null || s.waitingFor === 0 || s.waitingFor === 1) &&
    (s.openingFaceoff === undefined || typeof s.openingFaceoff === 'boolean') &&
    (!s.openingFaceoff || (s.waitingFor == null && s.puck.x === W / 2 &&
      s.puck.y === H / 2 && s.puck.vx === 0 && s.puck.vy === 0 &&
      s.paddles.every(p => p.score === 0))) &&
    (s.waitingFor == null || (s.puck.x === W / 2 &&
      s.puck.y === (s.waitingFor === 0 ? 610 : 290) &&
      s.puck.vx === 0 && s.puck.vy === 0));
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Air Hockey', meta: 'Two players · first to 7' });
    const { stage } = shell;
    shell.root.classList.add('ah-vibe');
    if (navigate) wireBack(shell, navigate);
    const saved = loadJSON(KEYS.SETTINGS + ':air-hockey', { target: '7' });
    const checkpoint = validCheckpoint(session?.state) ? session.state : null;
    const settings = checkpoint ? { target: String(checkpoint.target) } : await renderSetup(stage, {
      title: '🏒 Air Hockey',
      subtitle: 'Player 1 defends the bottom; Player 2 defends the top.',
      themeClass: 'ah-theme',
      fields: [{
        key: 'target', label: 'Winning score',
        options: [5, 7, 10].map((n) => ({ value: String(n), label: `First to ${n}` })),
        default: saved.target,
      }],
      startLabel: 'Start Faceoff',
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
    help.textContent = 'P1 (bottom): arrow keys · P2 (top): WASD · Strike the resting puck to start. After a goal, the other player serves.';
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
    let winner = null, waitingFor = null, openingFaceoff = true, disposed = false, raf, lastSave = 0, lastImpact = 0;

    function checkpointGame(force = false) {
      if (!session || winner !== null || (!force && Date.now() - lastSave < 1000)) return;
      lastSave = Date.now();
      session.save({
        target, paddles: paddles.map(({ x, y, score }) => ({ x, y, score })),
        puck: { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy }, waitingFor, openingFaceoff,
      });
    }

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function updateStatus(text = '') {
      const detail = text || (openingFaceoff ? 'Faceoff · strike the puck to start' : '');
      status.textContent = winner === null
        ? `P1 ${paddles[0].score} : ${paddles[1].score} P2${detail ? ` · ${detail}` : ''}`
        : `🏆 ${playerName(winner)} wins! ${paddles[0].score} – ${paddles[1].score}`;
    }
    function reset() {
      shell.root.querySelector('.arcade-victory')?.remove();
      winner = null;
      for (const [i, p] of paddles.entries()) {
        p.score = 0; p.x = W / 2; p.y = i ? 160 : 740; p.vx = p.vy = 0;
        positions[i] = null;
      }
      waitingFor = null;
      openingFaceoff = true;
      parkOpeningPuck(puck);
      stepper.reset();
      updateStatus();
      draw();
      checkpointGame(true);
    }
    function goal(scorer) {
      paddles[scorer].score++;
      window.arcadeAudio?.goal();
      window.haptics?.success();
      if (paddles[scorer].score >= target) {
        winner = scorer;
        puck.vx = puck.vy = 0;
        celebrate(shell.root, `${playerName(winner)} wins Air Hockey!`);
      } else {
        openingFaceoff = false;
        waitingFor = 1 - scorer;
        parkPuck(puck, waitingFor);
      }
      updateStatus(winner === null ? `Player ${scorer + 1} scores! · P${waitingFor + 1} serves` : '');
      if (winner !== null) session?.finish();
      else checkpointGame(true);
    }
    function movePaddles(dt) {
      paddles.forEach((p, i) => {
        const dx = (i ? Number(keys.has('d')) - Number(keys.has('a')) :
          Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')));
        const dy = (i ? Number(keys.has('s')) - Number(keys.has('w')) :
          Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp')));
        const direction = Math.hypot(dx, dy) || 1;
        let desiredVx = dx / direction * PADDLE_SPEED;
        let desiredVy = dy / direction * PADDLE_SPEED;
        if (positions[i]) {
          const remainingX = positions[i].x - p.x, remainingY = positions[i].y - p.y;
          const distance = Math.hypot(remainingX, remainingY);
          const response = Math.min(16, DRAG_SPEED / (distance || 1));
          desiredVx = remainingX * response;
          desiredVy = remainingY * response;
        }
        acceleratePaddle(p, desiredVx, desiredVy, dt, {
          left: 23 + p.r, right: 577 - p.r,
          top: i ? 23 + p.r : H / 2 + p.r + 5,
          bottom: i ? H / 2 - p.r - 5 : 877 - p.r,
        });
      });
    }
    const stepper = createFixedStepper((dt) => {
      if (winner !== null) return;
      movePaddles(dt);
      if (openingFaceoff) {
        const striker = paddles.findIndex(p => strikeParkedPuck(puck, p));
        if (striker === -1) return;
        openingFaceoff = false;
        updateStatus();
        window.arcadeAudio?.impact(Math.min(Math.hypot(puck.vx, puck.vy) / PUCK_SPEED_LIMIT, .75));
        window.haptics?.select();
      }
      if (waitingFor !== null) {
        if (!strikeParkedPuck(puck, paddles[waitingFor])) return;
        waitingFor = null;
        updateStatus();
        window.arcadeAudio?.impact(Math.min(Math.hypot(puck.vx, puck.vy) / PUCK_SPEED_LIMIT, .75));
        window.haptics?.select();
      }
      stepDiscs([puck, ...paddles], dt, {
        bounds: BOUNDS, friction: PUCK_FRICTION, restitution: RESTITUTION,
        onCollision(a, b, force) {
          if (a === puck || b === puck) {
            if (force > 80 && performance.now() - lastImpact > 70) {
              lastImpact = performance.now();
              window.arcadeAudio?.impact(Math.min(force / 650, .7));
              window.haptics?.light();
            }
            const speed = Math.hypot(puck.vx, puck.vy);
            if (speed > PUCK_SPEED_LIMIT) {
              puck.vx *= PUCK_SPEED_LIMIT / speed; puck.vy *= PUCK_SPEED_LIMIT / speed;
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
      const speed = Math.hypot(puck.vx, puck.vy);
      if (speed > 100) {
        const tail = Math.min(60, speed * .055);
        const trail = ctx.createLinearGradient(
          puck.x - puck.vx / speed * tail, puck.y - puck.vy / speed * tail, puck.x, puck.y);
        trail.addColorStop(0, '#f8f3db00');
        trail.addColorStop(1, '#f8f3dbbb');
        ctx.strokeStyle = trail; ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(puck.x - puck.vx / speed * tail, puck.y - puck.vy / speed * tail);
        ctx.lineTo(puck.x, puck.y);
        ctx.stroke();
      }
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
      if (winner === null && !document.hidden) checkpointGame();
      raf = requestAnimationFrame(frame);
    }
    function pointerDown(event) {
      if (winner !== null) return;
      const point = canvasPoint(canvas, event, W, H);
      const i = point.y > H / 2 ? 0 : 1;
      if (pointers[i] !== null) return;
      pointers[i] = event.pointerId;
      positions[i] = point;
      canvas.setPointerCapture(event.pointerId);
      window.arcadeAudio?.prepare();
      window.arcadeAudio?.tap();
      window.haptics?.select();
      event.preventDefault();
    }
    function pointerMove(event) {
      const i = pointers.indexOf(event.pointerId);
      if (i < 0) return;
      positions[i] = canvasPoint(canvas, event, W, H);
      if (document.hidden) return;
      stepper.tick(performance.now());
      draw();
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
    function onBlur() { keys.clear(); checkpointGame(true); }
    function onVisibility() { if (document.hidden) checkpointGame(true); }
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
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    window.addEventListener('arcade:themechange', onTheme);
    shell.getResetButton().addEventListener('click', onReset);
    if (checkpoint) {
      checkpoint.paddles.forEach((p, i) => Object.assign(paddles[i], p));
      Object.assign(puck, checkpoint.puck);
      waitingFor = checkpoint.waitingFor ?? null;
      openingFaceoff = checkpoint.openingFaceoff ?? false;
      updateStatus(waitingFor === null ? '' : `P${waitingFor + 1} serves`);
    } else reset();
    size();
    raf = requestAnimationFrame(frame);
    function dispose() {
      if (disposed) return;
      disposed = true;
      checkpointGame(true);
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('arcade:themechange', onTheme);
      shell.getResetButton().removeEventListener('click', onReset);
    }
    return { dispose };
  },
};
