// Placeholder shown while a month is loading. Blocks appear one after another, top to bottom
// (the --step variable feeds the animation delay in index.css), then shimmer until the data arrives.
const CARD = 'rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line';

const Bar = ({ className = '' }) => <div className={`skeleton-bar ${className}`} />;
const Step = ({ n, className = '', children }) => (
  <div className={`skeleton-step ${className}`} style={{ '--step': n }}>{children}</div>
);

function StatSkeleton({ step }) {
  return (
    <Step n={step} className={CARD}>
      <Bar className="h-4 w-24" />
      <Bar className="mt-3 h-8 w-36" />
      <Bar className="mt-3 h-3 w-40" />
    </Step>
  );
}

function BucketSkeleton({ step }) {
  return (
    <Step n={step} className={`${CARD} flex flex-col`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Bar className="h-5 w-24" />
          <Bar className="h-3 w-36" />
        </div>
        <Bar className="h-5 w-16 rounded-full" />
      </div>
      <Bar className="mt-5 h-4 w-full" />
      <Bar className="mt-3 h-2.5 w-full rounded-full" />
      <div className="mt-5 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-3/4" />
              <Bar className="h-3 w-1/3" />
            </div>
            <Bar className="h-4 w-14" />
          </div>
        ))}
      </div>
    </Step>
  );
}

export default function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your budget" className="space-y-5 sm:space-y-6">
      <span className="sr-only">Loading your budget…</span>

      <section className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        <StatSkeleton step={0} />
        <StatSkeleton step={1} />
        <StatSkeleton step={2} />
      </section>

      <Step n={3} className={`${CARD} sm:p-6`}>
        <Bar className="h-5 w-40" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1fr_1fr_auto]">
          {[0, 1, 2, 3].map((i) => <Bar key={i} className="h-10 w-full" />)}
          <Bar className="h-10 w-full lg:w-20" />
        </div>
      </Step>

      <div className="grid gap-5 md:grid-cols-3">
        <BucketSkeleton step={4} />
        <BucketSkeleton step={5} />
        <BucketSkeleton step={6} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Step n={7} className={CARD}>
          <Bar className="h-5 w-32" />
          <Bar className="mt-4 h-56 w-full" />
        </Step>
        <Step n={8} className={CARD}>
          <Bar className="h-5 w-32" />
          <Bar className="mt-4 h-56 w-full" />
        </Step>
      </div>
    </div>
  );
}
