// Explicitly opt-in HTTP smoke tests for a separate HTTPS staging deployment.
// No account registration, transaction edits, bulk login attempts, or load tests.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stagingUrlFrom(value, confirmation) {
  if (confirmation !== 'I_CONFIRM_STAGING_ONLY') {
    throw new Error('Set TESORIA_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY');
  }
  if (!value) throw new Error('Set TESORIA_STAGING_URL to a dedicated staging HTTPS origin');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Invalid TESORIA_STAGING_URL'); }
  if (parsed.protocol !== 'https:') throw new Error('Staging URL must use HTTPS');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Supply the HTTPS origin only, without credentials, a path, a query or a fragment');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'tesoria.onrender.com' || host === 'www.tesoria.onrender.com') {
    throw new Error('Refusing to run on the published Tesoria production site');
  }
  // Naming the deployment distinguishes it from ordinary public services.
  if (!/(staging|preview|test|dev)/i.test(host)) {
    throw new Error('Staging hostname must contain staging, preview, test, or dev');
  }
  return parsed.origin;
}

export function tokenCookie(setCookie) {
  const value = typeof setCookie === 'string' ? setCookie : '';
  const pair = value.split(';', 1)[0];
  if (!/^token=[^;\s]+$/.test(pair)) throw new Error('Response did not set a token cookie');
  return pair;
}

export function cookieFlags(setCookie, remember) {
  const value = String(setCookie || '');
  const required = [/;\s*httponly(?:;|$)/i, /;\s*secure(?:;|$)/i, /;\s*samesite=lax(?:;|$)/i];
  if (!required.every(re => re.test(value))) return false;
  const persistent = /;\s*max-age=/i.test(value);
  return remember ? persistent : !persistent;
}

const jsonHeaders = { 'Content-Type': 'application/json', 'X-Tesoria-Request': '1' };

async function request(origin, endpoint, { method='GET', data, cookie, csrf=true, requestOrigin=origin }={}) {
  const headers = {};
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrf) headers['X-Tesoria-Request'] = jsonHeaders['X-Tesoria-Request'];
  if (method !== 'GET' && requestOrigin) headers.Origin = requestOrigin;
  if (cookie) headers.Cookie = cookie;
  return fetch(new URL(endpoint, origin), {
    method, headers,
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(75_000),
    redirect: 'manual',
  });
}

async function expectStatus(origin, endpoint, expected, opts, label) {
  const response = await request(origin, endpoint, opts);
  if (response.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, received HTTP ${response.status}`);
  }
  console.log(`PASS ${label} (${expected})`);
  return response;
}

async function main() {
  const origin = stagingUrlFrom(process.env.TESORIA_STAGING_URL, process.env.TESORIA_STAGING_CONFIRM);
  const username = process.env.TESORIA_STAGING_IDENTIFIER;
  const password = process.env.TESORIA_STAGING_PASSWORD;
  if (Boolean(username) !== Boolean(password)) {
    throw new Error('Provide BOTH TESORIA_STAGING_IDENTIFIER and TESORIA_STAGING_PASSWORD for the optional session test');
  }
  console.log(`Testing dedicated staging origin: ${origin}`);
  const home = await expectStatus(origin, '/', 200, {}, 'Homepage responds');
  const headerChecks = [
    ['Content Security Policy', 'content-security-policy', value => value.includes("default-src 'self'")],
    ['MIME sniffing prevention', 'x-content-type-options', value => value.toLowerCase() === 'nosniff'],
    ['HTTPS strict transport', 'strict-transport-security', value => value.toLowerCase().includes('max-age=')],
  ];
  for (const [label, name, check] of headerChecks) {
    const value = home.headers.get(name) || '';
    if (!check(value)) throw new Error(`${label}: header missing or unexpected`);
    console.log(`PASS ${label}`);
  }

  await expectStatus(origin, '/api/me', 401, {}, 'Unauthenticated /api/me is denied');
  await expectStatus(origin, '/api/summary', 401, {}, 'Unauthenticated summary is denied');
  await expectStatus(origin, '/api/export', 401, {}, 'Unauthenticated CSV is denied');
  await expectStatus(origin, '/api/auth/logout', 403, { method:'POST', csrf:false }, 'CSRF header required');
  await expectStatus(origin, '/api/auth/logout', 403,
    { method:'POST', requestOrigin:'https://untrusted.invalid' }, 'Foreign origin refused');
  await expectStatus(origin, '/api/auth/logout', 200,
    { method:'POST' }, 'Logout is idempotent without a session');

  if (!username) {
    console.log('SKIP login/logout lifecycle: no disposable staging-only credentials supplied');
    console.log('All public staging checks passed. Complete email verification manually using Brevo.');
    return;
  }

  let firstCookie;
  let secondCookie;
  try {
    const a = await expectStatus(origin, '/api/auth/login', 200,
      { method:'POST', data:{ identifier: username, password, remember:false } },
      'Login: browser-session cookie');
    const setA = a.headers.get('set-cookie');
    if (!cookieFlags(setA, false)) throw new Error('Non-persistent session lacks Secure/HttpOnly/SameSite or has Max-Age');
    firstCookie = tokenCookie(setA);
    console.log('PASS Short session cookie flags');

    const b = await expectStatus(origin, '/api/auth/login', 200,
      { method:'POST', data:{ identifier: username, password, remember:true } },
      'Login: remembered cookie');
    const setB = b.headers.get('set-cookie');
    if (!cookieFlags(setB, true)) throw new Error('Remember Me cookie lacks expected flags or Max-Age');
    secondCookie = tokenCookie(setB);
    if (firstCookie === secondCookie) throw new Error('Two logins returned the same token');
    console.log('PASS Remembered session cookie flags and distinct sessions');

    await expectStatus(origin, '/api/me', 200, { cookie:firstCookie }, 'Session A authorized');
    await expectStatus(origin, '/api/me', 200, { cookie:secondCookie }, 'Session B authorized');

    // Only revoke one of the two sessions. Does not touch any financial data.
    await expectStatus(origin, '/api/auth/logout', 200,
      { method:'POST', cookie:firstCookie }, 'Logout revokes session A');
    await expectStatus(origin, '/api/me', 401, { cookie:firstCookie }, 'Revoked session A refused');
    await expectStatus(origin, '/api/me', 200, { cookie:secondCookie }, 'Session B remains authorized');
  } finally {
    if (secondCookie) {
      try {
        await expectStatus(origin, '/api/auth/logout', 200,
          { method:'POST', cookie:secondCookie }, 'Logout revokes session B');
        await expectStatus(origin, '/api/me', 401, { cookie:secondCookie }, 'Revoked session B refused');
      } catch (err) { console.error(`Cleanup warning: ${err.message}`); }
    }
    if (firstCookie) {
      // Idempotent even when A was already revoked.
      try { await request(origin, '/api/auth/logout', { method:'POST', cookie:firstCookie }); } catch { /* best effort */ }
    }
  }
  console.log('PASS Staging security smoke checks completed');
}

const runningDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runningDirectly) {
  main().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
}
