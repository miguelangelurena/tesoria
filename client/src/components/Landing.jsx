import Brand from './Brand';
import Footer from './Footer';

// Simple line icons (stroke-based, inherit the brand color)
const ICONS = {
  rule: (
    <>
      <path d="M21 12A9 9 0 1 1 12 3v9h9Z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
};

const FEATURES = [
  {
    icon: 'rule',
    title: 'The 50/30/20 rule, built in',
    text: 'Your targets for needs, wants and savings update automatically as soon as you enter your income.',
  },
  {
    icon: 'chart',
    title: 'Charts that update live',
    text: 'Compare each month with your targets and follow your spending trends over the last 12 months.',
  },
  {
    icon: 'download',
    title: 'Export your data anytime',
    text: 'Download a CSV of your last 12 months and open it in Excel or Google Sheets.',
  },
];

const STEPS = [
  { title: 'Create your account', text: 'Sign up with your email and confirm it with a 6-digit code.' },
  { title: 'Enter your income', text: 'Add the money you earned this month and your budget targets appear.' },
  { title: 'Log your spending', text: 'Add each expense to needs, wants or savings and watch the charts fill in.' },
];

const BUTTON_PRIMARY =
  'shrink-0 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark sm:px-5';
const BUTTON_GHOST =
  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-ink/5 sm:px-4';

// Demo budget shown in the hero card (static, for illustration)
const DEMO = [
  { label: 'Needs', spent: 1350, target: 1500, color: '#2b4a6f' },
  { label: 'Wants', spent: 620, target: 900, color: '#ffa41b' },
  { label: 'Savings & debt', spent: 400, target: 600, color: '#22b455' },
];

export default function Landing({ onStart }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Brand variant="light" />
          <div className="hidden items-center gap-6 text-sm font-medium text-ink-soft md:flex">
            <a href="#features" className="hover:text-brand">Features</a>
            <a href="#how-it-works" className="hover:text-brand">How it works</a>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button type="button" onClick={() => onStart('login')} className={BUTTON_GHOST}>Sign in</button>
            <button type="button" onClick={() => onStart('register')} className={BUTTON_PRIMARY}>Get started</button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-dark">
              Simple budgeting
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Know where every dollar goes, <span className="text-brand">every month.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Tesoria splits your income with the 50/30/20 rule and shows your progress in
              real-time charts. No accounting knowledge needed.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={() => onStart('register')}
                className="rounded-lg bg-brand px-6 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:bg-brand-dark">
                Start for free
              </button>
              <button type="button" onClick={() => onStart('login')}
                className="rounded-lg border border-line bg-surface px-6 py-3 text-center text-base font-semibold text-ink transition hover:border-ink/30">
                I already have an account
              </button>
            </div>
            <p className="mt-4 text-sm text-muted">Free. Your data is kept for 12 months.</p>
          </div>

          {/* Demo card */}
          <div className="rounded-2xl bg-surface p-6 shadow-xl ring-1 ring-line">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">This month</p>
              <p className="text-sm text-muted">Income <span className="font-semibold text-ink">$3,000.00</span></p>
            </div>
            <div className="mt-6 space-y-5">
              {DEMO.map((d) => {
                const pct = Math.round((d.spent / d.target) * 100);
                return (
                  <div key={d.label}>
                    <div className="mb-1.5 flex justify-between gap-2 text-sm">
                      <span className="font-medium" style={{ color: d.color }}>{d.label}</span>
                      <span className="text-muted">${d.spent.toLocaleString('en-US')} / ${d.target.toLocaleString('en-US')}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 rounded-lg bg-growth/10 px-4 py-3 text-sm text-ink-soft">
              You have <span className="font-semibold text-growth">$630.00</span> left to save or spend.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Everything you need, nothing you don't</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl bg-canvas p-6 ring-1 ring-line">
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand-dark">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICONS[f.icon]}
                    </svg>
                  </span>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing call to action */}
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-2xl bg-ink px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-2xl font-bold sm:text-3xl">Start your first budget today</h2>
            <p className="mx-auto mt-3 max-w-lg text-white/70">
              Create an account in under a minute and see your 50/30/20 plan for this month.
            </p>
            <button type="button" onClick={() => onStart('register')}
              className="mt-8 rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-dark">
              Create free account
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
