import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SecurityGate } from './SecurityGate';
import './styles.css';
import './playerGameplay.css';
import './presentation.css';
import './fantasyCodex.css';
import './natural20.css';
import './d20BoardSequence.css';
import './timerCircle.css';
import './questionGame.css';
import './hostDark.css';
import './appDark.css';
import './hostLayout.css';
import './videoFeeds.css';
import './security.css';
import './playerAccounts.css';

const PlayerAuthProvider = lazy(() => import('./PlayerAuthProvider').then((module) => ({ default: module.PlayerAuthProvider })));
const needsPlayerAccount = () => /^#(?:account(?:\/|$)|auth\/|open-play(?:\/|$)|admin(?:\/|$))/.test(location.hash);

function Root() {
  const [withPlayerAuth, setWithPlayerAuth] = useState(needsPlayerAccount);
  useEffect(() => {
    const update = () => setWithPlayerAuth(needsPlayerAccount());
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  const app = <SecurityGate><App /></SecurityGate>;
  return withPlayerAuth
    ? <Suspense fallback={<main className="player-shell"><p>Loading player accounts…</p></main>}><PlayerAuthProvider>{app}</PlayerAuthProvider></Suspense>
    : app;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
