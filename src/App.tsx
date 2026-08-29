import { lazy, Suspense, useEffect, useState } from 'react';
import { AudienceDisplay } from './pages/AudienceDisplay';
import { ContestantPlay } from './pages/ContestantPlay';
import { EpisodeBuilder } from './pages/EpisodeBuilder';
import { EpisodeRun } from './pages/EpisodeRun';
import { Episodes } from './pages/Episodes';
import { HostConsole } from './pages/HostConsole';
import { QuestionLibrary } from './pages/QuestionLibrary';
import { ThemeDesigner } from './pages/ThemeDesigner';
import { ThemePreview } from './pages/ThemePreview';
import { appDarkEnabled, setAppDarkMode } from './darkMode';
import { parseHashRoute, type AppPage, type AppView } from './routing';

const OpenPlay = lazy(() => import('./pages/OpenPlay').then((module) => ({ default: module.OpenPlay })));
const PlayerAccount = lazy(() => import('./pages/PlayerAccount').then((module) => ({ default: module.PlayerAccount })));
const PlayerAuth = lazy(() => import('./pages/PlayerAuth').then((module) => ({ default: module.PlayerAuth })));
const playerPage = (content: React.ReactNode) => <Suspense fallback={<main className="player-shell"><p>Loading Nerd Wars…</p></main>}>{content}</Suspense>;

export default function App() {
  const [view, setView] = useState<AppView>(parseHashRoute);
  const [dark, setDark] = useState(appDarkEnabled);

  useEffect(() => {
    const change = () => setView(parseHashRoute());
    const darkChange = (event: Event) => setDark(Boolean((event as CustomEvent<boolean>).detail));
    addEventListener('hashchange', change);
    addEventListener('nerd-wars-dark-mode', darkChange);
    return () => {
      removeEventListener('hashchange', change);
      removeEventListener('nerd-wars-dark-mode', darkChange);
    };
  }, []);

  useEffect(() => {
    const backend = !['play', 'audience', 'theme-preview', 'account', 'auth', 'open-play'].includes(view.page);
    document.body.classList.toggle('backend-dark', dark && backend);
    document.body.classList.toggle('host-dark', dark && view.page === 'host');
    return () => document.body.classList.remove('backend-dark', 'host-dark');
  }, [dark, view.page]);

  const go = (page: AppPage, id?: string) => {
    location.hash = `${page}${id ? `/${id}` : ''}`;
    setView({ page, id });
  };
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    location.reload();
  };
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    setAppDarkMode(next);
  };

  if (view.page === 'play') return <ContestantPlay joinCode={view.id} />;
  if (view.page === 'audience') return <AudienceDisplay id={view.id!} />;
  if (view.page === 'theme-preview') return <ThemePreview id={view.id!} />;
  if (view.page === 'host') return <HostConsole id={view.id!} back={() => go('episodes')} />;
  if (view.page === 'account') return playerPage(<PlayerAccount />);
  if (view.page === 'auth') return playerPage(<PlayerAuth path={view.id} />);
  if (view.page === 'open-play') return playerPage(<OpenPlay />);

  return (
    <>
      <nav>
        <strong>Geek Trivia Live</strong>
        <button className={view.page === 'library' ? 'active' : ''} onClick={() => go('library')}>Question Library</button>
        <button className={view.page === 'episodes' ? 'active' : ''} onClick={() => go('episodes')}>Episodes</button>
        <button className={view.page === 'builder' ? 'active' : ''} onClick={() => go('builder')}>New Episode</button>
        <button className={view.page === 'theme-designer' ? 'active' : ''} onClick={() => go('theme-designer')}>Theme Designer</button>
        <button className="app-dark-toggle" aria-pressed={dark} onClick={toggleDark}>{dark ? '☀ Light mode' : '◐ Dark mode'}</button>
        <button onClick={() => void logout()}>Sign out</button>
      </nav>
      {view.page === 'library' ? <QuestionLibrary />
        : view.page === 'episodes' ? <Episodes openBuilder={(id) => go('builder', id)} openRun={(id) => go('run', id)} openHost={(id) => go('host', id)} />
          : view.page === 'builder' ? <EpisodeBuilder episodeId={view.id} back={() => go('episodes')} />
            : view.page === 'theme-designer' ? <ThemeDesigner id={view.id} onSelect={(id) => go('theme-designer', id)} />
              : <EpisodeRun id={view.id!} back={() => go('episodes')} />}
    </>
  );
}
