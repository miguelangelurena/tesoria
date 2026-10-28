import { useEffect, useRef } from 'react';

// In-app replacement for window.confirm(). Focus starts on "Cancel" so an accidental
// Enter never confirms a destructive action; Escape and a click outside also cancel.
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        <p id="confirm-message" className="mt-2 text-sm text-ink-soft">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" ref={cancelRef} onClick={onCancel} disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
              danger ? 'bg-brand-dark hover:bg-brand' : 'bg-brand hover:bg-brand-dark'
            }`}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
