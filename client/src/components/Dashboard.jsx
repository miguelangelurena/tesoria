import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { KEYS, money } from '../constants';
import AccountModal from './AccountModal';
import Brand from './Brand';
import BucketCard from './BucketCard';
import Charts from './Charts';
import CopyMonthBanner from './CopyMonthBanner';
import CopyMonthButton from './CopyMonthButton';
import Footer from './Footer';
import MonthPicker from './MonthPicker';
import DashboardSkeleton from './Skeleton';
import TransactionForm from './TransactionForm';

const CARD = 'rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line';

// "2026-10" -> "2026-09" (handles the year boundary: "2026-01" -> "2025-12")
function previousPeriod(p) {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Summary card used for income, spending and what's left
function StatCard({ label, value, hint, tone = 'neutral' }) {
  const color = { neutral: 'text-ink', good: 'text-growth', bad: 'text-brand-dark' }[tone];
  return (
    <div className={CARD}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold sm:text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

export default function Dashboard({ user, onLogout, onUsernameChange }) {
  const [period, setPeriod] = useState(user.maxPeriod);
  const [income, setIncome] = useState(0);
  const [incomeInput, setIncomeInput] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [trend, setTrend] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  // Month whose data is currently on screen (so we never judge a month "empty" while it is still loading)
  const [loadedPeriod, setLoadedPeriod] = useState(null);
  // Months where the user chose "Not now" on the copy offer
  const [dismissed, setDismissed] = useState([]);
  // Income autosave status: 'idle' | 'saving' | 'saved' | 'error'
  const [incomeStatus, setIncomeStatus] = useState('idle');
  const [incomeError, setIncomeError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  // Always holds the month on screen, so a slow save can tell the user has moved on
  const periodRef = useRef(period);
  useEffect(() => { periodRef.current = period; }, [period]);

  // Loads the selected month plus the 12-month series and category list
  const refresh = useCallback(async () => {
    try {
      const [m, s, c] = await Promise.all([api.getMonth(period), api.summary(), api.categories()]);
      // The user moved to another month while this was loading: its own request will fill the screen
      if (periodRef.current !== period) return;
      setIncome(m.income);
      setIncomeInput(m.income || '');
      setTransactions(m.transactions);
      setTrend(s.months);
      setCategories(c.categories);
      setLoadedPeriod(period);
      setError('');
    } catch (e) {
      if (periodRef.current !== period) return;
      setError(e.message);
    }
  }, [period]);

  useEffect(() => { refresh(); }, [refresh]);

  // Saves the income and reports the result next to the field
  const saveIncome = useCallback(async (value) => {
    const savedFor = period;
    setIncomeStatus('saving');
    try {
      await api.setIncome(savedFor, value);
    } catch (e) {
      if (periodRef.current !== savedFor) return;
      setIncomeError(e.message);
      setIncomeStatus('error');
      return;
    }
    // The user switched months while this was saving: don't touch the month now on screen
    if (periodRef.current !== savedFor) return;
    setIncome(value);
    setIncomeStatus('saved');
    // The income itself is saved; a failure here only affects the charts, so it uses the top banner
    try {
      setTrend((await api.summary()).months);
    } catch (e) {
      setError(e.message);
    }
  }, [period]);

  // Saves the income 500 ms after the user stops typing
  useEffect(() => {
    const value = Math.max(0, Number(incomeInput) || 0);
    if (value === income) return;
    const t = setTimeout(() => saveIncome(value), 500);
    return () => clearTimeout(t);
  }, [incomeInput, income, saveIncome]);

  // "Saved" is a short confirmation: go back to the neutral text after a moment
  useEffect(() => {
    if (incomeStatus !== 'saved') return;
    const t = setTimeout(() => setIncomeStatus('idle'), 2000);
    return () => clearTimeout(t);
  }, [incomeStatus]);

  const spent = useMemo(
    () => Object.fromEntries(KEYS.map((k) => [k, transactions
      .filter((t) => t.bucket === k)
      .reduce((a, t) => a + t.amount, 0)])),
    [transactions]
  );

  // Needs + Wants are money spent. Savings is money set aside, so it is not "spent".
  const spending = spent.needs + spent.wants;
  const saved = spent.savings;
  // Money not yet spent or set aside
  const left = income - spending - saved;
  const spentPct = income > 0 ? Math.round((spending / income) * 100) : 0;

  let leftHint = 'Available to spend or save';
  if (income === 0) leftHint = 'Nothing to track yet';
  else if (left < 0) leftHint = 'Over budget this month';
  else if (saved > 0) leftHint = `After setting aside ${money(saved)}`;

  // The month on screen is still loading (first visit, or just switched months)
  const loading = loadedPeriod !== period;
  const loadFailed = loading && Boolean(error);

  // The previous month is worth copying only if it actually has something in it
  const prevPeriod = previousPeriod(period);
  const prevData = trend.find((m) => m.period === prevPeriod);
  const prevSpending = prevData ? prevData.needs + prevData.wants + prevData.savings : 0;
  const prevHasData = Boolean(prevData) && (prevData.income > 0 || prevSpending > 0);
  // Big offer: this month is empty and the offer was not dismissed
  const canCopy = !loading && income === 0 && transactions.length === 0 && !dismissed.includes(period) && prevHasData;
  // Small button: everything else (month already has data, or the offer was dismissed)
  const canCopyMore = !loading && prevHasData && !canCopy;

  async function copyFromPrevious(withExpenses) {
    const result = await api.copyPrevious(period, withExpenses);
    await refresh();
    return result;
  }

  async function saveTransaction(body) {
    if (editing) await api.updateTx(editing.id, body);
    else await api.addTx(period, body);
    setEditing(null);
    await refresh();
  }

  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.deleteTx(id);
      if (editing?.id === id) setEditing(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function logout() {
    await api.logout();
    onLogout();
  }

  const incomeFailed = incomeStatus === 'error';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-ink text-white shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Brand variant="dark" />

          <MonthPicker value={period} min={user.minPeriod} max={user.maxPeriod}
            onChange={(p) => { setEditing(null); setIncomeStatus('idle'); setError(''); setPeriod(p); }} />

          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <span className="hidden text-sm text-white/60 lg:inline">Hi, {user.username}</span>
            <button onClick={() => setAccountOpen(true)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white">
              Account
            </button>
            <a href="/api/export"
              className="rounded-lg border border-growth-light/60 px-3 py-1.5 text-sm font-medium text-growth-light transition hover:bg-growth-light/10">
              Export CSV
            </a>
            <button onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 sm:space-y-6 sm:p-6">
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand/10 p-3 text-sm text-brand-dark">
            <span>{error}</span>
            {loadFailed && (
              <button type="button" onClick={refresh} className="font-semibold underline">Try again</button>
            )}
          </div>
        )}

        {loading && !loadFailed && <DashboardSkeleton />}

        {!loading && (
          <>
          {canCopy && (
            <CopyMonthBanner previousPeriod={prevPeriod} income={prevData.income} spending={prevSpending}
              onCopy={copyFromPrevious} onDismiss={() => setDismissed((d) => [...d, period])} />
          )}

          <section className="grid gap-4 sm:grid-cols-3 sm:gap-5">
            <div className={CARD}>
              <label htmlFor="income" className="text-sm font-medium text-muted">Monthly income</label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-lg text-muted">$</span>
                <input id="income" type="number" min="0" step="0.01" inputMode="decimal"
                  value={incomeInput} placeholder="0.00"
                  onChange={(e) => {
                    setIncomeInput(e.target.value);
                    // Typing again dismisses a stale error; the next save attempt will report its own result
                    setIncomeStatus((s) => (s === 'error' ? 'idle' : s));
                  }}
                  aria-invalid={incomeFailed} aria-describedby="income-status"
                  className={`w-full rounded-lg border py-2 pl-7 pr-3 text-xl font-semibold outline-none transition focus:ring-2 sm:text-2xl ${
                    incomeFailed
                      ? 'border-brand-dark focus:border-brand-dark focus:ring-brand-dark/20'
                      : 'border-line focus:border-brand focus:ring-brand/20'
                  }`} />
              </div>
              <p id="income-status" aria-live="polite"
                className={`mt-1 text-xs ${incomeFailed ? 'text-brand-dark' : 'text-muted'}`}>
                {incomeStatus === 'idle' && 'Saved automatically as you type.'}
                {incomeStatus === 'saving' && 'Saving…'}
                {incomeStatus === 'saved' && '✓ Saved'}
                {incomeFailed && (
                  <>
                    Could not save: {incomeError}{' '}
                    <button type="button" onClick={() => saveIncome(Math.max(0, Number(incomeInput) || 0))}
                      className="font-semibold underline">
                      Retry
                    </button>
                  </>
                )}
              </p>
            </div>

            <StatCard label="Total spent" value={money(spending)}
              hint={income > 0 ? `${spentPct}% of your income` : 'Add your income to see progress'} />

            <StatCard label="Left this month" value={money(left)}
              tone={income === 0 ? 'neutral' : left < 0 ? 'bad' : 'good'}
              hint={leftHint} />
          </section>

          <TransactionForm editing={editing} categories={categories}
            onSubmit={saveTransaction} onCancel={() => setEditing(null)} />

          {canCopyMore && <CopyMonthButton key={period} previousPeriod={prevPeriod} onCopy={copyFromPrevious} />}

          <div className="grid gap-5 md:grid-cols-3">
            {KEYS.map((k) => (
              <BucketCard key={k} bucketKey={k} income={income} spent={spent[k]}
                transactions={transactions} onEdit={setEditing} onDelete={deleteTransaction} />
            ))}
          </div>

          <Charts period={period} income={income} spent={spent}
            transactions={transactions} trend={trend} />
          </>
        )}
      </main>

      <Footer />

      {accountOpen && (
        <AccountModal username={user.username} onChanged={onUsernameChange} onClose={() => setAccountOpen(false)} />
      )}
    </div>
  );
}
