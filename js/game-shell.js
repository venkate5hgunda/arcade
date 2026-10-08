// Shared chrome for game views. Each game module calls `createShell(el, game)`
// once to get a consistent header (back button, title, meta, reset button) and
// a stage container it can fill. Keeping this in one place means every game
// automatically gets the same polished, responsive frame.

import { openNameEditor } from './player-names.js';
import { room } from './multiplayer.js';
import { GAME_HELP, openGameHelp } from './game-help.js';
import { iconMarkup } from './icons.js';

export function createShell(container, game, { title, meta, resetLabel = 'Reset' } = {}) {
  const shell = document.createElement('div');
  shell.className = 'game-shell';
  shell.style.setProperty('--accent', game.color);
  shell.innerHTML = `
    <div class="game-head">
      <button class="back-btn game-ui-action game-ui-action--secondary" type="button" data-nav="back">${iconMarkup('tabler:arrow-left')} Back to games</button>
      <div class="game-head-center">
        <div class="game-head-identity">
          ${game.icon ? `<span class="game-head-art">${iconMarkup(game.icon, 'catalog-icon')}</span>` : ''}
          <div>
            <h2 class="game-title">${title || game.name}</h2>
            ${meta ? `<p class="game-meta">${meta}</p>` : ''}
          </div>
        </div>
      </div>
      <button class="reset-btn game-ui-action game-ui-action--secondary" type="button" data-action="reset">${iconMarkup('tabler:refresh')} ${resetLabel}</button>
    </div>
    <div class="game-stage"></div>`;

  container.appendChild(shell);
  const resetButton = shell.querySelector('[data-action="reset"]');
  const resetToast = document.createElement('div');
  resetToast.className = 'reset-toast';
  resetToast.setAttribute('role', 'status');
  resetToast.hidden = true;
  shell.querySelector('.game-head').appendChild(resetToast);
  let resetToastTimer;
  resetButton.addEventListener('click', () => {
    if (resetButton.disabled || shell.querySelector('.setup-card')) return;
    resetToast.textContent = room.activeGame?.id === game.id ? 'Restart requested' : 'Game reset';
    resetToast.hidden = false;
    clearTimeout(resetToastTimer);
    resetToastTimer = setTimeout(() => { resetToast.hidden = true; }, 2400);
  });
  const hasNames = game.players?.max > 1 && room.activeGame?.id !== game.id;
  const tools = GAME_HELP[game.id] || hasNames ? document.createElement('details') : null;
  if (tools) {
    tools.className = 'game-tools';
    const summary = document.createElement('summary');
    summary.textContent = 'Help & player options';
    tools.appendChild(summary);
    shell.querySelector('.game-head-center').appendChild(tools);
  }
  if (GAME_HELP[game.id]) {
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'game-help-btn';
    help.innerHTML = `${iconMarkup('tabler:info-circle')} How to play`;
    help.addEventListener('click', () => openGameHelp(game.id));
    tools.appendChild(help);
  }
  if (hasNames) {
    const names = document.createElement('button');
    names.type = 'button';
    names.className = 'game-names-btn';
    names.innerHTML = `${iconMarkup('tabler:pencil')} Player names`;
    names.addEventListener('click', () => openNameEditor(game.players.max));
    tools.appendChild(names);
  }
  return {
    root: shell,
    stage: shell.querySelector('.game-stage'),
    getBackButton: () => shell.querySelector('[data-nav="back"]'),
    getResetButton: () => shell.querySelector('[data-action="reset"]'),
  };
}

// Wire the back button to the router's navigate(null).
// Accepts either the shell object returned by createShell() or a raw element.
export function wireBack(shell, navigate) {
  const root = shell instanceof Element ? shell : shell.root;
  const btn = root.querySelector('[data-nav="back"]');
  if (btn) btn.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(null);
  });
}

// Reusable pre-game setup step. Every game can call this to gather choices
// (mode, player count, difficulty, ...) before the board renders — a small,
// generic "wizard" so new games get a consistent way to ask questions without
// each one hand-rolling its own picker wiring. Visual skin is left to the
// caller via `themeClass` + each game's own CSS, so games still get their own
// vibe; only the interaction plumbing is shared.
//
// fields: [{ key, label, help?, options: [{ value, label }], default }]
// Returns a Promise that resolves with { [key]: value } when the user starts.
// Rotary dial config: each `stepDegrees` of rotation adds `step` to the value,
// starting from `step`, for up to `maxTurns` full revolutions.
export function clockField({ step = 30, stepDegrees = 90, maxTurns = 3, unit = 's', ...field }) {
  if (360 % stepDegrees) throw new Error('Clock stepDegrees must divide 360.');
  const count = Math.round(maxTurns * 360 / stepDegrees);
  const options = Array.from({ length: count }, (_, index) => {
    const value = (index + 1) * step;
    return { value: String(value), label: `${value}${unit}` };
  });
  const fallback = options.find(option => option.value === String(field.default)) ? String(field.default) : options[0].value;
  return { ...field, type: 'clock', step, stepDegrees, maxTurns, options, default: fallback };
}

export function renderSetup(stage, { title, subtitle, fields, startLabel = 'Start', themeClass = '', validate, summary } = {}) {
  fields = fields.map(field => {
    if (field.type === 'clock') return clockField(field);
    if (field.type || !field.options || field.options.length < 2) return field;
    const numeric = field.options.every(option => /^\d+$/.test(option.value));
    const count = ['players', 'count'].includes(field.key);
    const type = numeric && (count || field.options.length >= 3) ? 'discrete' :
      field.options.length >= 3 ? 'select' : undefined;
    return { ...field, type };
  });
  return new Promise((resolve) => {
    const values = {};
    for (const f of fields) {
      const value = f.default ?? f.options?.[0].value ?? '';
      values[f.key] = Array.isArray(value) ? [...value] : value;
    }
    const configurable = fields.filter(f => ['number', 'range', 'multiple', 'clock'].includes(f.type) || f.options.length > 1);

    const card = document.createElement('div');
    card.className = `setup-card${themeClass ? ' ' + themeClass : ''}`;
    card.innerHTML = `
      ${title ? `<h3 class="setup-title">${title}</h3>` : ''}
      ${subtitle ? `<p class="setup-subtitle">${subtitle}</p>` : ''}
      <p class="setup-guide">${configurable.length ?
        'Ready with the choices below. Expand configuration to customize, then start playing.' :
        'Everything is ready. Start when you are.'}</p>
      ${configurable.length ? `<p class="setup-preview" aria-live="polite"></p>
      <details class="setup-config">
        <summary>Game configuration</summary>
        <div class="setup-fields"></div>
      </details>` : ''}
      <button class="setup-start-btn" type="button">${startLabel} ${iconMarkup('tabler:arrow-right')}</button>`;
    stage.appendChild(card);
    const feedback = validate || summary ? document.createElement('p') : null;
    if (feedback) {
      feedback.className = 'setup-field-help';
      feedback.setAttribute('aria-live', 'polite');
      card.appendChild(feedback);
    }
    function updateFeedback() {
      if (!feedback) return;
      const error = validate?.(values) ?? '';
      feedback.textContent = error || summary?.(values) || '';
      card.querySelector('.setup-start-btn').disabled = !!error;
    }

    const fieldsEl = card.querySelector('.setup-fields');

    function updatePreview(visible) {
      card.querySelector('.setup-preview').textContent = visible.slice(0, 3).map(f => {
        const value = values[f.key];
        const label = f.type === 'range' ? value.join('–') : f.type === 'multiple' ?
          (value.length === f.options.length ? 'All levels' : f.options.filter(option => value.includes(option.value)).map(option => option.label).join(' + ') || 'None') :
          f.options?.find(opt => opt.value === value)?.label ?? value;
        return `${f.label}: ${label}`;
      }).join(' · ') + (visible.length > 3 ? ` · ${visible.length - 3} more options in configuration` : '');
    }

    function renderFields() {
      if (!fieldsEl) { updateFeedback(); return; }
      fieldsEl.innerHTML = '';
      const visible = configurable.filter(f => !f.when || f.when(values));
      updatePreview(visible);
      for (const f of visible) {
        const group = document.createElement('div');
        group.className = 'setup-field';
        group.innerHTML = `<span class="setup-field-label">${f.label}</span>
          <div class="setup-options" role="group" aria-label="${f.label}"></div>`;
        const optionsEl = group.querySelector('.setup-options');
        if (f.type === 'discrete') {
          optionsEl.classList.add('setup-discrete-options');
          const readout = document.createElement('output');
          readout.className = 'setup-discrete-readout';
          const input = document.createElement('input');
          input.type = 'range';
          input.min = '0'; input.max = String(f.options.length - 1); input.step = '1';
          input.setAttribute('aria-label', f.label);
          input.value = String(Math.max(0, f.options.findIndex(option => option.value === values[f.key])));
          function updateChoice() {
            const option = f.options[Number(input.value)];
            values[f.key] = option.value;
            readout.textContent = option.label;
            input.setAttribute('aria-valuetext', option.label);
            updatePreview(visible);
            updateFeedback();
          }
          input.addEventListener('input', updateChoice);
          optionsEl.appendChild(readout); optionsEl.appendChild(input);
          const bounds = document.createElement('div');
          bounds.className = 'setup-range-bounds';
          const first = document.createElement('span'), last = document.createElement('span');
          first.textContent = f.options[0].label; last.textContent = f.options.at(-1).label;
          bounds.appendChild(first); bounds.appendChild(last); optionsEl.appendChild(bounds);
          updateChoice();
        }
        if (f.type === 'select') {
          const select = document.createElement('select');
          select.setAttribute('aria-label', f.label);
          for (const option of f.options) {
            const item = document.createElement('option');
            item.value = option.value;
            item.textContent = option.label;
            select.appendChild(item);
          }
          select.value = values[f.key];
          select.addEventListener('change', () => {
            values[f.key] = select.value;
            updatePreview(visible);
            updateFeedback();
          });
          optionsEl.appendChild(select);
        }
        if (f.type === 'clock') {
          optionsEl.classList.add('setup-clock-options');
          const { stepDegrees, maxTurns } = f;
          const stepsPerTurn = 360 / stepDegrees;
          const clock = document.createElement('div');
          clock.className = 'setup-clock';
          clock.tabIndex = 0;
          clock.setAttribute('role', 'slider');
          clock.setAttribute('aria-label', f.label);
          clock.setAttribute('aria-valuemin', f.options[0].value);
          clock.setAttribute('aria-valuemax', f.options.at(-1).value);
          const part = (className, parent = clock) => {
            const el = document.createElement('span');
            el.className = className;
            el.setAttribute('aria-hidden', 'true');
            parent.appendChild(el);
            return el;
          };
          part('setup-clock-track');
          const arc = part('setup-clock-arc');
          if (stepsPerTurn <= 24) {
            for (let tick = 0; tick < stepsPerTurn; tick++) {
              part('setup-clock-tick').style.setProperty('--tick', `${tick * stepDegrees}deg`);
            }
          }
          const knob = part('setup-clock-knob');
          const face = part('setup-clock-face');
          const readout = document.createElement('output');
          readout.className = 'setup-clock-readout';
          face.appendChild(readout);
          const laps = maxTurns > 1 ? part('setup-clock-laps', face) : null;
          const lapDots = laps ? Array.from({ length: maxTurns }, () => part('setup-clock-lap', laps)) : [];
          const indexOf = () => Math.max(0, f.options.findIndex(option => option.value === values[f.key]));
          const format = value => f.format?.(Number(value)) ??
            `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
          function updateClock(index) {
            const bounded = Math.max(0, Math.min(f.options.length - 1, index));
            const changed = values[f.key] !== f.options[bounded].value;
            values[f.key] = f.options[bounded].value;
            const total = (bounded + 1) * stepDegrees;
            const turn = Math.ceil(total / 360);
            const within = total - (turn - 1) * 360;
            clock.style.setProperty('--clock-angle', `${within}deg`);
            clock.dataset.turn = String(turn);
            lapDots.forEach((dot, lap) => {
              dot.classList.toggle('done', lap < turn - 1);
              dot.classList.toggle('active', lap === turn - 1);
            });
            arc.classList.toggle('setup-clock-arc--lapped', turn > 1);
            clock.setAttribute('aria-valuenow', values[f.key]);
            clock.setAttribute('aria-valuetext', f.options[bounded].label);
            readout.textContent = format(Number(values[f.key]));
            updatePreview(visible);
            updateFeedback();
            if (changed) {
              window.arcadeAudio?.prepare();
              window.arcadeAudio?.tap();
              window.haptics?.select();
            }
          }
          function angle(event) {
            const bounds = clock.getBoundingClientRect();
            return (Math.atan2(event.clientY - bounds.top - bounds.height / 2,
              event.clientX - bounds.left - bounds.width / 2) * 180 / Math.PI + 90 + 360) % 360;
          }
          let drag = null;
          clock.addEventListener('pointerdown', event => {
            if (event.button !== 0 || drag) return;
            event.preventDefault();
            clock.focus();
            drag = { id: event.pointerId, previous: angle(event), rotation: 0, travel: 0, index: indexOf() };
            clock.classList.add('dragging');
            clock.setPointerCapture(event.pointerId);
          });
          clock.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            const current = angle(event);
            const delta = ((current - drag.previous + 540) % 360) - 180;
            drag.travel += Math.abs(delta);
            drag.rotation = Math.max(-drag.index * stepDegrees,
              Math.min((f.options.length - 1 - drag.index) * stepDegrees, drag.rotation + delta));
            drag.previous = current;
            updateClock(drag.index + Math.round(drag.rotation / stepDegrees));
          });
          const stopDrag = () => { drag = null; clock.classList.remove('dragging'); };
          clock.addEventListener('pointerup', event => {
            if (!drag || drag.id !== event.pointerId) return;
            if (drag.travel < 8) {
              const step = Math.round(angle(event) / stepDegrees) || stepsPerTurn;
              const turn = Math.floor(indexOf() / stepsPerTurn);
              updateClock(turn * stepsPerTurn + step - 1);
            }
            stopDrag();
            clock.releasePointerCapture(event.pointerId);
          });
          clock.addEventListener('pointercancel', stopDrag);
          clock.addEventListener('lostpointercapture', stopDrag);
          clock.addEventListener('keydown', event => {
            const delta = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 :
              ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -1 : 0;
            if (!delta && !['Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            updateClock(event.key === 'Home' ? 0 : event.key === 'End' ? f.options.length - 1 : indexOf() + delta);
          });
          optionsEl.appendChild(clock);
          updateClock(indexOf());
        }
        if (f.type === 'range') {
          optionsEl.classList.add('setup-year-range');
          const readout = document.createElement('output');
          readout.className = 'setup-range-readout';
          optionsEl.appendChild(readout);
          const track = document.createElement('div');
          track.className = 'setup-range-track';
          optionsEl.appendChild(track);
          const inputs = [0, 1].map(index => {
            const input = document.createElement('input');
            input.type = 'range';
            input.min = String(f.min); input.max = String(f.max); input.step = '1';
            input.setAttribute('aria-label', index === 0 ? 'From year' : 'Through year');
            input.addEventListener('input', () => {
              const [lower, upper] = values[f.key];
              const next = Number(input.value);
              values[f.key] = index === 0 ? [Math.min(next, upper), upper] : [lower, Math.max(next, lower)];
              updateRange();
              updatePreview(visible);
              updateFeedback();
            });
            input.addEventListener('pointerdown', () => {
              inputs.forEach((other, otherIndex) => { other.style.zIndex = otherIndex === index ? '3' : '2'; });
            });
            track.appendChild(input);
            return input;
          });
          function updateRange() {
            const [lower, upper] = values[f.key];
            readout.textContent = `${lower} – ${upper}`;
            const span = f.max - f.min || 1;
            track.style.setProperty('--range-from', `${(lower - f.min) / span * 100}%`);
            track.style.setProperty('--range-to', `${(upper - f.min) / span * 100}%`);
            inputs.forEach((input, index) => {
              input.value = String(index === 0 ? lower : upper);
              input.setAttribute('aria-valuemin', String(index === 0 ? f.min : lower));
              input.setAttribute('aria-valuemax', String(index === 0 ? upper : f.max));
              input.setAttribute('aria-valuetext', `${input.value}`);
            });
          }
          updateRange();
          const bounds = document.createElement('div');
          bounds.className = 'setup-range-bounds';
          const first = document.createElement('span'), last = document.createElement('span');
          first.textContent = String(f.min); last.textContent = String(f.max);
          bounds.appendChild(first); bounds.appendChild(last);
          optionsEl.appendChild(bounds);
        }
        if (f.type === 'number') {
          const input = document.createElement('input');
          input.type = 'number';
          input.min = String(f.min); input.max = String(f.max); input.step = '1';
          input.value = values[f.key];
          input.setAttribute('aria-label', f.label);
          input.addEventListener('input', () => { values[f.key] = input.value; updateFeedback(); });
          optionsEl.appendChild(input);
        }
        if (f.type === 'multiple') optionsEl.classList.add('setup-multi-options');
        for (const opt of ['clock', 'discrete', 'select'].includes(f.type) ? [] : f.options ?? []) {
          const selected = f.type === 'multiple' ? values[f.key].includes(opt.value) : values[f.key] === opt.value;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'setup-option' + (f.type === 'multiple' ? ' setup-choice-chip' : '') + (selected ? ' active' : '');
          btn.setAttribute('aria-pressed', String(selected));
          btn.textContent = opt.label;
          if (opt.badge) {
            btn.dataset.level = opt.badge;
            btn.setAttribute('aria-label', `${opt.badge} · ${opt.label}`);
          }
          btn.addEventListener('click', () => {
            window.arcadeAudio?.prepare();
            window.arcadeAudio?.tap();
            window.haptics?.select();
            if (f.type === 'multiple') {
              const next = values[f.key].includes(opt.value) ?
                values[f.key].filter(value => value !== opt.value) : [...values[f.key], opt.value];
              values[f.key] = f.options.filter(option => next.includes(option.value)).map(option => option.value);
              btn.classList.toggle('active', values[f.key].includes(opt.value));
              btn.setAttribute('aria-pressed', String(values[f.key].includes(opt.value)));
              updatePreview(visible);
              updateFeedback();
              return;
            }
            values[f.key] = opt.value;
            renderFields();
            fieldsEl.querySelector(`[data-setup-key="${f.key}"] [aria-pressed="true"]`)?.focus();
          });
          optionsEl.appendChild(btn);
        }
        group.dataset.setupKey = f.key;
        if (f.help) {
          const hint = document.createElement('p');
          hint.className = 'setup-field-help';
          hint.textContent = f.help;
          group.appendChild(hint);
        }
        fieldsEl.appendChild(group);
      }
      updateFeedback();
    }

    renderFields();

    card.querySelector('.setup-start-btn').addEventListener('click', () => {
      if (validate?.(values)) { updateFeedback(); return; }
      window.arcadeAudio?.prepare();
      window.arcadeAudio?.chime();
      window.haptics?.medium();
      card.remove();
      resolve(values);
    });
  });
}
