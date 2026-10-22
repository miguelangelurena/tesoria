// Logo: icon + TE$ORIA wordmark, with the "$" in green as in the brand.
// Sizes shrink on small screens so it fits next to the buttons.
export default function Brand({ variant = 'light', className = '' }) {
  const text = variant === 'dark' ? 'text-white' : 'text-brand';
  return (
    <div className={`flex shrink-0 items-center gap-2 sm:gap-2.5 ${className}`}>
      <img src="/icon-192.png" alt="" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
      <span className={`text-base font-medium tracking-[0.16em] sm:text-lg sm:tracking-[0.22em] ${text}`}>
        TE<span className="text-growth-light">$</span>ORIA
      </span>
    </div>
  );
}
