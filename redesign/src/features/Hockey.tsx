import { useEffect, useMemo, useRef, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { canvasPoint, fixedStepper } from '../lib/discs.ts';
import {
  HOCKEY_W,
  HOCKEY_H,
  validHockey,
  newHockey,
  worldHockey,
  snapshotHockey,
  hockeyStep,
} from '../lib/hockey.ts';
import type { HockeyState, HockeyWorld } from '../lib/hockey.ts';
import { createGameSession } from '../lib/session.ts';
import { names as readNames } from '../lib/profile.ts';
import { feedback } from '../lib/feedback.ts';
export function HockeyGame() {
  const run = useRun<HockeyState>(
    'air-hockey',
    { target: '7' },
    validHockey,
    (s) =>
      newHockey([5, 7, 10].includes(Number(s.target)) ? Number(s.target) : 7),
  );
  const discard = useRef(false);
  const s = run.state,
    [names] = useState(readNames),
    [status, setStatus] = useState('Faceoff · strike the puck to start');
  const label = (i: number) => names[i] || `Player ${i + 1}`;
  useEffect(() => {
    if (s) run.setSettings({ target: String(s.target) });
  }, []);
  return (
    <Frame
      run={{
        ...run,
        reset: () => {
          if (
            window.confirm(
              'Start a fresh match? Your current progress will be cleared.',
            )
          ) {
            discard.current = true;
            createGameSession('air-hockey').finish();
            run.view(null);
          }
        },
        start: () => {
          discard.current = false;
          run.start();
        },
      }}
      fields={[
        {
          key: 'target',
          label: 'Winning score',
          options: [5, 7, 10].map((n) => [String(n), `First to ${n}`]),
        },
      ]}
      summary="A bright table, two paddles, one flying puck."
      title={s?.over ? `${label(s.winner ?? 0)} wins!` : status}
      status={
        s
          ? `${label(0)} ${s.paddles[0].score} : ${s.paddles[1].score} ${label(1)} · First to ${s.target}`
          : 'Two players share one table.'
      }
      help="Player 1 defends the bottom with the arrow keys; Player 2 defends the top with W, A, S and D. On touch screens, drag a paddle on each half of the table. Strike the resting puck to start. After a goal, the other player serves. First to the selected score wins."
      after={
        s?.over && (
          <button className="primary" onClick={run.start}>
            Play again
          </button>
        )
      }
    >
      {s && !s.over && (
        <HockeyArena
          initial={s}
          canSave={() => !discard.current}
          onChange={(next) => run.commit(next)}
          onStatus={setStatus}
        />
      )}
    </Frame>
  );
}
function draw(ctx: CanvasRenderingContext2D, w: HockeyWorld) {
  const W = HOCKEY_W,
    H = HOCKEY_H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#191c35';
  ctx.fillRect(0, 0, W, H);
  const ice = ctx.createLinearGradient(0, 23, W, 877);
  ice.addColorStop(0, '#173c52');
  ice.addColorStop(0.5, '#2b6d72');
  ice.addColorStop(1, '#223b59');
  ctx.fillStyle = ice;
  ctx.fillRect(23, 23, 554, 854);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#a6f1eab0';
  ctx.strokeRect(23, 23, 554, 854);
  ctx.beginPath();
  ctx.moveTo(23, H / 2);
  ctx.lineTo(577, H / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(300, 450, 105, 0, Math.PI * 2);
  ctx.stroke();
  for (const y of [205, 695]) {
    ctx.beginPath();
    ctx.arc(300, y, 92, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#071321';
  ctx.fillRect(195, 0, 210, 30);
  ctx.fillRect(195, 870, 210, 30);
  ctx.fillStyle = '#57d4f6';
  ctx.fillRect(195, 24, 210, 5);
  ctx.fillStyle = '#ff6747';
  ctx.fillRect(195, 870, 210, 5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 64px system-ui';
  ctx.fillStyle = '#57d4f655';
  ctx.fillText(String(w.paddles[1].score), 300, 327);
  ctx.fillStyle = '#ff674755';
  ctx.fillText(String(w.paddles[0].score), 300, 585);
  for (const p of w.paddles) {
    ctx.shadowBlur = 24;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff77';
    ctx.beginPath();
    ctx.arc(p.x - 9, p.y - 10, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const puck = w.puck,
    speed = Math.hypot(puck.vx, puck.vy);
  if (speed > 100) {
    const tail = Math.min(60, speed * 0.055),
      trail = ctx.createLinearGradient(
        puck.x - (puck.vx / speed) * tail,
        puck.y - (puck.vy / speed) * tail,
        puck.x,
        puck.y,
      );
    trail.addColorStop(0, '#f8f3db00');
    trail.addColorStop(1, '#f8f3dbbb');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(
      puck.x - (puck.vx / speed) * tail,
      puck.y - (puck.vy / speed) * tail,
    );
    ctx.lineTo(puck.x, puck.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#f8f3db';
  ctx.fillStyle = '#fff2d6';
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#68778b';
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, 7, 0, Math.PI * 2);
  ctx.fill();
}
function HockeyArena({
  initial,
  onChange,
  onStatus,
  canSave,
}: {
  initial: HockeyState;
  canSave: () => boolean;
  onChange: (s: HockeyState) => void;
  onStatus: (s: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    world = useRef(worldHockey(initial)),
    session = useMemo(() => createGameSession('air-hockey'), []);
  useEffect(() => {
    const canvas = canvasRef.current!,
      ctx = canvas.getContext('2d')!,
      w = world.current;
    const pointers: [number | null, number | null] = [null, null],
      positions: [
        { x: number; y: number } | null,
        { x: number; y: number } | null,
      ] = [null, null],
      keys = new Set<string>();
    let raf = 0,
      lastSave = 0,
      disposed = false;
    let lastImpact = 0;
    const save = () => {
      if (w.winner === null && canSave()) session.save(snapshotHockey(w));
    };
    const stepper = fixedStepper((dt) => {
      const desired = w.paddles.map((p, i) => {
        const dx = i
          ? Number(keys.has('d')) - Number(keys.has('a'))
          : Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
        const dy = i
          ? Number(keys.has('s')) - Number(keys.has('w'))
          : Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
        const length = Math.hypot(dx, dy) || 1;
        let x = (dx / length) * 690,
          y = (dy / length) * 690;
        if (positions[i]) {
          const px = positions[i]!.x - p.x,
            py = positions[i]!.y - p.y,
            f = Math.min(16, 950 / (Math.hypot(px, py) || 1));
          x = px * f;
          y = py * f;
        }
        return { x, y };
      }) as [{ x: number; y: number }, { x: number; y: number }];
      const before = w.openingFaceoff,
        waiting = w.waitingFor,
        scorer = hockeyStep(w, dt, desired, (force) => {
          const now = performance.now();
          if (force > 50 && now - lastImpact > 70) {
            lastImpact = now;
            feedback.audio.impact(Math.min(1, force / 800));
          }
        });
      if (scorer !== null) {
        if (w.winner === null) {
          feedback.audio.goal();
          feedback.vibrate('success');
        } else feedback.win();
        onStatus(
          w.winner === null
            ? `Player ${scorer + 1} scores! · Player ${w.waitingFor! + 1} serves`
            : 'Match complete',
        );
        onChange(snapshotHockey(w));
      } else if (
        (before && !w.openingFaceoff) ||
        (waiting !== null && w.waitingFor === null)
      )
        onStatus('Puck in play!');
    });
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = HOCKEY_W * dpr;
      canvas.height = HOCKEY_H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w);
    }
    function frame(time: number) {
      if (disposed) return;
      stepper.tick(time);
      draw(ctx, w);
      if (
        w.winner === null &&
        !document.hidden &&
        Date.now() - lastSave >= 1000
      ) {
        lastSave = Date.now();
        save();
      }
      raf = requestAnimationFrame(frame);
    }
    function down(e: PointerEvent) {
      if (w.winner !== null) return;
      const p = canvasPoint(canvas, e, HOCKEY_W, HOCKEY_H),
        i = p.y > HOCKEY_H / 2 ? 0 : 1;
      if (pointers[i] !== null) return;
      pointers[i] = e.pointerId;
      positions[i] = p;
      canvas.setPointerCapture(e.pointerId);
      canvas.focus();
      e.preventDefault();
    }
    function move(e: PointerEvent) {
      const i = pointers.indexOf(e.pointerId);
      if (i < 0) return;
      positions[i] = canvasPoint(canvas, e, HOCKEY_W, HOCKEY_H);
      e.preventDefault();
    }
    function up(e: PointerEvent) {
      const i = pointers.indexOf(e.pointerId);
      if (i >= 0) {
        pointers[i] = null;
        positions[i] = null;
      }
    }
    function keydown(e: KeyboardEvent) {
      if (
        ![
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'w',
          'a',
          's',
          'd',
        ].includes(e.key)
      )
        return;
      if (
        e.target instanceof HTMLElement &&
        ['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName)
      )
        return;
      keys.add(e.key);
      e.preventDefault();
    }
    function keyup(e: KeyboardEvent) {
      keys.delete(e.key);
    }
    function blur() {
      keys.clear();
      save();
    }
    function visibility() {
      if (document.hidden) {
        keys.clear();
        save();
        stepper.reset();
      }
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', visibility);
    onStatus(
      w.openingFaceoff
        ? 'Faceoff · strike the puck to start'
        : w.waitingFor !== null
          ? `Player ${w.waitingFor + 1} serves`
          : 'Puck in play!',
    );
    size();
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      save();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return (
    <>
      <canvas
        ref={canvasRef}
        className="hockey-canvas"
        tabIndex={0}
        aria-label="Air hockey table. Player 1 at bottom uses arrow keys; Player 2 at top uses W A S D. Touch or drag on each half."
      />
      <p className="hockey-help">
        Bottom: arrow keys · Top: W A S D · Touch: drag on your half
      </p>
    </>
  );
}
