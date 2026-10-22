import { AuthView, authViewPaths } from '@neondatabase/auth-ui';
import { playerAuthConfigured, playerAccountReturnUrl } from '../lib/playerAuth';

const supportedViews = new Set(Object.values(authViewPaths));

export function PlayerAuth({ path = 'sign-in' }: { path?: string }) {
  if (!playerAuthConfigured) return <PlayerAuthUnavailable />;

  const selected = supportedViews.has(path) ? path : authViewPaths.SIGN_IN;
  const returnUrl = playerAccountReturnUrl();
  return (
    <main className="player-shell player-auth-shell">
      <PlayerHeader />
      <AuthView
        pathname={selected}
        redirectTo={returnUrl}
        callbackURL={returnUrl}
        socialLayout="vertical"
      />
    </main>
  );
}

function PlayerAuthUnavailable() {
  return (
    <main className="player-shell">
      <PlayerHeader />
      <section className="player-card" role="status">
        <p className="eyebrow">Player accounts</p>
        <h1>Registration is almost ready.</h1>
        <p>The secure account service still needs to be connected before sign-up can open.</p>
        <a className="player-button secondary" href="#open-play">Check open play</a>
      </section>
    </main>
  );
}

export function PlayerHeader() {
  return (
    <header className="player-header">
      <a className="player-brand" href="#open-play" aria-label="Nerd Wars open play">
        <span aria-hidden="true">⚔</span>
        <span><strong>Nerd Wars</strong><small>Player Portal</small></span>
      </a>
      <nav aria-label="Player navigation">
        <a href="#open-play">Open play</a>
        <a href="#account">My account</a>
      </nav>
    </header>
  );
}
