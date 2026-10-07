import { createShell, wireBack } from '../js/game-shell.js';
import { newMafia, actMafia, resolveMafia, viewFor, validMafia, pending } from './mafia-engine.js';

const roleInfo = {
  mafia: ['The Shadow', 'Choose a target after dark. Find your ally, blend in by day.', '◆'],
  doctor: ['The Guardian', 'Protect one person each night, including yourself.', '✦'],
  detective: ['The Oracle', 'Investigate one person each night. Only you see the result.', '◉'],
  town: ['The Lantern', 'Discuss, deduce, and vote out the hidden Mafia.', '✳'],
};

export default {
  render(el, game, { navigate, multiplayer } = {}) {
    const shell = createShell(el, game, { title: 'Mafia', meta: 'The city is listening · private room' });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('mafia-game');
    const room = multiplayer?.activeGame?.id === 'mafia' &&
      multiplayer.activeGame.playerIds.includes(multiplayer.peerId) ? multiplayer : null;
    const ids = room?.activeGame.playerIds ?? [];
    const seat = ids.indexOf(room?.peerId);
    if (room?.role === 'host' && room.savedGame &&
        (!validMafia(room.savedGame.state, ids.length) ||
          !Number.isSafeInteger(room.savedGame.round) || room.savedGame.round < 1))
      throw Error('The saved Mafia round is invalid. Return to the room lobby and start a new game.');
    const deal = () => newMafia(ids.length, () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000);
    let state = room?.role === 'host' && validMafia(room.savedGame?.state, ids.length)
      ? room.savedGame.state : room?.role === 'host' ? deal() : null;
    let round = room?.role === 'host' ? (room.savedGame?.round ?? 1) : 0;
    let view = state ? viewFor(state, seat) : null;
    let disposed = false;
    let error = '';
    let selected = undefined;
    let lastHostConnected = false;
    shell.getResetButton().disabled = true;
    shell.getResetButton().hidden = true;

    const name = (i) => room.members.find(m => m.id === ids[i])?.name ?? `Seat ${i + 1}`;
    const online = (i) => room.members.find(m => m.id === ids[i])?.connected ?? false;
    const escape = value => String(value).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const label = i => `${escape(name(i))} · ${i + 1}`;

    function publish() {
      room.saveGame('mafia', { state, round });
      view = viewFor(state, seat);
      ids.forEach((id, i) => {
        if (i && online(i)) room.sendPrivateAction(id, {
          type: 'mafia-state', round, view: viewFor(state, i),
        });
      });
      render();
    }

    function submit(action) {
      if (!room || !view && action.type !== 'mafia-sync') return;
      error = '';
      try {
        room.sendAction({ ...action, ...(view ? { revision: view.revision } : {}) });
      } catch (e) { error = e.message; render(); }
    }

    const button = (text, action, secondary = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mafia-button${secondary ? ' mafia-button--quiet' : ''}`;
      b.textContent = text;
      b.addEventListener('click', action);
      return b;
    };

    function render() {
      if (disposed) return;
      const stage = shell.stage;
      stage.replaceChildren();
      if (!room) {
        const message = document.createElement('div');
        message.className = 'mafia-panel';
        message.innerHTML = '<h3>Gather your town</h3><p>Mafia needs 5–10 people in an online private room. Open the multiplayer lobby, invite everyone, then choose Mafia.</p>';
        message.append(button('Open multiplayer lobby ↗', () =>
          multiplayer.showLobby('mafia').catch(e => { error = e.message; render(); })));
        stage.append(message);
        return;
      }
      if (!view) {
        const loading = document.createElement('div');
        loading.className = 'mafia-panel';
        loading.innerHTML = '<h3>Waiting for the host</h3><p>Your private role is being dealt. Keep this tab open; reconnect to your saved seat if needed.</p>';
        stage.append(loading);
        return;
      }
      const { role, phase } = view;
      const card = document.createElement('section');
      card.className = `mafia-hero mafia-hero--${phase}`;
      const roleCard = document.createElement('div');
      roleCard.className = `mafia-role mafia-role--${role}`;
      roleCard.innerHTML = `<span class="mafia-role-sigil" aria-hidden="true">${roleInfo[role][2]}</span>
        <span class="mafia-role-label">YOUR SECRET CARD · ${escape(name(seat))}</span>
        <strong>${roleInfo[role][0]}</strong><small>${roleInfo[role][1]}</small>
        ${view.allies.length ? `<small>Fellow shadow: ${view.allies.map(label).join(', ')}</small>` : ''}`;
      const title = document.createElement('div');
      title.className = 'mafia-headline';
      title.innerHTML = `<span class="mafia-eyebrow">${phase === 'night' ? '☾ AFTER DARK' :
        phase === 'over' ? '✧ THE FINAL VERDICT' : '☀ THE CITY AWAKENS'} · DAY ${view.day}</span>
        <h3>${phase === 'night' ? 'The city sleeps.' : phase === 'discussion' ?
          'Speak your suspicions.' : phase === 'vote' ? 'Cast your secret ballot.' :
          `${view.winner === 'town' ? 'The town prevails.' : 'The shadows prevail.'}`}</h3>
        <p class="mafia-announcement">${escape(view.announcement)}</p>`;
      card.append(title, roleCard);
      stage.append(card);

      const panel = document.createElement('section');
      panel.className = 'mafia-panel';
      panel.setAttribute('aria-live', 'polite');
      if (error) {
        const alert = document.createElement('p');
        alert.className = 'mafia-error'; alert.setAttribute('role', 'alert'); alert.textContent = error;
        panel.append(alert);
      }
      const heading = document.createElement('h4');
      const mine = view.pending.includes(seat);
      const disconnected = ids.flatMap((_, i) => !online(i) && view.pending.includes(i) ? [i] : []);
      heading.textContent = phase === 'night'
        ? mine ? role === 'mafia' ? 'Choose a night target' :
          role === 'doctor' ? 'Who will you protect?' : 'Who will you investigate?' :
          !view.alive[seat] ? 'You are watching from the sidelines' : 'Sleep until dawn'
        : phase === 'discussion' ? 'The floor is yours' :
          phase === 'vote' ? mine ? 'Who should leave the city?' : 'Ballot sealed' : 'The story is complete';
      panel.append(heading);
      const hint = document.createElement('p');
      hint.textContent = phase === 'night'
        ? mine ? 'Only you and the trusted room host can see your selection.' :
          'Wait for the remaining night roles. Speak together outside the app when day begins.'
        : phase === 'discussion' ? 'Talk by voice or in person. No in-app chat; your private role stays on this device.' :
          phase === 'vote' ? mine ? 'Choose another living player or abstain. Ballots stay private until resolution.' :
            'Your ballot is in. Wait for the others.' :
            'All roles are now visible. Start a fresh mystery with the same seats.';
      panel.append(hint);

      if (mine && ['night', 'vote'].includes(phase)) {
        const targets = document.createElement('div'); targets.className = 'mafia-targets';
        view.alive.forEach((alive, i) => {
          if (!alive || (i === seat && role !== 'doctor' || i === seat && phase === 'vote')) return;
          const b = button(`${i === seat ? '✦ ' : '◇ '}${name(i)} · ${i + 1}`, () => {
            selected = i; render();
          }, selected !== i);
          b.classList.add('mafia-target');
          b.setAttribute('aria-pressed', String(selected === i));
          targets.append(b);
        });
        if (phase === 'vote') {
          const abstain = button('Abstain', () => { selected = null; render(); }, selected !== null);
          abstain.setAttribute('aria-pressed', String(selected === null));
          targets.append(abstain);
        }
        panel.append(targets);
        if (selected !== undefined) panel.append(button(`Confirm ${selected === null ? 'abstention' : name(selected)} ↗`, () => {
          submit({ type: 'mafia-act', target: selected }); selected = undefined;
        }));
      }
      if (role === 'detective' && view.clues.length) {
        const clues = document.createElement('details');
        clues.className = 'mafia-clues';
        clues.innerHTML = '<summary>My private case file</summary>';
        view.clues.forEach(c => {
          const line = document.createElement('p');
          line.textContent = `Night ${c.day}: ${name(c.target)} — ${c.mafia ? 'Mafia' : 'not Mafia'}.`;
          clues.append(line);
        });
        panel.append(clues);
      }
      if (phase === 'over') {
        const roles = document.createElement('div');
        roles.className = 'mafia-reveal';
        view.roles?.forEach((r, i) => {
          const line = document.createElement('span');
          line.textContent = `${name(i)} · ${roleInfo[r][0]}`;
          roles.append(line);
        });
        panel.append(roles);
        if (room.role === 'host') panel.append(button('Deal another round ↗', () => submit({ type: 'mafia-restart' })));
      }
      if (phase === 'discussion' && room.role === 'host')
        panel.append(button('End discussion · open secret vote ↗', () => submit({ type: 'mafia-next' })));
      const missing = view.pending.filter(i => online(i));
      if (['night', 'vote'].includes(phase)) {
        const waiting = document.createElement('p');
        waiting.className = 'mafia-wait';
        waiting.textContent = view.pending.length ? `Waiting for ${missing.length} connected seat${missing.length === 1 ? '' : 's'}${disconnected.length ? ` · ${disconnected.length} disconnected` : ''}.` :
          'All actions are in. The host can reveal what happened.';
        panel.append(waiting);
        if (room.role === 'host') {
          for (const i of disconnected)
            panel.append(button(`Mark ${name(i)} absent this phase`, () =>
              submit({ type: 'mafia-skip', target: i }), true));
          if (!view.pending.length)
            panel.append(button(phase === 'night' ? 'Reveal the dawn ↗' : 'Count the ballots ↗',
              () => submit({ type: 'mafia-resolve' })));
        }
      }
      stage.append(panel);
      const roster = document.createElement('section'); roster.className = 'mafia-roster';
      roster.innerHTML = '<h4>People of the city</h4>';
      const grid = document.createElement('div'); grid.className = 'mafia-roster-grid';
      ids.forEach((_, i) => {
        const tile = document.createElement('div');
        tile.className = `mafia-person${view.alive[i] ? '' : ' mafia-person--out'}`;
        tile.innerHTML = `<span class="mafia-person-symbol" aria-hidden="true">${view.alive[i] ? '✺' : '◌'}</span>
          <span><strong>${label(i)}</strong><small>${!view.alive[i] ? 'Eliminated · spectating' :
            !online(i) ? 'Disconnected' : view.pending.includes(i) ? 'Action needed' :
              view.submitted.includes(i) ? 'Action received' : 'In the city'}</small></span>`;
        grid.append(tile);
      });
      roster.append(grid); stage.append(roster);
      const guide = document.createElement('details');
      guide.className = 'mafia-guide';
      guide.innerHTML = '<summary>House rules & privacy</summary><p>5–10 players · 1 Mafia at 5–6, 2 at 7–10. Every night Mafia chooses a victim, Doctor protects one seat and Detective investigates one seat. Mafia votes tie: no attack. Day votes tie: nobody leaves. Town wins when all Mafia leave; Mafia wins at parity. Eliminated seats observe but cannot act. The host device knows all roles and actions; only trust people you are comfortable playing with.</p>';
      stage.append(guide);
    }

    const off = room?.on(event => {
      if (disposed || room.activeGame?.id !== 'mafia') return;
      if (event.type === 'state') {
        if (room.role === 'guest') {
          const connected = online(0);
          if (connected && !lastHostConnected) submit({ type: 'mafia-sync' });
          lastHostConnected = connected;
        }
        render();
        return;
      }
      if (event.type === 'reconnected' && room.role === 'guest') {
        submit({ type: 'mafia-sync' }); return;
      }
      if (event.type !== 'action') return;
      if (room.role === 'host') {
        const actor = ids.indexOf(event.from);
        if (actor < 0) return;
        const a = event.action;
        if (a?.type === 'mafia-sync') {
          if (actor !== 0 && online(actor)) room.sendPrivateAction(event.from,
            { type: 'mafia-state', round, view: viewFor(state, actor) });
          return;
        }
        try {
          if (a?.type === 'mafia-restart' && actor === 0 && state.phase === 'over' &&
              a.revision === state.revision) {
            state = deal(); round++;
          } else if (a?.type === 'mafia-resolve' && actor === 0 &&
              a.revision === state.revision) state = resolveMafia(state, actor);
          else if (a?.type === 'mafia-skip') {
            if (online(a.target)) throw Error('Only disconnected seats can be marked absent.');
            state = actMafia(state, a, actor);
          } else state = actMafia(state, a, actor);
          selected = undefined; error = ''; publish();
          window.arcadeAudio?.chime?.();
        } catch (e) {
          if (actor === 0) { error = e.message; render(); }
          else if (online(actor)) room.sendPrivateAction(event.from,
            { type: 'mafia-state', round, view: viewFor(state, actor), error: e.message });
        }
      } else if (event.from === ids[0] && event.action?.type === 'mafia-state' &&
          Number.isSafeInteger(event.action.round) && event.action.round >= round &&
          Number.isSafeInteger(event.action.view?.revision) &&
          (event.action.round > round || event.action.view.revision >= (view?.revision ?? -1))) {
        if (event.action.view.roles && event.action.view.phase !== 'over') return;
        if (event.action.round !== round) selected = undefined;
        round = event.action.round; view = event.action.view;
        error = event.action.error ?? ''; render();
      }
    });
    if (room) {
      if (room.role === 'host') publish();
      else { render(); submit({ type: 'mafia-sync' }); }
    } else render();
    return { dispose() { disposed = true; off?.(); shell.root.remove(); } };
  },
};
