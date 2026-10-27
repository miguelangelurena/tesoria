const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Moves a "YYYY-MM" string by a number of months
function shift(period, delta) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function label(period) {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// Month switcher with arrows, limited to the 12-month window
export default function MonthPicker({ value, min, max, onChange }) {
  const btn =
    "cursor-pointer grid h-8 w-8 place-items-center rounded-lg text-lg text-white transition hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 p-1">
      <button
        type="button"
        aria-label="Previous month"
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(shift(value, -1))}
      >
        ‹
      </button>
      <span
        className="min-w-[9.5rem] select-none text-center text-sm font-medium text-white"
        aria-live="polite"
      >
        {label(value)}
      </span>
      <button
        type="button"
        aria-label="Next month"
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(shift(value, 1))}
      >
        ›
      </button>
      {value !== max && (
        <button
          type="button"
          onClick={() => onChange(max)}
          className="cursor-pointer ml-1 rounded-lg px-2 py-1 text-xs font-medium text-growth-light transition hover:bg-white/10"
        >
          Today
        </button>
      )}
    </div>
  );
}
