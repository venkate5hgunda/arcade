import { RaceTable } from '../components/RaceTable.tsx';
import { CardTable } from '../components/CardTable.tsx';
import { GAMES } from '../lib/games.ts';
import type { RoomGameId } from '../lib/room/protocol.ts';
import { ConnectBoard } from '../components/ConnectBoard.tsx';
import { c4Win } from '../lib/puzzles.ts';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Room } from '../lib/room/protocol.ts';
import { Board } from '../components/Board.tsx';
import { findWin } from '../lib/tictactoe.ts';
import { names } from '../lib/profile.ts';

export function RoomPage({ room }: { room: Room }) {
  const location = useLocation();
  const [, refresh] = useState(0);
  const [gameId, setGameId] = useState<RoomGameId>('tictactoe');
  const [name, setName] = useState(() => names()[0] || '');
  const [input, setInput] = useState(() =>
    location.search ? window.location.href : '',
  );
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [raceMoving, setRaceMoving] = useState<number | null>(null);
  useEffect(() => room.on(() => refresh((v) => v + 1)), [room]);
  useEffect(() => {
    room.restore();
  }, [room]);
  useEffect(() => {
    if (location.search && window.location.href !== input) {
      setInput(window.location.href);
      if (location.search.includes('invite=') && room.role === 'guest') {
        room.leave();
        setOutput('');
      }
    }
  }, [location.search]);
  const s = room.snapshot;
  const match = s?.match;
  const cards = s?.cardMatch;
  const race = s?.raceMatch;
  const selectedGame =
    s &&
    ((s.members.length > 4 && gameId !== 'uno') ||
      (s.members.length > 2 &&
        !['uno', 'snakes-ladders', 'ludo'].includes(gameId)))
      ? 'uno'
      : gameId;
  const gameName = (id: string) => GAMES.find((g) => g.id === id)!.name;
  const connected =
    !!s && s.members.length >= 2 && s.members.every((m) => m.connected);
  const seat = s?.members.findIndex((m) => m.id === room.peerId) ?? -1;
  const win =
    match &&
    (match.gameId === 'connect-four'
      ? c4Win(match.board)
      : findWin(match.board));
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Connection failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setMessage('Link copied. Send it to the other player.');
    } catch {
      setMessage('Select and copy the full link below.');
    }
  }
  return (
    <section className="play-page room-page">
      <Link className="back" to="/">
        ← Back to the shelf
      </Link>
      <p className="eyebrow">Different screens. Same game night.</p>
      <h1>Your private table</h1>
      <p className="lede">
        Your own table for Tic-Tac-Toe, Connect Four, Crazy Eights or
        UNO-inspired. UNO tables welcome 2–20 players.
      </p>
      {!room.role ? (
        <div className="room-columns">
          <section className="setup-card">
            <h2>Make yourself at home</h2>
            <label>
              Your room name
              <input
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                placeholder="What should we call you?"
              />
            </label>
            <button
              disabled={busy || !name.trim()}
              className="primary"
              onClick={() =>
                run(async () => {
                  room.createHost(name.trim());
                  setOutput(await room.createInvite());
                })
              }
            >
              Create a room
            </button>
          </section>
          <section className="setup-card">
            <h2>Got an invitation?</h2>
            <p>Enter your name, then paste the host’s invitation.</p>
            <label>
              Invitation link
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the complete invitation link"
              />
            </label>
            <button
              className="quiet"
              disabled={busy || !name.trim() || !input.trim()}
              onClick={() =>
                run(async () =>
                  setOutput(await room.joinInvite(input, name.trim())),
                )
              }
            >
              Join room
            </button>
          </section>
        </div>
      ) : (
        <>
          <div className="room-roster" aria-label="Room players">
            {s?.members.map((m, index) => (
              <div key={m.id}>
                <b
                  className={
                    index === 0
                      ? 'x-text'
                      : s.match?.gameId === 'connect-four'
                        ? 'gold-text'
                        : 'o-text'
                  }
                >
                  {s.match?.gameId === 'connect-four'
                    ? index === 0
                      ? 'R'
                      : 'G'
                    : cards || race
                      ? String(index + 1)
                      : index === 0
                        ? 'X'
                        : 'O'}
                </b>
                <strong>
                  {m.name}
                  {m.id === room.peerId ? ' (you)' : ''}
                </strong>
                <span>
                  {m.connected ? 'Connected' : 'Waiting to reconnect'}
                </span>
              </div>
            ))}
            {s?.members.length === 1 && <p>Your guest’s seat is waiting.</p>}
          </div>
          {(!connected || (room.role === 'host' && output)) && (
            <div className="room-columns">
              <section className="setup-card">
                <h2>
                  {room.role === 'host'
                    ? '1. Invite your friend'
                    : '2. Return your answer'}
                </h2>
                <p>
                  {room.role === 'host'
                    ? 'Send this invitation to one guest. Each player needs their own invitation. Keep this tab open while they join.'
                    : 'Send this answer to the host. They must accept it in the tab that created your invitation.'}
                </p>
                {output && (
                  <>
                    <label>
                      {room.role === 'host'
                        ? 'Invitation to share'
                        : 'Answer to share'}
                      <textarea
                        readOnly
                        value={output}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <div className="actions">
                      <button className="quiet" onClick={copy}>
                        Copy link
                      </button>
                      {typeof navigator.share === 'function' && (
                        <button
                          className="quiet"
                          onClick={() =>
                            run(async () => {
                              await navigator.share({
                                title: 'Arcade game night',
                                url: output,
                              });
                            })
                          }
                        >
                          Share link
                        </button>
                      )}
                    </div>
                  </>
                )}
                {room.role === 'host' && connected && output && (
                  <button
                    className="quiet"
                    onClick={() => {
                      room.cancelInvite();
                      setOutput('');
                      setInput('');
                    }}
                  >
                    Cancel invitation
                  </button>
                )}
                {room.role === 'host' && (
                  <button
                    className="quiet"
                    disabled={busy}
                    onClick={() =>
                      run(async () => setOutput(await room.createInvite()))
                    }
                  >
                    {(s?.members.length ?? 0) >= 2
                      ? 'Create reconnect invitation'
                      : 'Create fresh invitation'}
                  </button>
                )}
              </section>
              {room.role === 'host' && (
                <section className="setup-card">
                  <h2>3. Welcome them in</h2>
                  <label>
                    Guest’s answer link
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Paste the answer your guest sends back"
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy || !input.trim()}
                    onClick={() =>
                      run(async () => {
                        await room.acceptAnswer(input);
                        setInput('');
                        setOutput('');
                      })
                    }
                  >
                    Accept answer
                  </button>
                </section>
              )}
            </div>
          )}
          {connected &&
            !match &&
            !cards &&
            !race &&
            room.role === 'host' &&
            s &&
            s.members.length < 20 &&
            !output && (
              <button
                className="quiet invite-another"
                onClick={() =>
                  run(async () => setOutput(await room.createInvite()))
                }
              >
                Invite another player
              </button>
            )}
          {connected &&
            !match &&
            !cards &&
            !race &&
            (!output || room.role === 'guest') && (
              <div className="setup-card">
                <h2>Everyone’s here.</h2>
                {room.role === 'host' && (
                  <label>
                    Room game
                    <select
                      value={selectedGame}
                      onChange={(e) =>
                        setGameId(e.target.value as typeof gameId)
                      }
                    >
                      <option
                        disabled={(s?.members.length ?? 0) > 2}
                        value="tictactoe"
                      >
                        Tic-Tac-Toe
                      </option>
                      <option
                        disabled={(s?.members.length ?? 0) > 2}
                        value="connect-four"
                      >
                        Connect Four
                      </option>
                      <option
                        disabled={(s?.members.length ?? 0) > 2}
                        value="crazy-eights"
                      >
                        Crazy Eights
                      </option>
                      <option
                        disabled={(s?.members.length ?? 0) > 4}
                        value="snakes-ladders"
                      >
                        Snakes &amp; Ladders
                      </option>
                      <option
                        disabled={(s?.members.length ?? 0) > 4}
                        value="ludo"
                      >
                        Ludo
                      </option>
                      <option value="uno">UNO-inspired</option>
                    </select>
                  </label>
                )}
                <p>
                  {room.role === 'host'
                    ? 'Your table is ready for a little friendly competition.'
                    : 'Waiting for the host to choose and start a game.'}
                </p>
                {room.role === 'host' && (
                  <button
                    className="primary"
                    onClick={() => room.start(selectedGame)}
                  >
                    Start {gameName(selectedGame)}
                  </button>
                )}
              </div>
            )}
          {match && (
            <div className="room-match board-panel">
              <p className="room-game-name">
                {match.gameId === 'connect-four'
                  ? 'Connect Four'
                  : 'Tic-Tac-Toe'}
              </p>
              <div
                className={`turn-banner ${match.over ? 'finished' : ''}`}
                role="status"
              >
                <span
                  className={`turn-token ${match.current === 1 ? 'x-text' : match.gameId === 'connect-four' ? 'gold-text' : 'o-text'}`}
                >
                  {match.gameId === 'connect-four'
                    ? match.current === 1
                      ? 'R'
                      : 'G'
                    : match.current === 1
                      ? 'X'
                      : 'O'}
                </span>
                <div>
                  <h2>
                    {match.over
                      ? win
                        ? `${s?.members[match.current - 1].name} wins!`
                        : 'A beautifully played draw.'
                      : !connected
                        ? 'Match paused'
                        : match.current - 1 === seat
                          ? 'Your turn'
                          : `${s?.members[match.current - 1].name}’s turn`}
                  </h2>
                  <p>
                    {match.over
                      ? `Round ${match.round + 1} complete`
                      : !connected
                        ? 'Reconnect both players to continue this board.'
                        : match.current - 1 === seat
                          ? match.gameId === 'connect-four'
                            ? 'Choose an open column.'
                            : 'Choose an empty square.'
                          : 'Waiting for your opponent’s move.'}
                  </p>
                </div>
              </div>
              {match.gameId === 'connect-four' ? (
                <ConnectBoard
                  state={match}
                  blocked={
                    !connected || !!match.over || match.current - 1 !== seat
                  }
                  drop={(column) => room.move(column)}
                />
              ) : (
                <Board
                  board={match.board}
                  blocked={
                    !connected || !!match.over || match.current - 1 !== seat
                  }
                  move={(cell) => room.move(cell)}
                />
              )}
              <div className="score-line">
                {s?.members.map((m, index) => (
                  <span key={m.id}>
                    {m.name} <strong>{s.wins[index]} wins</strong>
                  </span>
                ))}
              </div>
              <p className="count">
                {s?.draws} draws · Round {match.round + 1}
              </p>
              {match.over && room.role === 'host' && (
                <button
                  className="primary rematch"
                  disabled={!connected}
                  onClick={() => room.start()}
                >
                  Play again
                </button>
              )}
              {match.over && room.role === 'guest' && (
                <p>Waiting for the host to start the next round.</p>
              )}
            </div>
          )}
          {cards && s && (
            <div className="board-panel room-card-match">
              <p className="room-game-name">{gameName(cards.gameId)}</p>
              <div className="turn-banner" role="status">
                <div>
                  <h2>
                    {cards.view.phase === 'over'
                      ? 'Round complete'
                      : !connected
                        ? 'Match paused'
                        : cards.view.current === seat
                          ? 'Your turn'
                          : `${s.members[cards.view.current].name}’s turn`}
                  </h2>
                  <p>
                    {!connected
                      ? 'Reconnect every seat to continue.'
                      : cards.view.phase === 'over'
                        ? `Round ${cards.round + 1} complete`
                        : 'Your cards are private. Play from your own screen.'}
                  </p>
                </div>
              </div>
              <CardTable
                view={cards.view}
                names={s.members.map((m) => m.name)}
                blocked={!connected}
                onAction={(action) => {
                  try {
                    room.cardAction(action);
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Reconnect to continue.',
                    );
                  }
                }}
              />
              <div className="score-line">
                {s.members.map((member, index) => (
                  <span key={member.id}>
                    {member.name} <strong>{s.wins[index]} wins</strong>
                  </span>
                ))}
              </div>
              <p className="count">
                {s.draws} draws · Round {cards.round + 1}
              </p>
              {cards.view.phase === 'over' &&
                (room.role === 'host' ? (
                  <button
                    className="primary"
                    disabled={!connected}
                    onClick={() => room.start()}
                  >
                    Play again
                  </button>
                ) : (
                  <p>Waiting for the host to start the next round.</p>
                ))}
            </div>
          )}
          {race && s && (
            <div className="board-panel room-race-match">
              <p className="room-game-name">{gameName(race.gameId)}</p>
              <div className="turn-banner" role="status">
                <div>
                  <h2>
                    {raceMoving !== null
                      ? `${s.members[raceMoving].name} is moving…`
                      : race.race.state.winner != null
                        ? `${s.members[race.race.state.winner].name} wins!`
                        : !connected
                          ? 'Match paused'
                          : race.race.state.current === seat
                            ? 'Your turn'
                            : `${s.members[race.race.state.current].name}’s turn`}
                  </h2>
                  <p>
                    {!connected
                      ? 'Reconnect every seat to continue.'
                      : raceMoving !== null
                        ? 'Watch the piece travel.'
                        : race.race.state.winner != null
                          ? `Round ${race.round + 1} complete`
                          : 'Roll and race together.'}
                  </p>
                </div>
              </div>
              <RaceTable
                game={race.race}
                names={s.members.map((m) => m.name)}
                blocked={!connected || race.race.state.current !== seat}
                onMotion={setRaceMoving}
                onAction={(action) => {
                  try {
                    room.raceAction(action);
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Reconnect to continue.',
                    );
                  }
                }}
              />
              <div className="score-line">
                {s.members.map((member, index) => (
                  <span key={member.id}>
                    {member.name} <strong>{s.wins[index]} wins</strong>
                  </span>
                ))}
              </div>
              <p className="count">
                {s.draws} draws · Round {race.round + 1}
              </p>
              {race.race.state.winner != null &&
                raceMoving === null &&
                (room.role === 'host' ? (
                  <button
                    className="primary"
                    disabled={!connected}
                    onClick={() => room.start()}
                  >
                    Play again
                  </button>
                ) : (
                  <p>Waiting for the host to start the next round.</p>
                ))}
            </div>
          )}
          <details className="help-card">
            <summary>Room options</summary>
            <p>
              Connections pause if either tab closes. The host’s board is backed
              up in this tab; use a fresh invitation to reconnect the same
              guest.
            </p>
            <p>
              Direct connections may be blocked on restrictive networks. Try
              another network if the links are accepted but the room cannot
              connect.
            </p>
            {room.role === 'host' &&
              s?.members
                .slice(1)
                .filter((m) => !m.connected)
                .map((member) => (
                  <button
                    key={member.id}
                    className="quiet"
                    onClick={() =>
                      run(async () =>
                        setOutput(await room.createInvite(member.id)),
                      )
                    }
                  >
                    Reconnect {member.name}
                  </button>
                ))}
            <button
              className="quiet"
              onClick={() => {
                if (
                  window.confirm(
                    'Leave this room? The direct connection will close.',
                  )
                ) {
                  room.leave();
                  setOutput('');
                  setInput('');
                }
              }}
            >
              Leave room
            </button>
          </details>
        </>
      )}
      {busy && (
        <p role="status">Preparing your connection link… Keep this tab open.</p>
      )}
      <p className="room-status" role="status">
        {message || room.issue}
      </p>
    </section>
  );
}
