import { useEffect, useState } from 'react';
import { api } from '../api';
import { LEGAL_VERSION } from '../legal';
import Footer from './Footer';
import LegalSpanish from './LegalSpanish';

export default function LegalPage({ terms = false }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('es');
  const spanish = language === 'es';
  useEffect(() => {
    let active = true;
    api.legal().then((data) => { if (active) setDetails(data); })
      .catch(() => { if (active) setError('Service details could not be loaded. Please reload this page.'); });
    return () => { active = false; };
  }, []);
  return (
    <div className="flex min-h-dvh flex-col">
      <main lang={language} className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-5 py-10 text-sm leading-relaxed">
        <a className="text-brand underline" href="/">{spanish ? 'Volver a Tesoria' : 'Back to Tesoria'}</a>
        <label className="block">Idioma / Language: <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded border border-line bg-surface p-2"><option value="es">Español</option><option value="en">English</option></select></label>
        <h1 className="text-3xl font-bold">{spanish ? (terms ? 'Condiciones de uso' : 'Aviso de privacidad') : (terms ? 'Terms of use' : 'Privacy notice')}</h1>
        <p>{spanish ? 'Versión' : 'Version'}: {LEGAL_VERSION}</p>
        {error && <p role="alert">{error}</p>}
        {!details && !error && <p role="status">Cargando datos del responsable / Loading service details...</p>}
        {details && <>
          <h2 className="text-lg font-semibold">{spanish ? 'Responsable y contacto' : 'Service operator and contact'}</h2>
          <p>{details.operator || 'Responsable pendiente de configurar / Operator details pending.'}{details.country && ` — ${details.country}`}</p>
          <p>{details.address || 'Domicilio pendiente / Address pending.'}</p>
          <p>{details.email ? <>{spanish ? 'Para solicitudes de privacidad, rectificación, reclamaciones y consultas: ' : 'For privacy requests, corrections, complaints or service questions: '}<a className="text-brand underline" href={`mailto:${details.email}`}>{details.email}</a>.</> : 'Contacto pendiente. No envíes datos personales hasta que esté disponible. / Contact pending; do not submit personal data yet.'}</p>
        </>}
        {spanish ? <LegalSpanish terms={terms} operations={details?.operations} /> : terms ? <>
          <h2 className="text-lg font-semibold">Personal budgeting tool</h2>
          <p>Tesoria helps you record income and expenses you enter manually. It does not connect to bank accounts, hold money or execute payments. The 50/30/20 split is a general budgeting guideline; it may not suit your circumstances. Tesoria does not provide personalized investment, tax or legal advice and does not promise savings or financial results.</p>
          <h2 className="text-lg font-semibold">Using your account</h2>
          <p>Use an email address you control, protect your password and verification codes, and enter only information you are entitled to use. Do not upload bank credentials, payment card numbers or unnecessary sensitive information. Do not use the service unlawfully, access another person's account or disrupt the service.</p>
          <h2 className="text-lg font-semibold">Cost, availability and records</h2>
          <p>The current service is free and does not request a payment card. There is no guarantee of uninterrupted availability or financial accuracy. Check your entries and calculations before relying on them. Keep separate copies of important records. Budget data is limited to the current calendar month and the preceding eleven months; older entries are deleted by a daily cleanup. Export regularly before they leave this window.</p>
          <h2 className="text-lg font-semibold">Leaving and changes</h2>
          <p>You can export your budget as CSV, download your account and stored budget data as JSON, and delete your account from Account. Deletion from the active database cannot be undone. See the Privacy notice for provider copies, logs and backups. Material changes to these terms must be communicated before they take effect; a version date alone does not replace that notification.</p>
          <h2 className="text-lg font-semibold">Your legal rights</h2>
          <p>These terms do not exclude mandatory consumer or data protection rights, or any liability that applicable law does not allow to be excluded. Contact the operator about problems with the service.</p>
        </> : <>
          <h2 className="text-lg font-semibold">Information and purposes</h2>
          <p>Tesoria stores your username, email, password hash, verification status, account creation date, and the version and time of terms acceptance and data-processing authorization for new registrations. It stores the income, expenses, categories and descriptions you enter to display your budget and exports. Password hashes, verification code hashes, session records and temporary login attempt counters support authentication and abuse prevention. Requests also expose connection information such as IP address to the hosting provider and the application's rate limiter.</p>
          <h2 className="text-lg font-semibold">Cookies and this device</h2>
          <p>A necessary, HTTP-only session cookie signs you in. With “Keep me signed in”, its 30-day lifetime renews when you visit; otherwise it is a browser-session cookie with a server-side expiry. When you choose to stay signed in at login, the username or email is also saved in this browser's local storage to prefill the form. You can clear it in the sign-in form or browser settings. This application code does not include advertising cookies or analytics scripts.</p>
          <h2 className="text-lg font-semibold">Service providers and security</h2>
          <p>The deployment documented in this project uses Render for hosting, Neon/PostgreSQL for storage and Brevo for verification and password-reset emails. Email delivery also involves your email provider. Hosting and email providers may process request logs and delivery metadata. The application uses password hashing, HTTPS in production, session controls and access restrictions; no system can guarantee absolute security.</p>
          {details?.operations && <p className="whitespace-pre-wrap">{details.operations}</p>}
          <h2 className="text-lg font-semibold">Retention and deletion</h2>
          <p>Budget entries cover the current calendar month and eleven preceding months; a daily cleanup deletes older entries. Verified account details remain until the account is deleted. Unverified accounts older than one day are removed during cleanup. Verification and reset codes expire after ten minutes; expired code records, expired sessions and login counters older than a day are cleaned up daily. Remembered sign-ins can continue to renew for as long as you use them.</p>
          <p>Deleting your account removes the account, budget entries, sessions, associated email codes and account-specific login counter from the active application database. It does not recall emails already delivered or remove copies you exported. Provider logs and backups have separate retention and deletion processes described in the operator's service details above. Ask the operator about those copies before entering information if that description is missing.</p>
          <h2 className="text-lg font-semibold">Access, correction and requests</h2>
          <p>Account provides a JSON download of your account details and stored budget records and allows account deletion with your current password. You can change your username there and edit or delete budget entries in the dashboard. For email corrections, additional access requests, objections, restrictions, withdrawal of data-processing authorization or other privacy concerns, contact the operator above. Withdrawal may prevent continuing the service that needs those data. Additional rights and access to a supervisory authority depend on the laws that apply to you. Identity checks may be needed to protect your information.</p>
        </>}
      </main>
      <Footer />
    </div>
  );
}
