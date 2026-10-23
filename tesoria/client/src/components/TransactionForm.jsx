import { useEffect, useState } from 'react';
import { BUCKETS, KEYS } from '../constants';

const empty = { bucket: 'needs', description: '', category: '', amount: '' };
const input =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function TransactionForm({ editing, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  // Fills the form when a transaction is selected for editing
  useEffect(() => {
    setForm(editing
      ? { bucket: editing.bucket, description: editing.description, category: editing.category, amount: editing.amount }
      : empty);
    setError('');
  }, [editing]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit(form);
      setForm(empty);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{editing ? 'Editing transaction' : 'New transaction'}</h2>
        {editing && (
          <button type="button" onClick={onCancel} className="text-sm font-medium text-muted hover:text-ink">
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1fr_1fr_auto]">
        <select aria-label="Bucket" className={input} value={form.bucket} onChange={set('bucket')}>
          {KEYS.map((k) => <option key={k} value={k}>{BUCKETS[k].label}</option>)}
        </select>
        <input aria-label="Description" className={input} placeholder="Description"
          value={form.description} onChange={set('description')} required maxLength={100} />
        <input aria-label="Category" className={input} list="categories" placeholder="Category"
          value={form.category} onChange={set('category')} />
        <input aria-label="Amount" className={input} type="number" min="0.01" step="0.01" inputMode="decimal"
          placeholder="Amount" value={form.amount} onChange={set('amount')} required />
        <button className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:col-span-2 lg:col-span-1">
          {editing ? 'Save' : 'Add'}
        </button>
      </div>

      <datalist id="categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}
    </form>
  );
}
