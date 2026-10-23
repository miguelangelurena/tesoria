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

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <img src="/icon-192.png" alt="Tesoria" className="h-16 w-16 animate-pulse" />
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
