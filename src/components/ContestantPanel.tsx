import { useEffect, useState } from 'react';
import type { HostContestantState } from '../../shared/types';
import { JoinQrCode } from './JoinQrCode';

export function ContestantPanel({ episodeId, disabled }: { episodeId: string; disabled: boolean }) {
  const [state, setState] = useState<HostContestantState | null>(null);
  const [error, setError] = useState('');
  const load = () => fetch(`/api/episodes/${episodeId}/contestants`).then(async response => {
    if (!response.ok) throw new Error((await response.json()).error);
    return response.json();
  }).then(setState).catch(problem => setError(problem.message));

  useEffect(() => {
    load();
    const id = setInterval(load, 1_000);
    return () => clearInterval(id);
  }, [episodeId]);

  const post = async (path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(`/api/episodes/${episodeId}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) { setError((await response.json()).error); return; }
    setError(''); setState(await response.json());
  };
  const remove = async (sessionId: string) => {
    const response = await fetch(`/api/episodes/${episodeId}/contestants/${sessionId}`, { method: 'DELETE' });
    if (!response.ok) { setError((await response.json()).error); return; }
    setState(await response.json());
  };

  const join = state?.joinSession;
  const link = join ? `${location.origin}/#play/${join.joinCode}` : '';
  const timer = state?.buzzer.responseTimer;
  const responder = state?.contestants.find(contestant => contestant.sessionId === state.buzzer.winnerSessionId);

  return <section className="contestant-panel">
    <div className="broadcast-heading"><div><p className="eyebrow">Remote play</p><h2>Contestants</h2></div><strong>{state?.contestants.filter(x => x.connected).length ?? 0} connected</strong></div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="join-controls">
      {join ? <><JoinQrCode value={link} /><div className="join-code"><span>JOIN CODE</span><strong>{join.joinCode}</strong><small>{link}</small></div>
        <button onClick={() => navigator.clipboard?.writeText(link)}>Copy join link</button>
        <button disabled={disabled} onClick={() => post('join-session/show-graphic', { joinUrl: link })}>Show join graphic</button>
        <button disabled={disabled} onClick={() => post('join-session/lock')}>Lock joins</button>
        <button disabled={disabled} onClick={() => post('join-session/regenerate')}>Regenerate</button></>
        : <button disabled={disabled} onClick={() => post('join-session/open', { maxParticipants: 8 })}>Open joins</button>}
    </div>
    <div className="contestant-actions">
      <button disabled={disabled || !join} onClick={() => post('ready-check', { open: true })}>Open ready check</button>
      <button disabled={disabled || !join} onClick={() => post('ready-check', { open: false, reset: true })}>Reset ready</button>
      <button disabled={disabled} onClick={() => post('buzzer/arm')}>Arm</button>
      <button disabled={disabled} className="take-button" onClick={() => post('buzzer/open')}>Open buzzer</button>
      <button disabled={disabled} onClick={() => post('buzzer/lock')}>Lock</button>
      <button disabled={disabled} onClick={() => post('buzzer/steal')}>Open steal</button>
      <button disabled={disabled} onClick={() => post('buzzer/cancel')}>Cancel</button>
    </div>
    {responder && <div className="responder"><strong>Current responder: {responder.displayName}</strong>
      <span>Response: {Math.ceil((timer?.remainingMs ?? 0) / 1000)}s · {timer?.status}</span>
      <button disabled={disabled} onClick={() => post('response-timer/pause')}>Pause response</button>
      <button disabled={disabled} onClick={() => post('response-timer/resume')}>Resume response</button>
      <button disabled={disabled} onClick={() => post('response-timer/reset', { durationMs: 15_000 })}>Reset response</button>
      <button disabled={disabled} onClick={() => post('buzzer/adjudicate', { outcome: 'correct' })}>Correct</button>
      <button disabled={disabled} onClick={() => post('buzzer/adjudicate', { outcome: 'incorrect' })}>Incorrect</button>
      <button disabled={disabled} onClick={() => post('buzzer/adjudicate', { outcome: 'no-answer' })}>No answer</button>
      <button disabled={disabled} onClick={() => post('buzzer/adjudicate', { outcome: 'technical-fault' })}>Technical fault</button>
    </div>}
    <ul className="contestant-list">{state?.contestants.map(contestant => <li key={contestant.sessionId}>
      <span className={contestant.connected ? 'online' : 'offline'}>{contestant.displayName}{contestant.team ? ` · ${contestant.team}` : ''}</span>
      <strong>{contestant.score} XP</strong>
      <span>{contestant.ready ? 'Ready' : 'Not ready'} · {contestant.latency} · {contestant.status}</span>
      {contestant.warning && <em>{contestant.warning}</em>}
      <button disabled={disabled} onClick={() => remove(contestant.sessionId)}>Remove</button>
    </li>)}</ul>
  </section>;
}
