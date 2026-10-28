import { useState } from 'react';
import { monthLabel } from '../constants';

// Always-available version of the copy offer, for a month that already has something in it
// (or whose banner was dismissed). It only adds what is missing and says what it did.
export default function CopyMonthButton({ previousPeriod, onCopy }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ tone: '', text: '' });
  const label = monthLabel(previousPeriod);

  async function copy() {
    if (!confirm(`Copy from ${label}? Missing income and expenses are added; anything already in this month is kept.`)) return;
    setBusy(true);
    setMessage({ tone: '', text: '' });
    try {
      const r = await onCopy(true);
      const parts = [];
      if (r.incomeCopied) parts.push('income');
      if (r.copied > 0) parts.push(`${r.copied} ${r.copied === 1 ? 'expense' : 'expenses'}`);
      setMessage({ tone: 'ok', text: `✓ Copied ${parts.join(' and ')}` });
    } catch (err) {
      // "Everything ... is already here" is information, not a failure
      setMessage({ tone: err.status === 409 ? 'info' : 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const color = message.tone === 'error' ? 'text-brand-dark' : 'text-ink-soft';

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {message.text && <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${color}`}>{message.text}</p>}
      <button type="button" onClick={copy} disabled={busy}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-canvas disabled:opacity-60">
        {busy ? 'Copying…' : `Copy from ${label}`}
      </button>
    </div>
  );
}
