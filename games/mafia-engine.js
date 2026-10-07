// Pure, host-authoritative rules. Only viewFor() may cross the room boundary.
const rolesFor = (count) => [
  ...Array(count >= 7 ? 2 : 1).fill('mafia'),
  'doctor', 'detective',
  ...Array(count - (count >= 7 ? 2 : 1) - 2).fill('town'),
];

export function newMafia(count, random = Math.random) {
  if (!Number.isInteger(count) || count < 5 || count > 10) throw Error('Mafia needs 5–10 players.');
  const roles = rolesFor(count);
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return { roles, alive: Array(count).fill(true), phase: 'night', day: 1, revision: 0,
    actions: {}, skipped: [], clues: {}, announcement: 'The town falls asleep. Night 1 begins.',
    winner: null };
}

export function pending(s) {
  if (s.phase === 'discussion' || s.phase === 'over') return [];
  return s.alive.flatMap((alive, i) => {
    if (!alive || Object.hasOwn(s.actions, i) || s.skipped.includes(i)) return [];
    return s.phase === 'vote' || ['mafia', 'doctor', 'detective'].includes(s.roles[i]) ? [i] : [];
  });
}

function outcome(s) {
  const mafia = s.roles.filter((r, i) => r === 'mafia' && s.alive[i]).length;
  const town = s.alive.filter(Boolean).length - mafia;
  s.winner = !mafia ? 'town' : mafia >= town ? 'mafia' : null;
  if (s.winner) s.phase = 'over';
}

export function actMafia(source, request, actor) {
  const s = structuredClone(source);
  const { type, revision, target } = request ?? {};
  if (!Number.isInteger(actor) || actor < 0 || actor >= s.roles.length ||
      revision !== s.revision || s.phase === 'over') throw Error('That turn has passed. Refresh your view.');
  const host = actor === 0;
  if (type === 'mafia-next' && host && s.phase === 'discussion') {
    s.phase = 'vote'; s.actions = {}; s.skipped = [];
    s.announcement = `Day ${s.day}: private voting is open.`;
  } else if (type === 'mafia-skip' && host && ['night', 'vote'].includes(s.phase) &&
      Number.isInteger(target) && pending(s).includes(target)) {
    s.skipped.push(target);
  } else if (type === 'mafia-act' && ['night', 'vote'].includes(s.phase) &&
      s.alive[actor] && pending(s).includes(actor) &&
      (target === null && s.phase === 'vote' ||
        Number.isInteger(target) && target >= 0 && target < s.roles.length &&
        s.alive[target] && target !== actor || s.phase === 'night' &&
        s.roles[actor] === 'doctor' && target === actor)) {
    s.actions[actor] = target;
  } else throw Error('This action is not available to your seat now.');
  s.revision++;
  return s;
}

export function resolveMafia(source, actor) {
  const s = structuredClone(source);
  if (actor !== 0 || !['night', 'vote'].includes(s.phase) || pending(s).length)
    throw Error('Wait for all active seats or mark disconnected seats absent.');
  const counts = new Map();
  for (const [seat, target] of Object.entries(s.actions)) {
    if (s.phase === 'night' && s.roles[seat] !== 'mafia' || target === null) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, count]) => count === max).map(([seat]) => Number(seat));
  const chosen = leaders.length === 1 ? leaders[0] : null;
  if (s.phase === 'night') {
    const doctor = s.roles.indexOf('doctor');
    const detective = s.roles.indexOf('detective');
    if (s.alive[detective] && Object.hasOwn(s.actions, detective)) {
      const target = s.actions[detective];
      (s.clues[detective] ??= []).push({
        day: s.day, target, mafia: s.roles[target] === 'mafia',
      });
    }
    const saved = chosen !== null && s.alive[doctor] && s.actions[doctor] === chosen;
    if (chosen !== null && !saved) s.alive[chosen] = false;
    s.announcement = chosen === null || saved
      ? `Dawn ${s.day}: everyone survived the night.`
      : `Dawn ${s.day}: seat ${chosen + 1} was lost overnight.`;
    s.phase = 'discussion';
  } else {
    if (chosen !== null) s.alive[chosen] = false;
    s.announcement = chosen === null
      ? `Day ${s.day}: the vote tied or no one was chosen. Nobody was eliminated.`
      : `Day ${s.day}: seat ${chosen + 1} was eliminated by secret vote.`;
    s.day++;
    s.phase = 'night';
  }
  outcome(s);
  if (!s.winner && s.phase === 'night') s.announcement += ` Night ${s.day} begins.`;
  if (s.winner) s.announcement += ` ${s.winner === 'town' ? 'Town' : 'Mafia'} wins!`;
  s.actions = {}; s.skipped = []; s.revision++;
  return s;
}

export function viewFor(s, seat) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= s.roles.length) throw Error('Invalid seat.');
  const role = s.roles[seat];
  return {
    phase: s.phase, day: s.day, revision: s.revision,
    alive: [...s.alive], pending: pending(s), skipped: [...s.skipped],
    submitted: Object.keys(s.actions).map(Number), announcement: s.announcement,
    winner: s.winner, role, allies: role === 'mafia'
      ? s.roles.flatMap((r, i) => r === 'mafia' && i !== seat ? [i] : []) : [],
    clues: structuredClone(s.clues[seat] ?? []),
    ownTarget: Object.hasOwn(s.actions, seat) ? s.actions[seat] : undefined,
    roles: s.phase === 'over' ? [...s.roles] : undefined,
  };
}

export function validMafia(s, count) {
  return s && Array.isArray(s.roles) && s.roles.length === count && count >= 5 && count <= 10 &&
    rolesFor(count).sort().join() === [...s.roles].sort().join() &&
    Array.isArray(s.alive) && s.alive.length === count && s.alive.every(v => typeof v === 'boolean') &&
    ['night', 'discussion', 'vote', 'over'].includes(s.phase) &&
    Number.isSafeInteger(s.day) && s.day >= 1 && Number.isSafeInteger(s.revision) &&
    s.revision >= 0 && s.actions && typeof s.actions === 'object' &&
    Array.isArray(s.skipped) && s.clues && typeof s.clues === 'object' &&
    typeof s.announcement === 'string' && [null, 'town', 'mafia'].includes(s.winner);
}
