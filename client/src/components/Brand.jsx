// Logo: icon + TE$ORIA wordmark, with the "$" in green as in the brand
export default function Brand({ variant = 'light', className = '' }) {
  const text = variant === 'dark' ? 'text-white' : 'text-brand';
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src="/icon-192.png" alt="" className="h-9 w-9 shrink-0" />
      <span className={`text-lg font-medium tracking-[0.22em] ${text}`}>
        TE<span className="text-growth-light">$</span>ORIA
      </span>
    </div>
  );
}
