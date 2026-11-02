import { LEGAL_VERSION } from './client/src/legal.js';

export function publicLegalInfo(env) {
  return {
    registrationOpen: registrationIsOpen(env),
    version: LEGAL_VERSION,
    operator: env.LEGAL_OPERATOR_NAME?.trim() || '',
    country: env.LEGAL_OPERATOR_COUNTRY?.trim() || '',
    address: env.LEGAL_OPERATOR_ADDRESS?.trim() || '',
    email: env.PRIVACY_CONTACT_EMAIL?.trim() || '',
    operations: env.PRIVACY_OPERATIONS_NOTE?.trim() || '',
  };
}

export function registrationIsOpen(env) {
  return env.NODE_ENV !== 'production' || legalConfigurationErrors(env).length === 0;
}

export function requireRegistrationOpen(env) {
  return (_req, res, next) => {
    if (!registrationIsOpen(env)) {
      return res.status(503).json({ error: 'New registrations are temporarily unavailable. Existing users can still sign in. / Los nuevos registros están temporalmente suspendidos; las cuentas existentes pueden iniciar sesión.' });
    }
    next();
  };
}

export function legalConfigurationErrors(env) {
  const errors = [];
  for (const key of ['LEGAL_OPERATOR_NAME', 'LEGAL_OPERATOR_COUNTRY', 'LEGAL_OPERATOR_ADDRESS', 'PRIVACY_OPERATIONS_NOTE']) {
    if (!env[key]?.trim()) errors.push(`${key} is required for the public legal notices`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.PRIVACY_CONTACT_EMAIL || '')) {
    errors.push('PRIVACY_CONTACT_EMAIL must be a monitored public contact address');
  }
  return errors;
}
