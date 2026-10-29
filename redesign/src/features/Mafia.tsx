import { Link } from 'react-router-dom';
import { GameArt } from '../components/GameArt.tsx';
export function MafiaGame() {
  return (
    <section className="play-page">
      <Link className="back" to="/">
        ← Back to the shelf
      </Link>
      <div className="game-heading">
        <div>
          <p className="eyebrow">Party · A moonlit mystery</p>
          <h1>Mafia</h1>
        </div>
      </div>
      <div className="puzzle-setup">
        <p className="lede">
          Gather your town. Someone is hiding in the shadows.
        </p>
        <div className="setup-card">
          <h2>Gather 5–10 players</h2>
          <p>
            Mafia is played in a private room. Each player needs their own
            device; the host holds the secret roles.
          </p>
          <Link className="primary" to="/room?game=mafia">
            Open private room →
          </Link>
        </div>
        <GameArt id="mafia" className="puzzle-setup-art" />
        <details className="help-card">
          <summary>How to play</summary>
          <p>
            Each night, Mafia chooses a target, the Doctor protects, and the
            Detective investigates. Discuss and vote by day. The host can mark
            disconnected players absent for the phase.
          </p>
        </details>
      </div>
    </section>
  );
}
