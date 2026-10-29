export const ROOM_GAMES = [
  'tictactoe',
  'connect-four',
  'crazy-eights',
  'uno',
  'snakes-ladders',
  'ludo',
  'chess',
  'rps',
  'mafia',
  'business',
  'catan',
] as const;
export type RoomGame = (typeof ROOM_GAMES)[number];
export interface ResultCount {
  wins: number;
  losses: number;
  draws: number;
}
export interface PlayerStanding extends ResultCount {
  id: string;
  games: Partial<Record<RoomGame, ResultCount>>;
}
export interface Standings {
  players: PlayerStanding[];
  recorded: number[];
}
const counts = (): ResultCount => ({ wins: 0, losses: 0, draws: 0 });
const validCounts = (v: ResultCount) =>
  !!v &&
  Object.keys(v).sort().join() === 'draws,losses,wins' &&
  Object.values(v).every((n) => Number.isSafeInteger(n) && n >= 0);
export function validStandings(
  value: unknown,
  ids: string[],
): value is Standings {
  const s = value as Standings;
  return (
    !!s &&
    Object.keys(s).sort().join() === 'players,recorded' &&
    Array.isArray(s.recorded) &&
    s.recorded.length <= 1 &&
    s.recorded.every((n) => Number.isSafeInteger(n) && n >= 0) &&
    Array.isArray(s.players) &&
    s.players.length <= ids.length &&
    new Set(s.players.map((p) => p?.id)).size === s.players.length &&
    s.players.every((p) => {
      if (
        !p ||
        Object.keys(p).sort().join() !== 'draws,games,id,losses,wins' ||
        !ids.includes(p.id) ||
        !p.games ||
        typeof p.games !== 'object' ||
        Array.isArray(p.games) ||
        !validCounts({ wins: p.wins, losses: p.losses, draws: p.draws })
      )
        return false;
      const totals = counts();
      for (const [id, result] of Object.entries(p.games)) {
        if (!ROOM_GAMES.includes(id as RoomGame) || !validCounts(result!))
          return false;
        for (const field of ['wins', 'losses', 'draws'] as const)
          totals[field] += result![field];
      }
      return ['wins', 'losses', 'draws'].every(
        (field) =>
          totals[field as keyof ResultCount] === p[field as keyof ResultCount],
      );
    })
  );
}
export function recordStanding(
  source: Standings,
  ids: string[],
  game: RoomGame,
  round: number,
  winners: number[] | null,
): Standings {
  if (source.recorded.includes(round)) return source;
  const next = structuredClone(source);
  for (const [index, id] of ids.entries()) {
    let player = next.players.find((p) => p.id === id);
    if (!player) {
      player = { id, ...counts(), games: {} };
      next.players.push(player);
    }
    const result = (player.games[game] ??= counts());
    const field =
      winners === null ? 'draws' : winners.includes(index) ? 'wins' : 'losses';
    if (
      player[field] >= Number.MAX_SAFE_INTEGER ||
      result[field] >= Number.MAX_SAFE_INTEGER
    )
      throw Error('Room standings have reached the safe integer limit.');
    player[field]++;
    result[field]++;
  }
  next.recorded = [round];
  return next;
}
export function leaderboard(
  standings: Standings,
  members: { id: string; name: string }[],
  game?: RoomGame,
) {
  return standings.players
    .flatMap((p) => {
      const result = game ? p.games[game] : p;
      return result
        ? [
            {
              id: p.id,
              name: members.find((m) => m.id === p.id)?.name ?? 'Former player',
              wins: result.wins,
              losses: result.losses,
              draws: result.draws,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        a.losses - b.losses ||
        b.draws - a.draws ||
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
        a.id.localeCompare(b.id),
    );
}
