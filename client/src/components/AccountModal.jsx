import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const input =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

// Small dialog to change the username. The current password is required because the
// username is also used to sign in.
export default function AccountModal({ username, onChanged, onClose, onDeleted }) {
  const [newName, setNewName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (deleting) {
        await api.deleteAccount(password, confirmation);
        try { localStorage.removeItem('tesoria:last-login'); } catch { /* storage may be blocked */ }
        onDeleted();
        return;
      }
      const r = await api.changeUsername(newName.trim(), password);
      onChanged(r.username);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="account-title" onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <h2 id="account-title" className="text-lg font-semibold">{deleting ? 'Delete account' : 'Account'}</h2>
        <p className="mt-1 text-sm text-muted">You are signed in as <strong className="text-ink">{username}</strong>.</p>

        <div className="mt-4 space-y-3">
          {!deleting && <div>
            <label htmlFor="new-username" className="text-sm font-medium text-ink-soft">New username</label>
            <input id="new-username" ref={nameRef} className={`${input} mt-1`} value={newName}
              onChange={(e) => setNewName(e.target.value)} autoComplete="off" autoCapitalize="none"
              spellCheck={false} required minLength={3} maxLength={30} />
            <p className="mt-1 text-xs text-muted">3-30 characters: letters, numbers, . _ -</p>
          </div>}
          <div>
            <label htmlFor="confirm-password" className="text-sm font-medium text-ink-soft">Current password</label>
            <input id="confirm-password" type="password" className={`${input} mt-1`} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {deleting && <>
            <p className="text-sm text-brand-dark">This permanently deletes your account and budget from the active database and signs out every device. Export first. Provider logs and backups follow the Privacy notice.</p>
            <label className="block text-sm">Type DELETE to confirm
              <input className={`${input} mt-1`} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required pattern="DELETE" autoComplete="off" />
            </label>
          </>}
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas disabled:opacity-60">
            Cancel
          </button>
          <button disabled={busy}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
            {busy ? 'Please wait...' : deleting ? 'Permanently delete account' : 'Save username'}
          </button>
        </div>
        <div className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
          <a href="/api/me/data" className="block text-brand underline">Download account and budget data (JSON)</a>
          <a href="/api/export" className="block text-brand underline">Download budget (CSV)</a>
          <button type="button" disabled={busy} className="text-brand-dark underline" onClick={() => {
            setDeleting((value) => !value); setPassword(''); setConfirmation(''); setError('');
          }}>{deleting ? 'Back to account' : 'Delete my account'}</button>
        </div>
      </form>
    </div>
  );
}
