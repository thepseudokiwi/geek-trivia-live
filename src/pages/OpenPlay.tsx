import { playerAuthClient, playerAuthConfigured } from '../lib/playerAuth';
import { PlayerHeader } from './PlayerAuth';

export function OpenPlay() {
  if (playerAuthConfigured && playerAuthClient) return <ConnectedOpenPlay />;
  return <OpenPlayContent signedIn={false} />;
}

function ConnectedOpenPlay() {
  const session = playerAuthClient!.useSession();
  return <OpenPlayContent signedIn={Boolean(session.data?.user)} />;
}

function OpenPlayContent({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="player-shell open-play-page">
      <PlayerHeader />
      <section className="player-hero">
        <p className="eyebrow">Open play</p>
        <h1>Your next trivia party starts here.</h1>
        <p>Make a player account, claim a seat when registration opens, and show up ready to battle.</p>
        {!signedIn && (
          <div className="player-actions">
            <a className="player-button" href="#auth/sign-up">Create player account</a>
            <a className="player-button secondary" href="#auth/sign-in">Sign in</a>
          </div>
        )}
      </section>
      <section className="player-card open-play-empty" aria-live="polite">
        <span className="open-play-icon" aria-hidden="true">20</span>
        <div>
          <p className="eyebrow">Registration board</p>
          <h2>No sessions are open right now.</h2>
          <p>Check back soon. New open-play events will appear here as soon as the host publishes them.</p>
        </div>
      </section>
      {signedIn && <a className="player-button secondary" href="#account">View my account</a>}
    </main>
  );
}
