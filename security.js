// Pure validation helpers: imported by the API and exercised by node:test.
import crypto from 'node:crypto';
const MAX_MONEY = 1_000_000_000; // Explicit ceiling prevents overflow/abuse.

export function parseMoney(value, { allowZero = false } = {}) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value).trim();
  // Decimal currency with at most two fractional digits (no Infinity/exponents).
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount > MAX_MONEY || amount < 0 || (!allowZero && amount === 0)) return null;
  return Math.round(amount * 100) / 100;
}

export function isAllowedMutation(method, origin, marker, allowedOrigins) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  // A custom header also blocks traditional CSRF via cross-origin HTML forms.
  if (marker !== '1') return false;
  // Browsers set Origin on state-changing requests; reject a mismatch.
  if (origin && !allowedOrigins.has(origin)) return false;
  return true;
}


// Single-factor password policy: NIST SP 800-63B-4 recommends at least 15
// Unicode characters. bcryptjs limits inputs to 72 UTF-8 bytes; reject larger
// values explicitly rather than allowing silent truncation. Do not trim or
// impose arbitrary character composition rules (spaces are valid).
export const MIN_PASSWORD_CHARS = 15;
export function passwordError(password) {
  if (typeof password !== 'string' || [...password].length < MIN_PASSWORD_CHARS) {
    return `Password must be at least ${MIN_PASSWORD_CHARS} characters`;
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must be at most 72 UTF-8 bytes (bcrypt limit)';
  }
  return null;
}

// An account's email and username resolve to the same user ID before applying
// the throttle. Unknown accounts still receive a pseudonymous throttle key.
export function loginAttemptKey(identifier, userId, secret) {
  const value = userId != null ? `user:${userId}` : `unknown:${identifier.toLowerCase()}`;
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function isValidSessionId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
