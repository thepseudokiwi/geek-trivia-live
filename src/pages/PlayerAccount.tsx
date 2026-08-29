import { playerAuthClient, playerAuthConfigured } from '../lib/playerAuth';
import { PlayerHeader } from './PlayerAuth';

export function PlayerAccount() {
  if (!playerAuthConfigured || !playerAuthClient) return <UnavailableAccount />;
  return <ConnectedAccount />;
}

function ConnectedAccount() {
  const session = playerAuthClient!.useSession();
  if (session.isPending) {
    return <PlayerPageStatus message="Loading your player account…" />;
  }
  if (!session.data?.user) {
    return (
      <main className="player-shell">
        <PlayerHeader />
        <section className="player-card player-account-callout">
          <p className="eyebrow">Your player profile</p>
          <h1>Ready to enter the arena?</h1>
          <p>Create an account to register for open play, or sign in to see your upcoming games.</p>
          <div className="player-actions">
            <a className="player-button" href="#auth/sign-up">Create account</a>
            <a className="player-button secondary" href="#auth/sign-in">Sign in</a>
          </div>
        </section>
      </main>
    );
  }

  const { user } = session.data;
  return (
    <main className="player-shell">
      <PlayerHeader />
      <section className="player-card player-profile">
        <div className="player-avatar" aria-hidden={!user.image}>
          {user.image ? <img src={user.image} alt="" referrerPolicy="no-referrer" /> : user.name?.slice(0, 1).toUpperCase() || '?'}
        </div>
        <div>
          <p className="eyebrow">Signed in</p>
          <h1>{user.name || 'Nerd Wars player'}</h1>
          <p>{user.email}</p>
        </div>
      </section>
      <section className="player-card">
        <p className="eyebrow">Next battle</p>
        <h2>No open-play registration yet</h2>
        <p>When the host opens a session, it will appear here.</p>
        <a className="player-button" href="#open-play">Browse open play</a>
      </section>
      <button className="player-text-button" onClick={() => void playerAuthClient!.signOut()}>Sign out</button>
    </main>
  );
}

function UnavailableAccount() {
  return (
    <main className="player-shell">
      <PlayerHeader />
      <section className="player-card" role="status">
        <p className="eyebrow">Player accounts</p>
        <h1>Account setup is in progress.</h1>
        <p>Your existing game and show data is untouched. Registration will open after Neon Auth is connected.</p>
      </section>
    </main>
  );
}

function PlayerPageStatus({ message }: { message: string }) {
  return <main className="player-shell"><PlayerHeader /><section className="player-card" role="status"><p>{message}</p></section></main>;
}
