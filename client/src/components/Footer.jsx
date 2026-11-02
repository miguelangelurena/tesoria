// Minimal footer shared by the landing page, sign-in and the dashboard
export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface py-5">
      <nav aria-label="Legal" className="mb-2 flex justify-center gap-5 text-xs text-ink-soft">
        <a href="/privacy" className="underline">Privacy / Privacidad</a>
        <a href="/terms" className="underline">Terms / Condiciones</a>
        <a href="/THIRD_PARTY_NOTICES.txt" className="underline">Software licenses</a>
      </nav>
      <p className="mx-auto mb-2 max-w-xl px-4 text-center text-xs text-muted">50/30/20 is a general budgeting guideline; results depend on your circumstances. / Es una guía general de presupuesto; los resultados dependen de tu situación.</p>
      <p className="text-center text-xs tracking-wide text-muted">Coded by Miguel U.</p>
    </footer>
  );
}
