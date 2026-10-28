// Budget buckets, following the 50/30/20 rule
// type: 'limit' = a spending cap (going over is bad)
//       'goal'  = an amount to reach (meeting or exceeding it is good)
export const BUCKETS = {
  needs: { label: 'Needs', pct: 50, color: '#2b4a6f', type: 'limit', hint: 'Rent, groceries, bills' },
  wants: { label: 'Wants', pct: 30, color: '#ffa41b', type: 'limit', hint: 'Dining out, fun, shopping' },
  savings: { label: 'Savings & debt', pct: 20, color: '#22b455', type: 'goal', hint: 'Savings and extra debt payments' },
};

export const KEYS = Object.keys(BUCKETS);

export const OVER_COLOR = '#c80f14';

// Colors for category slices in the pie chart
export const PALETTE = [
  '#2b4a6f', '#ffa41b', '#f0392b', '#22b455', '#65eb62',
  '#7c5cff', '#14b8c4', '#f472b6', '#84cc16', '#94a3b8',
];

const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// Formats a number as currency, e.g. $1,234.50
export const money = (n) => '$' + fmt.format(Number(n) || 0);
// Shorter version for chart axes, e.g. $1.2K
export const moneyShort = (n) => '$' + compact.format(Number(n) || 0);

// "2026-09" -> "September 2026"
export const monthLabel = (period) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
