import { useState } from 'react';
import { money } from '../constants';

// Shown on an empty month whose previous month has data, so the user can
// start from it instead of typing everything again.
export default function CopyMonthBanner({ previousPeriod, income, spending, onCopy, onDismiss }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [y, m] = previousPeriod.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const hasIncome = income > 0;
  const hasExpenses = spending > 0;
  const parts = [];
  if (hasIncome) parts.push(`${money(income)} of income`);
  if (hasExpenses) parts.push(`${money(spending)} in expenses`);

  async function copy(withExpenses) {
    setBusy(true);
    setError('');
    try {
      await onCopy(withExpenses);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const primary =
    'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60';
  const secondary =
    'rounded-lg border border-line px-5 py-2 text-sm font-semibold text-ink-soft transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <section aria-label="Start this month from the previous one" aria-busy={busy}
      className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Start from {label}?</h2>
          <p className="mt-1 text-sm text-muted">This month is empty. {label} had {parts.join(' and ')}.</p>
        </div>
        <button type="button" onClick={onDismiss} disabled={busy}
          className="shrink-0 text-sm font-medium text-muted hover:text-ink disabled:opacity-60">
          Not now
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {hasExpenses && (
          <button type="button" onClick={() => copy(true)} disabled={busy} className={primary}>
            {hasIncome ? 'Copy income & expenses' : 'Copy expenses'}
          </button>
        )}
        {hasIncome && (
          <button type="button" onClick={() => copy(false)} disabled={busy}
            className={hasExpenses ? secondary : primary}>
            Copy income only
          </button>
        )}
      </div>

      {hasExpenses && (
        <p className="mt-3 text-xs text-muted">
          Expenses are copied as a starting point. You can edit or delete anything afterwards.
        </p>
      )}
      {busy && <p role="status" className="mt-3 text-sm text-ink-soft">Copying…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}
    </section>
  );
}
