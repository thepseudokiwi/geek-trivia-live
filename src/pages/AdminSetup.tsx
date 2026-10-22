import { useEffect, useState } from 'react';
import { recoveryToken } from '../passwordRecovery';

export function AdminSetup({ token }: { token: string }) {
  const [info, setInfo] = useState<{ email: string; kind: string; role: string } | null>(null);
  const [name, setName] = useState(''), [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(''), [error, setError] = useState('');
  const [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    let active = true;
    setInfo(null); setError(''); setDone(false); setPassword(''); setConfirm(''); setName('');
    if (!token) return;
    fetch('/api/auth/invitation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (active) { setInfo(data); if (data.kind === 'reset') setName(data.email); }
    }).catch(problem => { if (active) setError(problem.message); });
    return () => { active = false; };
  }, [token]);

  const submit = async () => {
    setError('');
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/accept-invitation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, displayName: name, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPassword(''); setConfirm('');
      history.replaceState(null, '', location.pathname + '#admin-setup');
      setDone(true);
    } catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
  };

  if (!token && !done) return <main className="security-screen"><section className="security-card">
    <p className="eyebrow">Host account recovery</p><h1>Reset your password</h1>
    <p>Ask a Nerd Wars administrator for a private password-reset link. They can create one in Access Management.</p>
    <p>If you are the administrator and cannot sign in, use the recovery utility on the computer running Nerd Wars.</p>
    <details><summary>Recover on the server computer</summary>
      <p>In the Nerd Wars project folder, right-click <strong>Reset-NerdWarsPassword.ps1</strong> and choose <strong>Run with PowerShell</strong>. Enter your host account email. It opens a private page where you choose a new password.</p>
      <p>Keep Nerd Wars running. The link expires after one hour and can be used once. No email is sent.</p>
    </details>
    <form onSubmit={event => {
      event.preventDefault(); const next = recoveryToken(link);
      if (!next) { setError('Paste the complete reset link or recovery code provided by your administrator.'); return; }
      setLink(''); setError(''); location.hash = 'admin-setup/' + next;
    }}>
      <label>Reset link or recovery code<input type="password" autoComplete="off" required value={link} onChange={event => setLink(event.target.value)} /></label>
      <button>Continue to reset password</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    <a href="#episodes">Back to sign in</a>
  </section></main>;

  return <main className="security-screen"><section className="security-card">
    <h1>{done ? 'Password saved' : info?.kind === 'reset' ? 'Reset your password' : 'Set up your account'}</h1>
    {done ? <><p>Your password has been saved. Sign in with your email address and new password.</p><a className="button" href="#episodes">Continue to sign in</a></> : <>
      {info && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <p>{info.email} · {info.role}</p>
        {info.kind === 'invite' && <label>Display name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></label>}
        <label>New password (at least 15 characters)<input type="password" required minLength={15} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>Confirm password<input type="password" required minLength={15} maxLength={128} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>}
      {!info && !error && <p>Checking your private link…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {error && !info && <a href="#admin-setup">Get a new reset link</a>}
      <a href="#episodes">Back to sign in</a>
    </>}
  </section></main>;
}
