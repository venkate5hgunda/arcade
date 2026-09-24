// Local two-player 8-ball. All dimensions are table coordinates, independent
// of canvas CSS size and device pixel ratio.
import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { canvasPoint, clamp, createFixedStepper, stepDiscs } from '../js/disc-physics.js';

const W = 1000, H = 540, R = 10.5;
const TABLE = { left: 55, right: 945, top: 55, bottom: 485 };
const POCKETS = [
  [55, 55], [500, 55], [945, 55],
  [55, 485], [500, 485], [945, 485],
].map(([x, y], i) => ({ x, y, r: i === 1 || i === 4 ? 23 : 27 }));
const COLORS = ['#f8f8f4', '#f5ce41', '#1875c3', '#ed5052', '#743da3',
  '#ee9236', '#319958', '#81352f', '#191b26'];
const group = (number) => number === 8 || number === 0 ? null : number < 8 ? 'solids' : 'stripes';
const other = (player) => 1 - player;

function rack() {
  const solids = [1, 2, 3, 4, 5, 6, 7];
  const stripes = [9, 10, 11, 12, 13, 14, 15];
  for (const list of [solids, stripes]) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const remaining = [...solids.slice(1), ...stripes.slice(1)];
  const numbers = [null, null, null, null, 8, null, null, null, null, null,
    solids[0], null, null, null, stripes[0]];
  for (let i = 0; i < numbers.length; i++) if (numbers[i] === null) numbers[i] = remaining.shift();
  const balls = [{ number: 0, x: 265, y: 270, vx: 0, vy: 0, r: R }];
  let index = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push({
        number: numbers[index++], x: 705 + row * 19.3,
        y: 270 + (col - row / 2) * 22.2, vx: 0, vy: 0, r: R,
      });
    }
  }
  return balls;
}

function validCheckpoint(s) {
  return s && ['1', '2'].includes(s.break) && (s.player === 0 || s.player === 1) &&
    Array.isArray(s.assignments) && s.assignments.length === 2 &&
    (s.assignments.every((g) => g === null) ||
      (s.assignments[0] === 'solids' && s.assignments[1] === 'stripes') ||
      (s.assignments[0] === 'stripes' && s.assignments[1] === 'solids')) &&
    Number.isInteger(s.shots) && s.shots >= 0 &&
    Number.isFinite(s.aim) && Math.abs(s.aim) <= 1000 &&
    Number.isFinite(s.power) && s.power >= .1 && s.power <= 1 &&
    Array.isArray(s.balls) && s.balls.length === 16 &&
    s.balls.every((b) => b && Number.isInteger(b.number) && b.number >= 0 && b.number <= 15 &&
      Number.isFinite(b.x) && b.x >= (b.pocketed ? 0 : TABLE.left - R) &&
      b.x <= (b.pocketed ? W : TABLE.right + R) &&
      Number.isFinite(b.y) && b.y >= (b.pocketed ? 0 : TABLE.top - R) &&
      b.y <= (b.pocketed ? H : TABLE.bottom + R) &&
      typeof b.pocketed === 'boolean') &&
    new Set(s.balls.map((b) => b.number)).size === 16 &&
    s.balls[0].number === 0 && !s.balls[0].pocketed &&
    !s.balls.find((b) => b.number === 8).pocketed;
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: '8-Ball Pool', meta: 'Two players · local match' });
    const { stage } = shell;
    shell.root.classList.add('pool-vibe');
    if (navigate) wireBack(shell, navigate);
    const saved = loadJSON(KEYS.SETTINGS + ':pool', { break: '1' });
    const checkpoint = validCheckpoint(session?.state) ? session.state : null;
    const settings = checkpoint ? { break: checkpoint.break } : await renderSetup(stage, {
      title: '🎱 8-Ball Pool',
      subtitle: 'Clear your group, then sink the 8. Pull back from the cue ball to shoot.',
      themeClass: 'pool-theme',
      fields: [{
        key: 'break', label: 'Who breaks?',
        options: [{ value: '1', label: 'Player 1' }, { value: '2', label: 'Player 2' }],
        default: saved.break,
      }],
      startLabel: 'Rack ’em up',
    });
    saveJSON(KEYS.SETTINGS + ':pool', settings);

    const board = document.createElement('div');
    board.className = 'pool-board';
    const canvas = document.createElement('canvas');
    canvas.className = 'pool-canvas';
    canvas.width = W; canvas.height = H;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Pool table. Drag from the cue ball to aim and shoot; or use arrow keys to aim, plus or minus to set power, and Space to shoot.');
    board.append(canvas);
    const hud = document.createElement('div');
    hud.className = 'pool-hud';
    hud.setAttribute('aria-live', 'polite');
    const controls = document.createElement('div');
    controls.className = 'pool-controls';
    controls.innerHTML = '<label for="pool-power">Shot power <strong class="pool-power-value">45%</strong></label><input id="pool-power" type="range" min="10" max="100" value="45" step="5"><button type="button" class="pool-shoot">Shoot · Space</button>';
    const help = document.createElement('p');
    help.className = 'pool-help';
    help.textContent = 'Drag back from the white cue ball to shoot · or aim with ← →, change power with ↑ ↓, press Space.';
    stage.append(hud, board, controls, help);
    const ctx = canvas.getContext('2d');
    const powerInput = controls.querySelector('input');
    const powerValue = controls.querySelector('.pool-power-value');
    const shootButton = controls.querySelector('button');
    let balls, player, assignments, winner, rolling, shot, settle, aim, power, drag, raf, shots;
    let disposed = false;
    let message = '';

    function checkpointGame() {
      if (!session || winner !== null || rolling) return;
      session.save({
        break: settings.break, player, assignments: [...assignments], shots, aim, power,
        balls: balls.map(({ number, x, y, pocketed }) => ({ number, x, y, pocketed: !!pocketed })),
      });
    }

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function announce(text) {
      message = text;
      const who = winner !== null ? `Player ${winner + 1} wins!` : `Player ${player + 1}'s turn`;
      const g = assignments[player];
      const left = g ? balls.filter((b) => !b.pocketed && group(b.number) === g).length : 0;
      hud.innerHTML = `<span class="pool-badge">🎱 ${who}</span><span>${g ? `${g} · ${left} remaining` : 'Open table'}</span><span class="pool-result"></span>`;
      hud.querySelector('.pool-result').textContent = message;
      shootButton.disabled = winner !== null || rolling;
    }

    function reset() {
      balls = rack();
      player = Number(settings.break) - 1;
      assignments = [null, null];
      winner = null;
      rolling = false;
      shot = null;
      settle = 0;
      aim = 0;
      power = 0.45;
      shots = 0;
      drag = null;
      powerInput.value = '45';
      powerValue.textContent = '45%';
      stepper.reset();
      announce('Break the rack!');
      draw();
      checkpointGame();
    }

    function respot() {
      const cue = balls[0];
      const places = [];
      for (let dx = 0; dx <= 180; dx += 24) {
        for (let dy = 0; dy <= 170; dy += 24) {
          places.push([265 + dx, 270 + dy], [265 + dx, 270 - dy]);
        }
      }
      const [x, y] = places.find(([px, py]) =>
        balls.every((b) => b === cue || b.pocketed || Math.hypot(b.x - px, b.y - py) >= R * 2 + 2)
      ) || [265, 270];
      Object.assign(cue, { x, y, vx: 0, vy: 0, pocketed: false });
    }

    function finishShot() {
      rolling = false;
      const taken = shot.pocketed;
      const scratch = taken.includes(0);
      const hit = shot.firstHit;
      const assigned = assignments[player];
      const canEight = assigned && !shot.remainingBefore;
      let foul = '';
      if (!hit) foul = 'No object ball hit';
      else if (assigned && (canEight ? hit !== 8 : group(hit) !== assigned)) foul = 'Wrong ball contacted first';
      else if (hit && !shot.railAfterHit && !taken.some((n) => n !== 0)) foul = 'No rail or pocket after contact';
      if (scratch) foul = 'Cue ball scratched';

      if (taken.includes(8)) {
        winner = !foul && canEight && hit === 8 ? player : other(player);
        announce(winner === player ? 'Legal 8-ball! Match won.' : 'Early or fouled 8-ball — opponent wins.');
        window.arcadeAudio?.prepare().then(() => window.arcadeAudio?.chime());
        window.haptics?.success();
        session?.finish();
        return;
      }
      if (!foul && !assigned) {
        const first = taken.find((n) => group(n));
        if (first) {
          assignments[player] = group(first);
          assignments[other(player)] = group(first) === 'solids' ? 'stripes' : 'solids';
        }
      }
      const keep = !foul && taken.some((n) => group(n) === assignments[player]) && !!assignments[player];
      if (scratch) respot();
      if (!keep) player = other(player);
      announce(foul ? `Foul: ${foul}. ${scratch ? 'Cue ball respotted.' : ''}` :
        keep ? 'Pocketed your ball — shoot again!' : 'Turn passes.');
      if (foul) { window.arcadeAudio?.buzz(); window.haptics?.failure(); }
      else if (taken.length) { window.arcadeAudio?.pop(); window.haptics?.select(); }
      checkpointGame();
    }

    function shoot() {
      if (rolling || winner !== null || balls[0].pocketed) return;
      checkpointGame(); // The last stable table is replayable if the page closes during a shot.
      shots++;
      const cue = balls[0], speed = 220 + 850 * power;
      cue.vx = Math.cos(aim) * speed;
      cue.vy = Math.sin(aim) * speed;
      shot = {
        firstHit: null, railAfterHit: false, pocketed: [],
        remainingBefore: assignments[player] ?
          balls.filter((b) => !b.pocketed && group(b.number) === assignments[player]).length : 7,
      };
      rolling = true;
      settle = 0;
      announce('Balls in motion…');
      window.arcadeAudio?.prepare().then(() => window.arcadeAudio?.impact(0.65));
      window.haptics?.medium();
    }

    const stepper = createFixedStepper((dt) => {
      if (!rolling) return;
      stepDiscs(balls, dt, {
        bounds: TABLE, pockets: POCKETS, friction: 175, restitution: 0.92,
        onCollision(a, b, force) {
          if (!shot.firstHit && (a.number === 0 || b.number === 0)) {
            shot.firstHit = a.number === 0 ? b.number : a.number;
          }
          if (force > 80) window.arcadeAudio?.impact(Math.min(force / 600, 0.55));
        },
        onRail() { if (shot.firstHit) shot.railAfterHit = true; },
        onPocket(ball) {
          shot.pocketed.push(ball.number);
          window.arcadeAudio?.pop();
          window.haptics?.light();
        },
      });
      if (balls.every((b) => b.pocketed || Math.hypot(b.vx, b.vy) < 5)) {
        settle += dt;
        if (settle > 0.22) {
          for (const b of balls) if (!b.pocketed) b.vx = b.vy = 0;
          finishShot();
        }
      } else settle = 0;
    });

    function draw() {
      if (!balls) return;
      const wood = ctx.createLinearGradient(0, 0, 0, H);
      wood.addColorStop(0, '#9c6235'); wood.addColorStop(0.5, '#59341d'); wood.addColorStop(1, '#a46b3d');
      ctx.fillStyle = wood;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#112d30';
      ctx.fillRect(32, 32, W - 64, H - 64);
      const felt = ctx.createRadialGradient(500, 260, 50, 500, 260, 600);
      felt.addColorStop(0, '#187b70'); felt.addColorStop(1, '#094e4a');
      ctx.fillStyle = felt;
      ctx.fillRect(TABLE.left, TABLE.top, TABLE.right - TABLE.left, TABLE.bottom - TABLE.top);
      ctx.strokeStyle = '#83c5a766';
      ctx.lineWidth = 2;
      ctx.strokeRect(65, 65, 870, 410);
      ctx.strokeStyle = '#ffffff38';
      ctx.beginPath(); ctx.moveTo(265, 65); ctx.lineTo(265, 475); ctx.stroke();
      for (const p of POCKETS) {
        ctx.fillStyle = '#051818';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#090d10';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      for (const ball of balls) {
        if (ball.pocketed) continue;
        ctx.fillStyle = '#001b1b88';
        ctx.beginPath(); ctx.ellipse(ball.x + 3, ball.y + 4, R + 2, R * .8, 0, 0, Math.PI * 2); ctx.fill();
        const color = COLORS[ball.number % 8];
        ctx.fillStyle = ball.number === 8 ? COLORS[8] : color;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2); ctx.fill();
        if (ball.number > 8) {
          ctx.save();
          ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = '#faf7ed';
          ctx.fillRect(ball.x - R + 2, ball.y - 5.3, 2 * R - 4, 10.6);
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(ball.x, ball.y, 5.3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (ball.number) {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ball.x, ball.y, 5.6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#15151a';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = `bold ${ball.number > 9 ? 7 : 9}px system-ui`;
          ctx.fillText(ball.number, ball.x, ball.y + .5);
        } else {
          ctx.fillStyle = '#ffffffbb';
          ctx.beginPath(); ctx.arc(ball.x - 3, ball.y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (!rolling && winner === null && !balls[0].pocketed) {
        const cue = balls[0], dx = Math.cos(aim), dy = Math.sin(aim);
        let length = 650;
        for (const b of balls.slice(1)) {
          if (b.pocketed) continue;
          const along = (b.x - cue.x) * dx + (b.y - cue.y) * dy;
          const side = Math.abs((b.x - cue.x) * dy - (b.y - cue.y) * dx);
          if (along > 0 && side < R * 2 && along < length) length = along - R * 2;
        }
        ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff9bdcc';
        ctx.beginPath(); ctx.moveTo(cue.x, cue.y);
        ctx.lineTo(cue.x + dx * length, cue.y + dy * length); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#e5b985'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cue.x - dx * (R + 8 + power * 38), cue.y - dy * (R + 8 + power * 38));
        ctx.lineTo(cue.x - dx * (R + 75 + power * 38), cue.y - dy * (R + 75 + power * 38));
        ctx.stroke();
      }
    }

    function frame(time) {
      if (disposed) return;
      if (!shell.root.isConnected) { dispose(); return; }
      stepper.tick(time);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function setPower(value) {
      power = clamp(value, .1, 1);
      powerInput.value = String(Math.round(power * 100));
      powerValue.textContent = `${powerInput.value}%`;
    }

    function pointerDown(event) {
      if (rolling || winner !== null || drag) return;
      const p = canvasPoint(canvas, event, W, H);
      drag = { id: event.pointerId, start: p, pull: Math.hypot(p.x - balls[0].x, p.y - balls[0].y) < 45 };
      canvas.setPointerCapture(event.pointerId);
      canvas.focus();
      pointerMove(event);
      event.preventDefault();
    }
    function pointerMove(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const p = canvasPoint(canvas, event, W, H);
      const vx = drag.pull ? drag.start.x - p.x : p.x - balls[0].x;
      const vy = drag.pull ? drag.start.y - p.y : p.y - balls[0].y;
      const distance = Math.hypot(vx, vy);
      if (distance > 4) aim = Math.atan2(vy, vx);
      if (drag.pull && distance > 8) setPower(distance / 220);
      draw();
    }
    function pointerUp(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const p = canvasPoint(canvas, event, W, H);
      const distance = Math.hypot(p.x - drag.start.x, p.y - drag.start.y);
      const fire = distance > 10;
      drag = null;
      if (fire) shoot();
      else checkpointGame();
    }
    function keyDown(event) {
      if (disposed || !shell.root.isConnected || event.altKey || event.ctrlKey || event.metaKey ||
        ['INPUT', 'BUTTON'].includes(document.activeElement?.tagName)) return;
      if (rolling || winner !== null) return;
      if (event.key === 'ArrowLeft') aim -= .045;
      else if (event.key === 'ArrowRight') aim += .045;
      else if (event.key === 'ArrowUp' || event.key === '+') setPower(power + .05);
      else if (event.key === 'ArrowDown' || event.key === '-') setPower(power - .05);
      else if (event.key === ' ' || event.key === 'Enter') shoot();
      else return;
      event.preventDefault();
      draw();
      checkpointGame();
    }
    const onReset = () => reset();
    const onPower = () => { setPower(Number(powerInput.value) / 100); draw(); checkpointGame(); };
    const onTheme = () => draw();
    const onResize = () => size();
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    const pointerCancel = () => { drag = null; };
    canvas.addEventListener('pointercancel', pointerCancel);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('resize', onResize);
    window.addEventListener('arcade:themechange', onTheme);
    shell.getResetButton().addEventListener('click', onReset);
    shootButton.addEventListener('click', shoot);
    powerInput.addEventListener('input', onPower);
    if (checkpoint) {
      balls = checkpoint.balls.map((b) => ({ ...b, vx: 0, vy: 0, r: R }));
      player = checkpoint.player;
      assignments = [...checkpoint.assignments];
      shots = checkpoint.shots;
      winner = null; rolling = false; shot = null; settle = 0; drag = null;
      aim = checkpoint.aim;
      setPower(checkpoint.power);
      announce('Match resumed.');
    } else reset();
    size();
    raf = requestAnimationFrame(frame);
    function dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('arcade:themechange', onTheme);
      shell.getResetButton().removeEventListener('click', onReset);
      shootButton.removeEventListener('click', shoot);
      powerInput.removeEventListener('input', onPower);
    }
    return { dispose };
  },
};
