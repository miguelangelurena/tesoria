import { LEGAL_VERSION } from './client/src/legal.js';

export function publicLegalInfo(env) {
  return {
    version: LEGAL_VERSION,
    operator: env.LEGAL_OPERATOR_NAME?.trim() || '',
    country: env.LEGAL_OPERATOR_COUNTRY?.trim() || '',
    address: env.LEGAL_OPERATOR_ADDRESS?.trim() || '',
    email: env.PRIVACY_CONTACT_EMAIL?.trim() || '',
    operations: env.PRIVACY_OPERATIONS_NOTE?.trim() || '',
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
