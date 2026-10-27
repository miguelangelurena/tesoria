import { useEffect, useState } from 'react';
import { api } from './api';
import Landing from './components/Landing';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  // undefined = loading, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  // Signed-out screens: the landing page, or the auth form opened at a given view
  const [screen, setScreen] = useState({ page: 'landing' });
  // Set when we could not tell whether the user is signed in (server asleep, offline...)
  const [bootError, setBootError] = useState('');
  // True when the first load is taking long enough to deserve an explanation
  const [slow, setSlow] = useState(false);
  // Bumped by "Try again" to re-run the session check
  const [attempt, setAttempt] = useState(0);

  // Session check. Only a 401 means "signed out"; any other failure means "unknown".
  useEffect(() => {
    let cancelled = false;
    api.me()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) setUser(null);
        else setBootError(err.message);
      });
    return () => { cancelled = true; };
  }, [attempt]);

  // After 4 s of loading, explain the wait (a cold server can take up to a minute)
  useEffect(() => {
    if (user !== undefined || bootError) return;
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [user, bootError, attempt]);

  function retry() {
    setBootError('');
    setSlow(false);
    setAttempt((a) => a + 1);
  }

  if (bootError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <img src="/icon-192.png" alt="Tesoria" className="mx-auto h-16 w-16 opacity-80" />
          <h1 className="mt-5 text-lg font-semibold">We couldn't reach Tesoria</h1>
          <p role="alert" className="mt-2 text-sm text-ink-soft">{bootError}</p>
          <p className="mt-1 text-sm text-muted">This is a connection problem. Your account and data are safe.</p>
          <button type="button" onClick={retry}
            className="mt-6 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (user === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <img src="/icon-192.png" alt="Tesoria" className="mx-auto h-16 w-16 animate-pulse" />
          {slow && (
            <p role="status" className="mx-auto mt-4 max-w-xs text-sm text-muted">
              Waking up the server. This can take up to a minute the first time.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    if (screen.page === 'landing') {
      return <Landing onStart={(view) => setScreen({ page: 'auth', view })} />;
    }
    return (
      <Login
        initialView={screen.view}
        onBack={() => setScreen({ page: 'landing' })}
        onLogin={async () => setUser(await api.me())}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        setUser(null);
        setScreen({ page: 'landing' });
      }}
    />
  );
}
