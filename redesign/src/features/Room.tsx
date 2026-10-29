import { RoomStandings } from '../components/RoomStandings.tsx';
import { IslandTable } from '../components/IslandTable.tsx';
import { RoomQr, RoomScanner } from '../components/RoomQr.tsx';
import { IslandOptions } from '../components/IslandOptions.tsx';
import { DEFAULT_BOARD_OPTIONS } from '../lib/catan-core.js';
import type { BoardOptions } from '../lib/catan-core.js';
import { BusinessTable } from '../components/BusinessTable.tsx';
import { BusinessOptionsForm } from '../components/BusinessOptions.tsx';
import { DEFAULT_OPTIONS } from '../lib/business-core.js';
import type { BusinessOptions } from '../lib/business-core.js';
import { MafiaTable } from '../components/MafiaTable.tsx';
import { ChessBoard } from '../components/ChessBoard.tsx';
import { chessResult } from '../lib/chess.ts';
import { RpsRoomTable } from '../components/RpsRoomTable.tsx';
import { RaceTable } from '../components/RaceTable.tsx';
import { CardTable } from '../components/CardTable.tsx';
import { GAMES } from '../lib/games.ts';
import type { RoomGameId } from '../lib/room/protocol.ts';
import { ConnectBoard } from '../components/ConnectBoard.tsx';
import { c4Win } from '../lib/puzzles.ts';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Room } from '../lib/room/protocol.ts';
import { Board } from '../components/Board.tsx';
import { findWin } from '../lib/tictactoe.ts';
import { names } from '../lib/profile.ts';

export function RoomPage({ room }: { room: Room }) {
  const location = useLocation();
  const [, refresh] = useState(0);
  const [gameId, setGameId] = useState<RoomGameId>(() =>
    ['mafia', 'business', 'catan'].includes(
      new URLSearchParams(location.search).get('game') ?? '',
    )
      ? (new URLSearchParams(location.search).get('game') as
          | 'mafia'
          | 'business'
          | 'catan')
      : 'tictactoe',
  );
  const [businessOptions, setBusinessOptions] = useState<BusinessOptions>({
    ...DEFAULT_OPTIONS,
  });
  const [islandOptions, setIslandOptions] = useState<BoardOptions>({
    ...DEFAULT_BOARD_OPTIONS,
  });
  const [islandPorts, setIslandPorts] = useState<'fixed' | 'shuffled'>('fixed');
  const [name, setName] = useState(() => names()[0] || '');
  const [input, setInput] = useState(() =>
    location.search.includes('invite=') ? window.location.href : '',
  );
  const [output, setOutput] = useState('');
  const outputField = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [raceMoving, setRaceMoving] = useState<number | null>(null);
  useEffect(() => room.on(() => refresh((v) => v + 1)), [room]);
  useEffect(() => {
    room.restore();
  }, [room]);
  useEffect(() => {
    if (location.search.includes('invite=') && window.location.href !== input) {
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
  const rps = s?.rpsMatch;
  const chess = s?.chessMatch;
  const mafia = s?.mafiaMatch;
  const business = s?.businessMatch;
  const island = s?.islandMatch;
  const chessEnd = chess ? chessResult(chess.game) : null;
  const selectedGame =
    s &&
    ((s.members.length > 4 && !['uno', 'mafia', 'business'].includes(gameId)) ||
      (s.members.length > 6 && gameId === 'business') ||
      (s.members.length > 2 &&
        ![
          'uno',
          'mafia',
          'business',
          'catan',
          'snakes-ladders',
          'ludo',
        ].includes(gameId)))
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
      outputField.current?.focus();
      outputField.current?.select();
      setMessage('Clipboard unavailable. Copy the selected link manually.');
    }
  }
  async function share() {
    try {
      await navigator.share({
        title: 'Arcade game night',
        text:
          room.role === 'host'
            ? 'Open this invitation, join the room, then send your answer link back to me.'
            : 'Open this answer in the host tab that created the invitation.',
        url: output,
      });
      setMessage(
        'Link shared. Keep this tab open while the other player connects.',
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError')
        setMessage('Sharing cancelled; your link is still available.');
      else await copy();
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
        Your own table for Tic-Tac-Toe, Connect Four, Crazy Eights,
        UNO-inspired, Snakes & Ladders, Ludo, Chess, Business, Island Charter,
        Mafia or Rock Paper Scissors. UNO welcomes 2–20 players, Mafia 5–10,
        Business 2–6, and race games 2–4, and Island Charter 3–4.
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
            <RoomScanner
              kind="offer"
              onResult={(url) => {
                setInput(url);
                setMessage(
                  'Invitation scanned. Join the room to create your answer.',
                );
              }}
            />
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
          <details
            className="room-roster-details"
            open={
              !match &&
              !cards &&
              !race &&
              !rps &&
              !chess &&
              !mafia &&
              !business &&
              !island
            }
          >
            <summary>Room players ({s?.members.length ?? 0})</summary>
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
                      : cards ||
                          race ||
                          rps ||
                          chess ||
                          mafia ||
                          business ||
                          island
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
          </details>
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
                        ref={outputField}
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
                        <button className="quiet" onClick={() => void share()}>
                          Share link
                        </button>
                      )}
                    </div>
                    <RoomQr
                      url={output}
                      kind={room.role === 'host' ? 'invite' : 'answer'}
                    />
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
                  <RoomScanner
                    kind="answer"
                    onResult={(url) => {
                      setInput(url);
                      setMessage('Answer scanned. Accept it in this host tab.');
                    }}
                  />
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
            !rps &&
            !chess &&
            !mafia &&
            !business &&
            !island &&
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
            !rps &&
            !chess &&
            !mafia &&
            !business &&
            !island &&
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
                      <option
                        disabled={(s?.members.length ?? 0) > 2}
                        value="rps"
                      >
                        Rock Paper Scissors
                      </option>
                      <option
                        disabled={(s?.members.length ?? 0) > 2}
                        value="chess"
                      >
                        Chess
                      </option>
                      <option
                        disabled={
                          (s?.members.length ?? 0) < 5 ||
                          (s?.members.length ?? 0) > 10
                        }
                        value="mafia"
                      >
                        Mafia
                      </option>
                      <option
                        disabled={(s?.members.length ?? 0) > 6}
                        value="business"
                      >
                        Business
                      </option>
                      <option
                        disabled={(s?.members.length ?? 0) > 4}
                        value="catan"
                      >
                        Island Charter
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
                {room.role === 'host' && selectedGame === 'catan' && (
                  <details>
                    <summary>Island options</summary>
                    <IslandOptions
                      options={islandOptions}
                      setOptions={setIslandOptions}
                      ports={islandPorts}
                      setPorts={setIslandPorts}
                    />
                  </details>
                )}
                {room.role === 'host' &&
                  selectedGame === 'catan' &&
                  (s?.members.length ?? 0) < 3 && (
                    <p>
                      Invite at least three players to start Island Charter.
                    </p>
                  )}
                {room.role === 'host' && selectedGame === 'business' && (
                  <details>
                    <summary>Business house rules</summary>
                    <BusinessOptionsForm
                      options={businessOptions}
                      onChange={setBusinessOptions}
                    />
                  </details>
                )}
                {room.role === 'host' &&
                  selectedGame === 'mafia' &&
                  (s?.members.length ?? 0) < 5 && (
                    <p>Invite at least five players to start Mafia.</p>
                  )}
                {room.role === 'host' && (
                  <button
                    className="primary"
                    disabled={
                      (selectedGame === 'mafia' &&
                        ((s?.members.length ?? 0) < 5 ||
                          (s?.members.length ?? 0) > 10)) ||
                      (selectedGame === 'catan' &&
                        ((s?.members.length ?? 0) < 3 ||
                          (s?.members.length ?? 0) > 4))
                    }
                    onClick={() =>
                      room.start(
                        selectedGame,
                        selectedGame === 'business'
                          ? businessOptions
                          : selectedGame === 'catan'
                            ? {
                                portMode: islandPorts,
                                boardOptions: islandOptions,
                              }
                            : undefined,
                      )
                    }
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
          {rps && s && (
            <>
              <RpsRoomTable
                view={rps.view}
                names={s.members.map((m) => m.name)}
                connected={connected}
                host={room.role === 'host'}
                action={(action) => room.rpsAction(action)}
                replay={() => room.start()}
              />
              <div className="score-line">
                {s.members.map((m, i) => (
                  <span key={m.id}>
                    {m.name} <strong>{s.wins[i]} wins</strong>
                  </span>
                ))}
              </div>
            </>
          )}
          {chess && s && (
            <div className="board-panel room-chess-match">
              <p className="room-game-name">Chess</p>
              <div className="turn-banner" role="status">
                <div>
                  <h2>
                    {chess.game.over
                      ? chessEnd?.winner
                        ? `Checkmate! ${s.members[chessEnd.winner === 'w' ? 0 : 1].name} wins!`
                        : 'Draw!'
                      : !connected
                        ? 'Match paused'
                        : `${s.members[chess.game.state.turn === 'w' ? 0 : 1].name} to move${chessEnd?.check ? ' — Check!' : ''}`}
                  </h2>
                  <p>
                    {!connected
                      ? 'Reconnect both players to continue.'
                      : chess.game.pendingPromotion
                        ? 'The moving player must choose a promotion.'
                        : chess.game.over
                          ? 'Ready for another game?'
                          : seat === (chess.game.state.turn === 'w' ? 0 : 1)
                            ? 'Your turn. Select a piece, then a highlighted square.'
                            : 'Waiting for your opponent’s move.'}
                  </p>
                </div>
              </div>
              <ChessBoard
                game={chess.game}
                blocked={
                  !connected || seat !== (chess.game.state.turn === 'w' ? 0 : 1)
                }
                flip={seat === 1}
                onMove={(from, to, promotion) =>
                  room.chessAction({
                    type: 'move',
                    from,
                    to,
                    ...(promotion ? { promotion } : {}),
                  })
                }
              />
              <div className="score-line">
                {s.members.map((m, i) => (
                  <span key={m.id}>
                    {m.name} <strong>{s.wins[i]} wins</strong>
                  </span>
                ))}
              </div>
              <p>{s.draws} draws</p>
              {chess.game.over &&
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
          {island && s && (
            <>
              <IslandTable
                view={island.view}
                seat={island.seat}
                names={s.members.map((m) => m.name)}
                blocked={!connected}
                action={(move) => room.islandAction(move)}
                error={message || room.issue}
                viewKey={s.roomId}
              />
              {island.view.winner !== null && (
                <div className="board-panel">
                  <div className="score-line">
                    {s.members.map((member, i) => (
                      <span key={member.id}>
                        {member.name} <strong>{s.wins[i]} wins</strong>
                      </span>
                    ))}
                  </div>
                  {room.role === 'host' ? (
                    <button
                      className="primary"
                      disabled={!connected}
                      onClick={() => room.start()}
                    >
                      Play again
                    </button>
                  ) : (
                    <p>Waiting for the host to start the next island.</p>
                  )}
                </div>
              )}
            </>
          )}
          {business && s && (
            <>
              <BusinessTable
                view={business.view}
                seat={seat}
                names={s.members.map((m) => m.name)}
                blocked={
                  !s.members.every(
                    (m, i) => m.connected || business.view.players[i].out,
                  )
                }
                onAction={(action) => room.businessAction(action)}
                error={message || room.issue}
              />
              {business.view.phase === 'win' && (
                <div className="board-panel">
                  <div className="score-line">
                    {s.members.map((member, i) => (
                      <span key={member.id}>
                        {member.name} <strong>{s.wins[i]} wins</strong>
                      </span>
                    ))}
                  </div>
                  {room.role === 'host' ? (
                    <button
                      className="primary"
                      disabled={!connected}
                      onClick={() => room.start()}
                    >
                      Play again
                    </button>
                  ) : (
                    <p>Waiting for the host to start the next round.</p>
                  )}
                </div>
              )}
            </>
          )}
          {mafia && s && (
            <MafiaTable
              view={mafia.view}
              seat={mafia.seat}
              names={s.members.map((m) => m.name)}
              online={s.members.map((m) => m.connected)}
              host={room.role === 'host'}
              error={message || room.issue}
              action={(action) => room.mafiaAction(action)}
              replay={() => room.start()}
            />
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
          {s && (
            <RoomStandings
              standings={s.standings ?? { players: [], recorded: [] }}
              members={s.members}
            />
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
        {!mafia && !business && !island && (message || room.issue)}
      </p>
    </section>
  );
}
