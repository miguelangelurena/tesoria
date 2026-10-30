import { useState } from 'react';
import { BUCKETS, OVER_COLOR, money } from '../constants';
import useMediaQuery from '../useMediaQuery';

// How many transactions a card shows before the rest move behind "Show more"
// (fewer on phones, where the three cards are stacked and the page gets very long)
const VISIBLE_DESKTOP = 5;
const VISIBLE_PHONE = 3;

export default function BucketCard({ bucketKey, income, spent, transactions, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const isPhone = useMediaQuery('(max-width: 767px)');
  const VISIBLE = isPhone ? VISIBLE_PHONE : VISIBLE_DESKTOP;
  const b = BUCKETS[bucketKey];
  const isGoal = b.type === 'goal';
  const target = (income * b.pct) / 100;
  const pct = target > 0 ? (spent / target) * 100 : 0;
  // Rounded to cents so floating-point noise never flips the state
  const delta = Math.round((spent - target) * 100) / 100;
  // Only spending caps can be "over"; a savings goal can only be reached
  const over = !isGoal && target > 0 && delta > 0;
  const reached = isGoal && target > 0 && delta >= 0;
  const items = transactions.filter((t) => t.bucket === bucketKey);
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const hiddenCount = items.length - VISIBLE;

  let badge = 'No income yet';
  if (target > 0) {
    if (isGoal) badge = reached ? '✓ Goal reached' : `${Math.round(pct)}% of goal`;
    else badge = `${Math.round(pct)}% used`;
  }

  let status = '';
  if (target > 0) {
    if (isGoal) {
      status = !reached
        ? `${money(-delta)} to go`
        : delta > 0 ? `${money(delta)} above your goal` : 'Right on your goal';
    } else {
      status = over ? `Over by ${money(delta)}` : `${money(-delta)} left`;
    }
  }

  const badgeStyle = over
    ? 'bg-brand/10 text-brand-dark'
    : reached
      ? 'bg-growth/15 text-ink'
      : 'bg-canvas text-muted';

  return (
    <div className="flex flex-col rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold" style={{ color: b.color }}>{b.label}</h2>
          <p className="text-xs text-muted">{b.pct}% · {b.hint}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeStyle}`}>
          {badge}
        </span>
      </div>

      <div className="mt-4 flex justify-between gap-2 text-sm">
        <span className="text-muted">{isGoal ? 'Goal' : 'Target'} <strong className="text-ink">{money(target)}</strong></span>
        <span className="text-muted">
          {isGoal ? 'Saved' : 'Spent'}{' '}
          <strong style={over ? { color: OVER_COLOR } : undefined} className={over ? '' : 'text-ink'}>{money(spent)}</strong>
        </span>
      </div>

      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-canvas" role="progressbar"
        aria-label={`${b.label} ${isGoal ? 'saved' : 'spent'}`}
        aria-valuenow={Math.min(Math.round(pct), 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, background: over ? OVER_COLOR : b.color }} />
      </div>

      {status && (
        <p className={`mt-1.5 text-xs ${over ? 'font-medium text-brand-dark' : 'text-muted'}`}>{status}</p>
      )}

      <ul className="mt-4 flex-1 divide-y divide-line">
        {items.length === 0 && (
          <li className="py-3 text-sm text-muted">{isGoal ? 'Nothing saved yet' : 'No transactions yet'}</li>
        )}
        {shown.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.description}</p>
              <p className="text-xs text-muted">{t.category}</p>
            </div>
            <div className="flex items-center gap-3 whitespace-nowrap">
              <span className="font-semibold">{money(t.amount)}</span>
              <button onClick={() => onEdit(t)} className="font-medium text-ink-soft hover:text-brand hover:underline">
                Edit
              </button>
              <button onClick={() => onDelete(t.id)} aria-label="Delete transaction"
                className="text-muted hover:text-brand-dark">✕</button>
            </div>
          </li>
        ))}
      </ul>

      {items.length > VISIBLE && (
        <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}
          className="mt-2 self-start rounded-md py-1 text-sm font-medium text-ink-soft hover:text-brand hover:underline">
          {expanded ? 'Show less' : `Show ${hiddenCount} more…`}
        </button>
      )}
    </div>
  );
}
