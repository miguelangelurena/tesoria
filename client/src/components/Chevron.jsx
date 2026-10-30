// Small arrow for collapsible sections: points down when closed, up when open
export default function Chevron({ open, className = '' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${className}`}
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}
