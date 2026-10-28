// Host-authoritative port of the original rules. Only a seat projection crosses the room boundary.
export type Role = 'mafia' | 'doctor' | 'detective' | 'town';
export type Phase = 'night' | 'discussion' | 'vote' | 'over';
export interface Clue {
  day: number;
  target: number;
  mafia: boolean;
}
export interface MafiaState {
  roles: Role[];
  alive: boolean[];
  phase: Phase;
  day: number;
  revision: number;
  actions: Record<number, number | null>;
  skipped: number[];
  clues: Record<number, Clue[]>;
  announcement: string;
  winner: 'town' | 'mafia' | null;
}
export interface MafiaView {
  phase: Phase;
  day: number;
  revision: number;
  alive: boolean[];
  pending: number[];
  skipped: number[];
  submitted: number[];
  announcement: string;
  winner: 'town' | 'mafia' | null;
  role: Role;
  allies: number[];
  clues: Clue[];
  ownTarget?: number | null;
  roles?: Role[];
}
export interface MafiaRequest {
  type?: string;
  revision?: number;
  target?: number | null;
}

const rolesFor = (count: number): Role[] => [
  ...Array<Role>(count >= 7 ? 2 : 1).fill('mafia'),
  'doctor',
  'detective',
  ...Array<Role>(count - (count >= 7 ? 2 : 1) - 2).fill('town'),
];

export function newMafia(count: number, random = Math.random): MafiaState {
  if (!Number.isInteger(count) || count < 5 || count > 10)
    throw Error('Mafia needs 5–10 players.');
  const roles = rolesFor(count);
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return {
    roles,
    alive: Array(count).fill(true),
    phase: 'night',
    day: 1,
    revision: 0,
    actions: {},
    skipped: [],
    clues: {},
    announcement: 'The town falls asleep. Night 1 begins.',
    winner: null,
  };
}

export function pending(s: MafiaState): number[] {
  if (s.phase === 'discussion' || s.phase === 'over') return [];
  return s.alive.flatMap((alive, i) => {
    if (!alive || Object.hasOwn(s.actions, i) || s.skipped.includes(i))
      return [];
    return s.phase === 'vote' ||
      ['mafia', 'doctor', 'detective'].includes(s.roles[i])
      ? [i]
      : [];
  });
}

function outcome(s: MafiaState) {
  const mafia = s.roles.filter((r, i) => r === 'mafia' && s.alive[i]).length;
  const town = s.alive.filter(Boolean).length - mafia;
  s.winner = !mafia ? 'town' : mafia >= town ? 'mafia' : null;
  if (s.winner) s.phase = 'over';
}

export function actMafia(
  source: MafiaState,
  request: MafiaRequest,
  actor: number,
): MafiaState {
  const s = structuredClone(source);
  const { type, revision, target } = request ?? {};
  if (
    !Number.isInteger(actor) ||
    actor < 0 ||
    actor >= s.roles.length ||
    revision !== s.revision ||
    s.phase === 'over'
  )
    throw Error('That turn has passed. Refresh your view.');
  const host = actor === 0;
  if (type === 'mafia-next' && host && s.phase === 'discussion') {
    s.phase = 'vote';
    s.actions = {};
    s.skipped = [];
    s.announcement = `Day ${s.day}: private voting is open.`;
  } else if (
    type === 'mafia-skip' &&
    host &&
    ['night', 'vote'].includes(s.phase) &&
    typeof target === 'number' &&
    Number.isInteger(target) &&
    pending(s).includes(target)
  ) {
    s.skipped.push(target);
  } else if (
    type === 'mafia-act' &&
    ['night', 'vote'].includes(s.phase) &&
    s.alive[actor] &&
    pending(s).includes(actor) &&
    ((target === null && s.phase === 'vote') ||
      (typeof target === 'number' &&
        Number.isInteger(target) &&
        target >= 0 &&
        target < s.roles.length &&
        s.alive[target] &&
        target !== actor) ||
      (s.phase === 'night' && s.roles[actor] === 'doctor' && target === actor))
  ) {
    s.actions[actor] = target!;
  } else throw Error('This action is not available to your seat now.');
  s.revision++;
  return s;
}

export function resolveMafia(source: MafiaState, actor: number): MafiaState {
  const s = structuredClone(source);
  if (actor !== 0 || !['night', 'vote'].includes(s.phase) || pending(s).length)
    throw Error('Wait for all active seats or mark disconnected seats absent.');
  const counts = new Map<number, number>();
  for (const [seat, target] of Object.entries(s.actions)) {
    if (
      (s.phase === 'night' && s.roles[Number(seat)] !== 'mafia') ||
      target === null
    )
      continue;
    counts.set(target!, (counts.get(target!) ?? 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  const leaders = [...counts]
    .filter(([, count]) => count === max)
    .map(([seat]) => Number(seat));
  const chosen = leaders.length === 1 ? leaders[0] : null;
  if (s.phase === 'night') {
    const doctor = s.roles.indexOf('doctor');
    const detective = s.roles.indexOf('detective');
    if (s.alive[detective] && Object.hasOwn(s.actions, detective)) {
      const target = s.actions[detective]!;
      (s.clues[detective] ??= []).push({
        day: s.day,
        target,
        mafia: s.roles[target] === 'mafia',
      });
    }
    const saved =
      chosen !== null && s.alive[doctor] && s.actions[doctor] === chosen;
    if (chosen !== null && !saved) s.alive[chosen] = false;
    s.announcement =
      chosen === null || saved
        ? `Dawn ${s.day}: everyone survived the night.`
        : `Dawn ${s.day}: seat ${chosen + 1} was lost overnight.`;
    s.phase = 'discussion';
  } else {
    if (chosen !== null) s.alive[chosen] = false;
    s.announcement =
      chosen === null
        ? `Day ${s.day}: the vote tied or no one was chosen. Nobody was eliminated.`
        : `Day ${s.day}: seat ${chosen + 1} was eliminated by secret vote.`;
    s.day++;
    s.phase = 'night';
  }
  outcome(s);
  if (!s.winner && s.phase === 'night')
    s.announcement += ` Night ${s.day} begins.`;
  if (s.winner)
    s.announcement += ` ${s.winner === 'town' ? 'Town' : 'Mafia'} wins!`;
  s.actions = {};
  s.skipped = [];
  s.revision++;
  return s;
}

export function viewFor(s: MafiaState, seat: number): MafiaView {
  if (!Number.isInteger(seat) || seat < 0 || seat >= s.roles.length)
    throw Error('Invalid seat.');
  const role = s.roles[Number(seat)];
  return {
    phase: s.phase,
    day: s.day,
    revision: s.revision,
    alive: [...s.alive],
    pending: pending(s),
    skipped: [...s.skipped],
    submitted: Object.keys(s.actions).map(Number),
    announcement: s.announcement,
    winner: s.winner,
    role,
    allies:
      role === 'mafia'
        ? s.roles.flatMap((r, i) => (r === 'mafia' && i !== seat ? [i] : []))
        : [],
    clues: structuredClone(s.clues[seat] ?? []),
    ownTarget: Object.hasOwn(s.actions, seat) ? s.actions[seat] : undefined,
    roles: s.phase === 'over' ? [...s.roles] : undefined,
  };
}

export function validMafia(value: unknown, count: number): value is MafiaState {
  const s = value as MafiaState;
  if (
    !Number.isInteger(count) ||
    count < 5 ||
    count > 10 ||
    !s ||
    !Array.isArray(s.roles) ||
    s.roles.length !== count
  )
    return false;
  if (rolesFor(count).sort().join() !== [...s.roles].sort().join())
    return false;
  if (
    !Array.isArray(s.alive) ||
    s.alive.length !== count ||
    !s.alive.every((v) => typeof v === 'boolean') ||
    !s.alive.some(Boolean)
  )
    return false;
  if (!['night', 'discussion', 'vote', 'over'].includes(s.phase)) return false;
  if (!Number.isSafeInteger(s.day) || s.day < 1) return false;
  if (!Number.isSafeInteger(s.revision) || s.revision < 0) return false;
  const isRecord = (value: unknown) =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
  if (!isRecord(s.actions) || !isRecord(s.clues)) return false;
  if (!Array.isArray(s.skipped) || new Set(s.skipped).size !== s.skipped.length)
    return false;
  if (
    !s.skipped.every(
      (i) => Number.isInteger(i) && i >= 0 && i < count && s.alive[i],
    )
  )
    return false;
  if (
    s.phase !== 'night' &&
    s.phase !== 'vote' &&
    (Object.keys(s.actions).length || s.skipped.length)
  )
    return false;
  const skipped = new Set(s.skipped);
  for (const [seat, clues] of Object.entries(s.clues)) {
    const si = Number(seat);
    if (
      !Number.isInteger(si) ||
      String(si) !== seat ||
      si < 0 ||
      si >= count ||
      s.roles[si] !== 'detective' ||
      !Array.isArray(clues) ||
      !clues.length
    )
      return false;
    let previousDay = 0;
    for (const clue of clues) {
      if (
        !isRecord(clue) ||
        Object.keys(clue).sort().join() !== 'day,mafia,target' ||
        !Number.isSafeInteger(clue.day) ||
        clue.day <= previousDay ||
        clue.day > s.day ||
        !Number.isInteger(clue.target) ||
        clue.target < 0 ||
        clue.target >= count ||
        typeof clue.mafia !== 'boolean' ||
        clue.mafia !== (s.roles[clue.target] === 'mafia')
      )
        return false;
      previousDay = clue.day;
    }
  }
  for (const [actor, target] of Object.entries(s.actions)) {
    const ai = Number(actor);
    if (
      !Number.isInteger(ai) ||
      String(ai) !== actor ||
      ai < 0 ||
      ai >= count ||
      !s.alive[ai] ||
      skipped.has(ai) ||
      !['night', 'vote'].includes(s.phase)
    )
      return false;
    if (s.phase === 'vote') {
      if (
        target !== null &&
        (!Number.isInteger(target) ||
          target < 0 ||
          target >= count ||
          !s.alive[target] ||
          target === ai)
      )
        return false;
    } else {
      if (
        !['mafia', 'doctor', 'detective'].includes(s.roles[ai]) ||
        typeof target !== 'number' ||
        !Number.isInteger(target) ||
        target < 0 ||
        target >= count ||
        !s.alive[target] ||
        (target === ai && s.roles[ai] !== 'doctor')
      )
        return false;
    }
  }
  const eligible = (seat: number) =>
    s.phase === 'vote' ||
    ['mafia', 'doctor', 'detective'].includes(s.roles[Number(seat)]);
  if (s.skipped.some((seat) => !eligible(seat))) return false;
  if (
    typeof s.announcement !== 'string' ||
    !s.announcement.trim() ||
    s.announcement.length > 500
  )
    return false;
  if (![null, 'town', 'mafia'].includes(s.winner)) return false;
  const mafia = s.roles.filter(
    (role, i) => role === 'mafia' && s.alive[i],
  ).length;
  const town = s.alive.filter(Boolean).length - mafia;
  const expectedWinner = !mafia ? 'town' : mafia >= town ? 'mafia' : null;
  if (
    s.winner !== expectedWinner ||
    (s.phase === 'over') !== (s.winner !== null)
  )
    return false;
  return true;
}

export function validMafiaView(
  value: unknown,
  count: number,
  seat: number,
): value is MafiaView {
  const v = value as MafiaView;
  const index = (n: unknown): n is number =>
    Number.isInteger(n) && (n as number) >= 0 && (n as number) < count;
  const unique = (v: unknown): v is number[] =>
    Array.isArray(v) && new Set(v).size === v.length && v.every(index);
  if (
    !v ||
    typeof v !== 'object' ||
    !Object.keys(v).every((k) =>
      [
        'phase',
        'day',
        'revision',
        'alive',
        'pending',
        'skipped',
        'submitted',
        'announcement',
        'winner',
        'role',
        'allies',
        'clues',
        'ownTarget',
        'roles',
      ].includes(k),
    ) ||
    !['night', 'discussion', 'vote', 'over'].includes(v.phase) ||
    !Number.isSafeInteger(v.day) ||
    v.day < 1 ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    !Array.isArray(v.alive) ||
    v.alive.length !== count ||
    !v.alive.every((n) => typeof n === 'boolean') ||
    !unique(v.pending) ||
    !unique(v.skipped) ||
    !unique(v.submitted) ||
    !unique(v.allies) ||
    !index(seat) ||
    !['mafia', 'doctor', 'detective', 'town'].includes(v.role) ||
    typeof v.announcement !== 'string' ||
    !v.announcement.trim() ||
    v.announcement.length > 500 ||
    ![null, 'town', 'mafia'].includes(v.winner) ||
    (v.phase === 'over') !== (v.winner !== null) ||
    !Array.isArray(v.clues)
  )
    return false;
  if (
    (v.role !== 'mafia' && v.allies.length) ||
    v.allies.includes(seat) ||
    (v.role !== 'detective' && v.clues.length) ||
    v.clues.some(
      (c) =>
        !c ||
        Object.keys(c).sort().join() !== 'day,mafia,target' ||
        !Number.isSafeInteger(c.day) ||
        c.day < 1 ||
        c.day > v.day ||
        !index(c.target) ||
        typeof c.mafia !== 'boolean',
    )
  )
    return false;
  if (
    v.ownTarget !== undefined &&
    ((v.ownTarget !== null && !index(v.ownTarget)) ||
      !v.submitted.includes(seat))
  )
    return false;
  if (
    v.roles !== undefined &&
    (v.phase !== 'over' ||
      !Array.isArray(v.roles) ||
      v.roles.length !== count ||
      !v.roles.every((r) =>
        ['mafia', 'doctor', 'detective', 'town'].includes(r),
      ) ||
      v.roles[seat] !== v.role)
  )
    return false;
  if (v.phase === 'over' && !Array.isArray(v.roles)) return false;
  return (
    v.pending.every(
      (i) => v.alive[i] && !v.skipped.includes(i) && !v.submitted.includes(i),
    ) && v.skipped.every((i) => v.alive[i] && !v.submitted.includes(i))
  );
}
