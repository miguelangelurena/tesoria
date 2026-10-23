import { useEffect, useState } from 'react';
import { api } from '../api';
import Brand from './Brand';
import Footer from './Footer';

const VIEW = { LOGIN: 'login', REGISTER: 'register', VERIFY: 'verify', FORGOT: 'forgot', RESET: 'reset' };
const RESEND_SECONDS = 60;

const TITLES = {
  login: 'Sign in to see your budget',
  register: 'Create your account',
  verify: 'Check your email',
  forgot: 'Reset your password',
  reset: 'Enter the code and a new password',
};

const SUBMIT_LABELS = {
  login: 'Sign in',
  register: 'Create account',
  verify: 'Verify and continue',
  forgot: 'Send code',
  reset: 'Change password',
};

const input =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export default function Login({ onLogin, onBack, initialView = VIEW.LOGIN }) {
  const [view, setView] = useState(initialView);
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '', code: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown for "resend code"
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function show(nextView, message = '') {
    setView(nextView);
    setError('');
    setInfo(message);
  }

  async function run(action) {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await action();
    } catch (err) {
      // Unverified account: the server already sent a new code, so go to the verify step
      if (err.data?.needsVerification) {
        setForm((f) => ({ ...f, email: err.data.email, code: '' }));
        show(VIEW.VERIFY, err.message);
        setCooldown(RESEND_SECONDS);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const requestReset = () => run(async () => {
    await api.forgot(form.email);
    show(VIEW.RESET, 'If an account exists for that email, we sent a code.');
    setCooldown(RESEND_SECONDS);
  });

  function handleSubmit(e) {
    e.preventDefault();

    if (view === VIEW.LOGIN) {
      return run(async () => {
        await api.login(form.identifier, form.password);
        await onLogin();
      });
    }
    if (view === VIEW.REGISTER) {
      return run(async () => {
        const r = await api.register(form.username, form.email, form.password);
        setForm((f) => ({ ...f, email: r.email, code: '' }));
        show(VIEW.VERIFY, `We sent a 6-digit code to ${r.email}`);
        setCooldown(RESEND_SECONDS);
      });
    }
    if (view === VIEW.VERIFY) {
      return run(async () => {
        await api.verify(form.email, form.code);
        await onLogin();
      });
    }
    if (view === VIEW.FORGOT) return requestReset();
    if (view === VIEW.RESET) {
      return run(async () => {
        await api.reset(form.email, form.code, form.password);
        setForm((f) => ({ ...f, password: '', code: '' }));
        show(VIEW.LOGIN, 'Password updated. Sign in with your new password.');
      });
    }
  }

  const resendVerifyCode = () => run(async () => {
    await api.resend(form.email);
    setInfo('We sent you a new code.');
    setCooldown(RESEND_SECONDS);
  });

  const resendLabel = cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code';

  return (
    <div className="flex min-h-dvh flex-col">
    <main className="grid flex-1 place-items-center p-4">
      <div className="w-full max-w-sm">
        <button type="button" onClick={onBack} className="mb-4 text-sm font-medium text-muted hover:text-ink">
          ← Back to home
        </button>
        <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8">
          <div className="flex justify-center">
            <Brand variant="light" />
          </div>
          <p className="mb-6 mt-4 text-center text-sm text-muted">{TITLES[view]}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === VIEW.LOGIN && (
              <>
                <Field label="Username or email">
                  <input className={input} value={form.identifier} onChange={set('identifier')}
                    autoComplete="username" required />
                </Field>
                <Field label="Password">
                  <input className={input} type="password" value={form.password} onChange={set('password')}
                    autoComplete="current-password" required />
                </Field>
              </>
            )}

            {view === VIEW.REGISTER && (
              <>
                <Field label="Username">
                  <input className={input} value={form.username} onChange={set('username')}
                    autoComplete="username" required minLength={3} />
                </Field>
                <Field label="Email">
                  <input className={input} type="email" value={form.email} onChange={set('email')}
                    autoComplete="email" required />
                </Field>
                <Field label="Password" hint="At least 6 characters">
                  <input className={input} type="password" value={form.password} onChange={set('password')}
                    autoComplete="new-password" required minLength={6} />
                </Field>
              </>
            )}

            {view === VIEW.VERIFY && (
              <Field label="Verification code">
                <input className={`${input} text-center text-lg tracking-[0.4em]`} inputMode="numeric"
                  maxLength={6} value={form.code} onChange={set('code')}
                  autoComplete="one-time-code" placeholder="000000" required />
              </Field>
            )}

            {view === VIEW.FORGOT && (
              <Field label="Email">
                <input className={input} type="email" value={form.email} onChange={set('email')}
                  autoComplete="email" required />
              </Field>
            )}

            {view === VIEW.RESET && (
              <>
                <Field label="Code from your email">
                  <input className={`${input} text-center text-lg tracking-[0.4em]`} inputMode="numeric"
                    maxLength={6} value={form.code} onChange={set('code')}
                    autoComplete="one-time-code" placeholder="000000" required />
                </Field>
                <Field label="New password" hint="At least 6 characters">
                  <input className={input} type="password" value={form.password} onChange={set('password')}
                    autoComplete="new-password" required minLength={6} />
                </Field>
              </>
            )}

            {info && <p className="text-sm text-growth">{info}</p>}
            {error && <p role="alert" className="text-sm text-brand-dark">{error}</p>}

            <button disabled={loading}
              className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
              {loading ? 'Please wait...' : SUBMIT_LABELS[view]}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-center text-sm">
            {view === VIEW.LOGIN && (
              <>
                <button type="button" onClick={() => show(VIEW.FORGOT)} className="block w-full font-medium text-brand hover:underline">
                  Forgot password?
                </button>
                <button type="button" onClick={() => show(VIEW.REGISTER)} className="block w-full font-medium text-brand hover:underline">
                  No account? Sign up
                </button>
              </>
            )}
            {view === VIEW.REGISTER && (
              <button type="button" onClick={() => show(VIEW.LOGIN)} className="block w-full font-medium text-brand hover:underline">
                Already have an account? Sign in
              </button>
            )}
            {view === VIEW.VERIFY && (
              <>
                <button type="button" onClick={resendVerifyCode} disabled={cooldown > 0 || loading}
                  className="block w-full font-medium text-brand hover:underline disabled:text-muted disabled:no-underline">
                  {resendLabel}
                </button>
                <button type="button" onClick={() => show(VIEW.REGISTER)} className="block w-full text-muted hover:text-ink">
                  Wrong email? Start over
                </button>
              </>
            )}
            {(view === VIEW.FORGOT || view === VIEW.RESET) && (
              <>
                {view === VIEW.RESET && (
                  <button type="button" onClick={requestReset} disabled={cooldown > 0 || loading}
                    className="block w-full font-medium text-brand hover:underline disabled:text-muted disabled:no-underline">
                    {resendLabel}
                  </button>
                )}
                <button type="button" onClick={() => show(VIEW.LOGIN)} className="block w-full text-muted hover:text-ink">
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Your data is kept for 12 months from the current month.
        </p>
      </div>
    </main>
    <Footer />
    </div>
  );
}
