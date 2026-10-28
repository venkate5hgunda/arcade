import { useEffect, useMemo, useRef, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { canvasPoint, clamp, fixedStepper } from '../lib/discs.ts';
import {
  newPool,
  validPool,
  worldPool,
  snapshotPool,
  shootPool,
  stepPool,
  group,
  POOL_R,
  POOL_W,
  POOL_H,
  TABLE,
  POCKETS,
  COLORS,
} from '../lib/pool.ts';
import type { PoolState, PoolWorld } from '../lib/pool.ts';
import { createGameSession } from '../lib/session.ts';
import { names as readNames } from '../lib/profile.ts';
export function PoolGame() {
  const run = useRun<PoolState>('pool', { break: '1' }, validPool, (s) =>
    newPool(s.break === '2' ? '2' : '1'),
  );
  const s = run.state,
    [names] = useState(readNames),
    [message, setMessage] = useState('Break the rack!');
  const label = (i: number) => names[i] || `Player ${i + 1}`;
  useEffect(() => {
    if (s) {
      run.setSettings({ break: s.break });
      setMessage('Match resumed.');
    }
  }, []);
  const g = s?.assignments[s.player],
    left =
      s && g
        ? s.balls.filter((b) => !b.pocketed && group(b.number) === g).length
        : 0;
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'break',
          label: 'Who breaks?',
          options: [
            ['1', 'Player 1'],
            ['2', 'Player 2'],
          ],
        },
      ]}
      summary="Line up the cue. Clear your group. Sink the eight."
      title={
        s?.over
          ? `${label(s.winner ?? 0)} wins!`
          : `${s ? label(s.player) : 'Player 1'}’s turn`
      }
      status={
        s
          ? `${g ? `${g} · ${left} remaining` : 'Open table'} · ${message}`
          : 'Two players share one table.'
      }
      help="Drag back from the cue ball to aim and shoot, or drag toward a target. Use left and right arrows to aim; up and down change power; Space shoots. The first legal pocket assigns solids or stripes. After your group is clear, hit the 8 first and pocket it legally. Scratches, wrong first contact, and failure to reach a rail or pocket after contact are fouls."
      after={
        s && (
          <>
            <details className="help-card pool-inventory">
              <summary>Inspect balls</summary>
              <ul>
                {s.balls.map((ball) => (
                  <li key={ball.number}>
                    {ball.number === 0
                      ? 'Cue ball'
                      : ball.number === 8
                        ? '8-ball'
                        : `Ball ${ball.number} · ${group(ball.number)}`}{' '}
                    — {ball.pocketed ? 'pocketed' : 'on table'}
                  </li>
                ))}
              </ul>
            </details>
            {s.over && (
              <button className="primary" onClick={run.start}>
                Play again
              </button>
            )}
          </>
        )
      }
    >
      {s && !s.over && (
        <PoolTable
          initial={s}
          onChange={(next) => run.commit(next)}
          onMessage={setMessage}
        />
      )}
    </Frame>
  );
}
function draw(ctx: CanvasRenderingContext2D, w: PoolWorld) {
  const wood = ctx.createLinearGradient(0, 0, 0, POOL_H);
  wood.addColorStop(0, '#aa7044');
  wood.addColorStop(0.5, '#603a28');
  wood.addColorStop(1, '#b47b49');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, POOL_W, POOL_H);
  ctx.fillStyle = '#112d30';
  ctx.fillRect(32, 32, 936, 476);
  const felt = ctx.createRadialGradient(500, 260, 50, 500, 260, 600);
  felt.addColorStop(0, '#238c7b');
  felt.addColorStop(1, '#09544f');
  ctx.fillStyle = felt;
  ctx.fillRect(55, 55, 890, 430);
  ctx.strokeStyle = '#b6e1bf77';
  ctx.lineWidth = 2;
  ctx.strokeRect(65, 65, 870, 410);
  ctx.beginPath();
  ctx.moveTo(265, 65);
  ctx.lineTo(265, 475);
  ctx.stroke();
  for (const p of POCKETS) {
    ctx.fillStyle = '#051818';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d10';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ball of w.balls) {
    if (ball.pocketed) continue;
    ctx.fillStyle = '#001b1b88';
    ctx.beginPath();
    ctx.ellipse(
      ball.x + 3,
      ball.y + 4,
      POOL_R + 2,
      POOL_R * 0.8,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    const color = COLORS[ball.number % 8];
    ctx.fillStyle = ball.number === 8 ? COLORS[8] : color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, POOL_R, 0, Math.PI * 2);
    ctx.fill();
    if (ball.number > 8) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, POOL_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#faf7ed';
      ctx.fillRect(ball.x - POOL_R + 2, ball.y - 5.3, 2 * POOL_R - 4, 10.6);
      ctx.restore();
    }
    if (ball.number) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 5.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15151a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${ball.number > 9 ? 7 : 9}px system-ui`;
      ctx.fillText(String(ball.number), ball.x, ball.y + 0.5);
    } else {
      ctx.fillStyle = '#ffffffbb';
      ctx.beginPath();
      ctx.arc(ball.x - 3, ball.y - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!w.rolling && w.winner === null && !w.balls[0].pocketed) {
    const cue = w.balls[0],
      dx = Math.cos(w.state.aim),
      dy = Math.sin(w.state.aim);
    let length = 650;
    for (const b of w.balls.slice(1)) {
      if (b.pocketed) continue;
      const along = (b.x - cue.x) * dx + (b.y - cue.y) * dy,
        side = Math.abs((b.x - cue.x) * dy - (b.y - cue.y) * dx);
      if (along > 0 && side < POOL_R * 2 && along < length)
        length = along - POOL_R * 2;
    }
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff9bdcc';
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(cue.x + dx * length, cue.y + dy * length);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#e5b985';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(
      cue.x - dx * (POOL_R + 8 + w.state.power * 38),
      cue.y - dy * (POOL_R + 8 + w.state.power * 38),
    );
    ctx.lineTo(
      cue.x - dx * (POOL_R + 75 + w.state.power * 38),
      cue.y - dy * (POOL_R + 75 + w.state.power * 38),
    );
    ctx.stroke();
  }
}
function PoolTable({
  initial,
  onChange,
  onMessage,
}: {
  initial: PoolState;
  onChange: (s: PoolState) => void;
  onMessage: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    world = useRef(worldPool(initial)),
    session = useMemo(() => createGameSession('pool'), []),
    [power, setPower] = useState(initial.power),
    [rolling, setRolling] = useState(false),
    shootRef = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = canvasRef.current!,
      ctx = canvas.getContext('2d')!,
      w = world.current;
    let disposed = false,
      raf = 0,
      drag: {
        id: number;
        start: { x: number; y: number };
        pull: boolean;
      } | null = null;
    const save = () => {
      if (w.winner === null && !w.rolling) session.save(snapshotPool(w));
    };
    const syncPower = (value: number) => {
      w.state.power = clamp(value, 0.1, 1);
      setPower(w.state.power);
    };
    const shoot = () => {
      if (w.rolling || w.winner !== null) return;
      save();
      if (shootPool(w)) {
        setRolling(true);
        onMessage('Balls in motion…');
      }
    };
    shootRef.current = shoot;
    const stepper = fixedStepper((dt) => {
      const text = stepPool(w, dt);
      if (text !== null) {
        setRolling(false);
        onMessage(text);
        onChange({ ...snapshotPool(w), message: text });
      }
    });
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = POOL_W * dpr;
      canvas.height = POOL_H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w);
    }
    function frame(time: number) {
      if (disposed) return;
      stepper.tick(time);
      draw(ctx, w);
      raf = requestAnimationFrame(frame);
    }
    function down(e: PointerEvent) {
      if (w.rolling || w.winner !== null || drag) return;
      const point = canvasPoint(canvas, e, POOL_W, POOL_H);
      drag = {
        id: e.pointerId,
        start: point,
        pull: Math.hypot(point.x - w.balls[0].x, point.y - w.balls[0].y) < 45,
      };
      canvas.setPointerCapture(e.pointerId);
      canvas.focus();
      move(e);
      e.preventDefault();
    }
    function move(e: PointerEvent) {
      if (!drag || e.pointerId !== drag.id) return;
      const p = canvasPoint(canvas, e, POOL_W, POOL_H),
        vx = drag.pull ? drag.start.x - p.x : p.x - w.balls[0].x,
        vy = drag.pull ? drag.start.y - p.y : p.y - w.balls[0].y,
        distance = Math.hypot(vx, vy);
      if (distance > 4) w.state.aim = Math.atan2(vy, vx);
      if (drag.pull && distance > 8) syncPower(distance / 220);
    }
    function up(e: PointerEvent) {
      if (!drag || e.pointerId !== drag.id) return;
      const p = canvasPoint(canvas, e, POOL_W, POOL_H),
        fire = Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 10;
      drag = null;
      if (fire) shoot();
      else save();
    }
    function cancel() {
      drag = null;
    }
    function keydown(e: KeyboardEvent) {
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (document.activeElement instanceof HTMLElement &&
          ['INPUT', 'BUTTON', 'SELECT'].includes(
            document.activeElement.tagName,
          )) ||
        w.rolling ||
        w.winner !== null
      )
        return;
      if (e.key === 'ArrowLeft') w.state.aim -= 0.045;
      else if (e.key === 'ArrowRight') w.state.aim += 0.045;
      else if (e.key === 'ArrowUp' || e.key === '+')
        syncPower(w.state.power + 0.05);
      else if (e.key === 'ArrowDown' || e.key === '-')
        syncPower(w.state.power - 0.05);
      else if (e.key === ' ' || e.key === 'Enter') shoot();
      else return;
      e.preventDefault();
      save();
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', keydown);
    window.addEventListener('resize', size);
    size();
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', size);
    };
  }, []);
  return (
    <>
      <canvas
        ref={canvasRef}
        className="pool-canvas"
        tabIndex={0}
        role="img"
        aria-label="Pool table. Drag from the cue ball to aim and shoot, or use arrow keys to aim, up and down to set power, and Space to shoot."
      />
      <div className="pool-controls">
        <label>
          Shot power {Math.round(power * 100)}%
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={Math.round(power * 100)}
            disabled={rolling}
            onChange={(e) => {
              world.current.state.power = Number(e.target.value) / 100;
              setPower(world.current.state.power);
              session.save(snapshotPool(world.current));
            }}
          />
        </label>
        <button
          className="primary"
          disabled={rolling}
          onClick={() => shootRef.current()}
        >
          Shoot · Space
        </button>
      </div>
      <p>
        Drag back from the white cue ball to shoot, or use the arrow keys and
        Space.
      </p>
    </>
  );
}
