import { useEffect, useRef, useState } from 'react';
import { BUCKETS, KEYS } from '../constants';

const empty = { bucket: 'needs', description: '', category: '', amount: '' };
const input =
  'cursor-pointer w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function TransactionForm({ editing, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef(null);
  const descRef = useRef(null);
  // Last bucket used, so logging several items in a row doesn't reset it to "needs".
  // A ref (not state) because it doesn't need a re-render, and it must be
  // readable by the effect below the moment the parent clears `editing`.
  const lastBucket = useRef(empty.bucket);

  // Fills the form when a transaction is selected for editing, resets it otherwise
  useEffect(() => {
    setForm(editing
      ? { bucket: editing.bucket, description: editing.description, category: editing.category, amount: editing.amount }
      : { ...empty, bucket: lastBucket.current });
    setError('');

    if (!editing) return;

    // The form sits above the lists, so bring it into view when editing starts.
    // 'center' keeps it clear of the sticky header.
    setNotice('');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    formRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    // preventScroll so focusing doesn't fight the smooth scroll above
    descRef.current?.focus({ preventScroll: true });
  }, [editing]);

  // Hides the confirmation message after a moment
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const wasEditing = Boolean(editing);
    const bucket = form.bucket;
    lastBucket.current = bucket;
    try {
      await onSubmit(form);
      setForm({ ...empty, bucket });
      setNotice(wasEditing ? 'Changes saved' : `Added to ${BUCKETS[bucket].label}`);
      // Ready for the next entry without reaching for the screen again
      if (!wasEditing) descRef.current?.focus({ preventScroll: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}
      className={`rounded-2xl bg-surface p-5 shadow-sm sm:p-6 ${editing ? 'ring-2 ring-brand/40' : 'ring-1 ring-line'}`}>
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
        <input ref={descRef} aria-label="Description" className={input} placeholder="Description"
          value={form.description} onChange={set('description')} required maxLength={100} />
        <input aria-label="Category" className={input} list="categories" placeholder="Category"
          value={form.category} onChange={set('category')} />
        <input aria-label="Amount" className={input} type="number" min="0.01" step="0.01" inputMode="decimal"
          placeholder="Amount" value={form.amount} onChange={set('amount')} required />
        <button className="cursor-pointer rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:col-span-2 lg:col-span-1">
          {editing ? 'Save' : 'Add'}
        </button>
      </div>

      <datalist id="categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      {notice && <p role="status" className="mt-3 text-sm text-ink-soft">✓ {notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-brand-dark">{error}</p>}
    </form>
  );
}
