export function remoteMatch(room, gameId) {
  const game = room?.activeGame;
  if (game?.id !== gameId || game.playerIds?.length < 2 || game.playerIds.length > 4 ||
      !game.playerIds.includes(room.peerId)) return null;
  return room;
}

export function seat(room) {
  return room.activeGame.playerIds.indexOf(room.peerId) + 1;
}

export function validTurn(room, current, from) {
  return room.activeGame?.playerIds[current - 1] === from;
}
