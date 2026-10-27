import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { KEYS, money } from '../constants';
import Brand from './Brand';
import BucketCard from './BucketCard';
import Charts from './Charts';
import Footer from './Footer';
import MonthPicker from './MonthPicker';
import TransactionForm from './TransactionForm';

const CARD = 'rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line';

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

export default function Dashboard({ user, onLogout }) {
  const [period, setPeriod] = useState(user.maxPeriod);
  const [income, setIncome] = useState(0);
  const [incomeInput, setIncomeInput] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [trend, setTrend] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  // Loads the selected month plus the 12-month series and category list
  const refresh = useCallback(async () => {
    try {
      const [m, s, c] = await Promise.all([api.getMonth(period), api.summary(), api.categories()]);
      setIncome(m.income);
      setIncomeInput(m.income || '');
      setTransactions(m.transactions);
      setTrend(s.months);
      setCategories(c.categories);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [period]);

  useEffect(() => { refresh(); }, [refresh]);

  // Saves the income 500 ms after the user stops typing
  useEffect(() => {
    const value = Math.max(0, Number(incomeInput) || 0);
    if (value === income) return;
    const t = setTimeout(async () => {
      try {
        await api.setIncome(period, value);
        setIncome(value);
        setTrend((await api.summary()).months);
      } catch (e) {
        setError(e.message);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [incomeInput, period, income]);

  const spent = useMemo(
    () => Object.fromEntries(KEYS.map((k) => [k, transactions
      .filter((t) => t.bucket === k)
      .reduce((a, t) => a + t.amount, 0)])),
    [transactions]
  );
  const totalSpent = KEYS.reduce((a, k) => a + spent[k], 0);
  const left = income - totalSpent;
  const spentPct = income > 0 ? Math.round((totalSpent / income) * 100) : 0;

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-ink text-white shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Brand variant="dark" />

          <MonthPicker value={period} min={user.minPeriod} max={user.maxPeriod}
            onChange={(p) => { setEditing(null); setPeriod(p); }} />

          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <span className="hidden text-sm text-white/60 lg:inline">Hi, {user.username}</span>
            <a href="/api/export"
              className="rounded-lg border border-growth-light/60 px-3 py-1.5 text-sm font-medium text-growth-light transition hover:bg-growth-light/10">
              Export CSV
            </a>
            <button onClick={logout}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 sm:space-y-6 sm:p-6">
        {error && (
          <div role="alert" className="rounded-lg bg-brand/10 p-3 text-sm text-brand-dark">{error}</div>
        )}

        <section className="grid gap-4 sm:grid-cols-3 sm:gap-5">
          <div className={CARD}>
            <label htmlFor="income" className="text-sm font-medium text-muted">Monthly income</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-lg text-muted">$</span>
              <input id="income" type="number" min="0" step="0.01" inputMode="decimal"
                value={incomeInput} onChange={(e) => setIncomeInput(e.target.value)} placeholder="0.00"
                className="w-full rounded-lg border border-line py-2 pl-7 pr-3 text-xl font-semibold outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-2xl" />
            </div>
            <p className="mt-1 text-xs text-muted">Type your income and the targets update instantly.</p>
          </div>

          <StatCard label="Total spent" value={money(totalSpent)}
            hint={income > 0 ? `${spentPct}% of your income` : 'Add your income to see progress'} />

          <StatCard label="Left this month" value={money(left)}
            tone={income === 0 ? 'neutral' : left < 0 ? 'bad' : 'good'}
            hint={income === 0 ? 'Nothing to track yet' : left < 0 ? 'Over budget this month' : 'Available to spend or save'} />
        </section>

        <TransactionForm editing={editing} categories={categories}
          onSubmit={saveTransaction} onCancel={() => setEditing(null)} />

        <div className="grid gap-5 md:grid-cols-3">
          {KEYS.map((k) => (
            <BucketCard key={k} bucketKey={k} income={income} spent={spent[k]}
              transactions={transactions} onEdit={setEditing} onDelete={deleteTransaction} />
          ))}
        </div>

        <Charts period={period} income={income} spent={spent}
          transactions={transactions} trend={trend} />
      </main>

      <Footer />
    </div>
  );
}
