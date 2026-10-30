/**
 * End-to-end HTTP + real PostgreSQL authentication tests. ISOLATED STAGING DB ONLY.
 * Run explicitly: TESORIA_TEST_DATABASE_URL='postgresql://.../tesoria_test?sslmode=require' \
 *   TESORIA_TEST_CONFIRM='I_UNDERSTAND_THIS_USES_A_TEST_DB' npm run test:integration
 *
 * This test never contacts the public Tesoria site and only deletes its own test users.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { loginAttemptKey } from '../security.js';

const DB_URL = process.env.TESORIA_TEST_DATABASE_URL;
const REQUIRED_CONFIRMATION = 'I_UNDERSTAND_THIS_USES_A_TEST_DB';

function verifyIsolatedDatabase() {
  if (!DB_URL || process.env.TESORIA_TEST_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error('Set TESORIA_TEST_DATABASE_URL and TESORIA_TEST_CONFIRM=I_UNDERSTAND_THIS_USES_A_TEST_DB to run integration tests.');
  }
  const parsed = new URL(DB_URL);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Expected a PostgreSQL URL.');
  const dbName = decodeURIComponent(parsed.pathname.slice(1));
  if (!/(?:^|[_-])(test|staging)(?:$|[_-])/i.test(dbName)) {
    throw new Error('Database NAME must explicitly include _test or _staging, for example tesoria_test.');
  }
  if (DB_URL === process.env.DATABASE_URL || DB_URL === process.env.DATABASE_URL_POOLED) {
    throw new Error('Test database must not be identical to the configured application database.');
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Do not run test suite with NODE_ENV=production.');
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function sessionCookie(response) {
  const header = response.headers.get('set-cookie');
  assert.ok(header && header.startsWith('token='), 'Response should set authentication cookie');
  return header.split(';')[0];
}

function sidFromCookie(cookie) {
  const token = decodeURIComponent(cookie.substring('token='.length));
  const segments = token.split('.');
  assert.equal(segments.length, 3, 'Expected JWT cookie');
  return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')).sid;
}

async function http(base, method, route, { body, cookie, marker = true, origin = base, forwardedFor } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method)) {
    headers.Origin = origin;
    if (marker) headers['X-Tesoria-Request'] = '1';
  }
  if (cookie) headers.Cookie = cookie;
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;
  const res = await fetch(`${base}${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, res };
}

async function runServer(serverFile, base, dbUrl, jwtSecret) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tesoria-e2e-'));
  const server = spawn(process.execPath, [serverFile], {
    cwd: tempDir, // prevents accidental loading of a local production .env via dotenv/config
    env: {
      PATH: process.env.PATH || '', HOME: process.env.HOME || '',
      ...(process.env.NODE_EXTRA_CA_CERTS ? { NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS } : {}),
      NODE_ENV: 'development', PORT: String(new URL(base).port),
      SITE_URL: base, DATABASE_URL: dbUrl, JWT_SECRET: jwtSecret,
      BREVO_API_KEY: '', MAIL_FROM_EMAIL: '',
    },
    stdio: ['ignore', 'ignore', 'ignore'], // never print generated verification codes or secrets
  });
  try {
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error('Staging server exited before becoming ready. Check the test database TLS URL and DB permissions.');
      try {
        const res = await http(base, 'GET', '/api/me');
        if (res.status === 401) return { server, tempDir };
      } catch { /* server startup in progress */ }
      await delay(150);
    }
    throw new Error('Staging server did not become ready within 15 seconds.');
  } catch (err) {
    server.kill();
    await rm(tempDir, { recursive: true, force: true });
    throw err;
  }
}

async function stopServer(running) {
  if (!running) return;
  if (running.server.exitCode === null) {
    running.server.kill();
    await Promise.race([once(running.server, 'exit'), delay(2000)]);
  }
  await rm(running.tempDir, { recursive: true, force: true });
}

async function seedKnownCode(pool, email, purpose, code, secret) {
  const hash = crypto.createHmac('sha256', secret).update(`${email}:${purpose}:${code}`).digest('hex');
  await pool.query('DELETE FROM email_codes WHERE email = $1 AND purpose = $2', [email, purpose]);
  await pool.query(
    `INSERT INTO email_codes (email, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [email, purpose, hash]
  );
}

async function requireStatus(base, method, route, expected, options = {}) {
  const result = await http(base, method, route, options);
  assert.equal(result.status, expected, `${method} ${route}: expected ${expected}, got ${result.status}: ${JSON.stringify(result.data)}`);
  return result;
}

// Only opt-in tests can initialize or write database tables.
test('full authentication lifecycle on an explicitly approved isolated PostgreSQL database',
  { timeout: 120_000 }, async (t) => {
    verifyIsolatedDatabase();
    const [{ default: pg }, { default: bcrypt }] = await Promise.all([import('pg'), import('bcryptjs')]);
    const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: true }, max: 2 });
    const tokenSecret = crypto.randomBytes(48).toString('hex');
    const suffix = crypto.randomBytes(5).toString('hex');
    const emailA = `tesoria-e2e-${suffix}@example.test`;
    const emailB = `tesoria-e2e-alt-${suffix}@example.test`;
    const legacyEmail = `tesoria-e2e-old-${suffix}@example.test`;
    const usernameA = `test_${suffix}`;
    const usernameB = `alt_${suffix}`;
    const legacyUsername = `old_${suffix}`;
    const passwordA = 'my secure example passphrase 2026';
    const passwordANew = 'another excellent new passphrase 2026';
    const passwordB = 'blue river coffee yellow stone';
    const serverFile = fileURLToPath(new URL('../server.js', import.meta.url));
    const base = `http://127.0.0.1:${await freePort()}`;
    let running;
    const managedEmails = [emailA, emailB, legacyEmail];
    try {
      // A connection failure should stop immediately. No production URL is used.
      await pool.query('SELECT 1');
      running = await runServer(serverFile, base, DB_URL, tokenSecret);

      await t.test('new password requirements, registration, and email verification', async () => {
        await requireStatus(base, 'POST', '/api/auth/register', 400,
          { body: { username: usernameA, email: emailA, password: 'shortpass123' } });
        await requireStatus(base, 'POST', '/api/auth/register', 201,
          { body: { username: usernameA, email: emailA, password: passwordA } });
        await seedKnownCode(pool, emailA, 'verify', '123456', tokenSecret);
        const verify = await requireStatus(base, 'POST', '/api/auth/verify', 200,
          { body: { email: emailA, code: '123456' } });
        const verifiedCookie = sessionCookie(verify.res);
        await requireStatus(base, 'GET', '/api/me', 200, { cookie: verifiedCookie });
        await requireStatus(base, 'POST', '/api/auth/verify', 400,
          { body: { email: emailA, code: '123456' } });
      });

      let cookieA;
      let cookieB;
      let sidB;
      await t.test('two concurrent device sessions, CSRF defense, and per-device logout', async () => {
        const a = await requireStatus(base, 'POST', '/api/auth/login', 200,
          { body: { identifier: usernameA, password: passwordA, remember: false } });
        cookieA = sessionCookie(a.res);
        assert.ok(!/max-age=/i.test(a.res.headers.get('set-cookie')), 'Remember=false should not set a persistent cookie');
        const b = await requireStatus(base, 'POST', '/api/auth/login', 200,
          { body: { identifier: emailA, password: passwordA, remember: true } });
        cookieB = sessionCookie(b.res);
        sidB = sidFromCookie(cookieB);
        assert.ok(/max-age=/i.test(b.res.headers.get('set-cookie')), 'Remember=true should set a persistent cookie');
        assert.notEqual(sidFromCookie(cookieA), sidB);
        await requireStatus(base, 'GET', '/api/me', 200, { cookie: cookieA });
        await requireStatus(base, 'GET', '/api/me', 200, { cookie: cookieB });
        // Logout cannot be triggered via a cross-site form or a hostile Origin.
        await requireStatus(base, 'POST', '/api/auth/logout', 403, { cookie: cookieA, marker: false });
        await requireStatus(base, 'POST', '/api/auth/logout', 403,
          { cookie: cookieA, origin: 'https://attacker.invalid' });
        await requireStatus(base, 'GET', '/api/me', 200, { cookie: cookieA });
        await requireStatus(base, 'POST', '/api/auth/logout', 200, { cookie: cookieA });
        await requireStatus(base, 'GET', '/api/me', 401, { cookie: cookieA });
        await requireStatus(base, 'GET', '/api/me', 200, { cookie: cookieB });
        const { rows } = await pool.query('SELECT id FROM user_sessions WHERE id = $1', [sidFromCookie(cookieA)]);
        assert.equal(rows.length, 0, 'Revoked session must be absent from database');
      });

      await t.test('revocation survives restart; Remember Me reuses session', async () => {
        await stopServer(running);
        running = await runServer(serverFile, base, DB_URL, tokenSecret);
        await requireStatus(base, 'GET', '/api/me', 401, { cookie: cookieA });
        const initial = await pool.query('SELECT expires_at FROM user_sessions WHERE id = $1', [sidB]);
        assert.equal(initial.rowCount, 1);
        await delay(100);
        const me = await requireStatus(base, 'GET', '/api/me', 200, { cookie: cookieB });
        assert.equal(sidFromCookie(sessionCookie(me.res)), sidB);
        const newer = await pool.query('SELECT expires_at FROM user_sessions WHERE id = $1', [sidB]);
        assert.equal(newer.rowCount, 1);
        assert.ok(new Date(newer.rows[0].expires_at) >= new Date(initial.rows[0].expires_at));
      });

      await t.test('password reset invalidates all existing JWTs', async () => {
        await requireStatus(base, 'POST', '/api/auth/forgot', 200, { body: { email: emailA } });
        await seedKnownCode(pool, emailA, 'reset', '654321', tokenSecret);
        await requireStatus(base, 'POST', '/api/auth/reset', 400,
          { body: { email: emailA, code: '654321', password: 'too-short' } });
        await requireStatus(base, 'POST', '/api/auth/reset', 200,
          { body: { email: emailA, code: '654321', password: passwordANew } });
        await requireStatus(base, 'GET', '/api/me', 401, { cookie: cookieB });
        await requireStatus(base, 'POST', '/api/auth/login', 401,
          { body: { identifier: emailA, password: passwordA } });
        await requireStatus(base, 'POST', '/api/auth/login', 200,
          { body: { identifier: emailA, password: passwordANew } });
      });

      await t.test('legacy short password remains usable and another account can sign in', async () => {
        await requireStatus(base, 'POST', '/api/auth/register', 201,
          { body: { username: usernameB, email: emailB, password: passwordB } });
        await seedKnownCode(pool, emailB, 'verify', '324514', tokenSecret);
        await requireStatus(base, 'POST', '/api/auth/verify', 200,
          { body: { email: emailB, code: '324514' } });
        await requireStatus(base, 'POST', '/api/auth/login', 200,
          { body: { identifier: emailB, password: passwordB } });
        const hash = await bcrypt.hash('legacy1', 10);
        await pool.query('INSERT INTO users (username, email, email_verified, password_hash) VALUES ($1, $2, true, $3)',
          [legacyUsername, legacyEmail, hash]);
        await requireStatus(base, 'POST', '/api/auth/login', 200,
          { body: { identifier: legacyEmail, password: 'legacy1' } });
      });

      await t.test('account-level lockout combines email and username without affecting other accounts', async () => {
        // Reset the in-memory IP budget by restarting only the TEST server.
        await stopServer(running);
        running = await runServer(serverFile, base, DB_URL, tokenSecret);
        for (let i = 0; i < 10; i++) {
          await requireStatus(base, 'POST', '/api/auth/login', 401,
            { body: { identifier: i % 2 ? usernameA : emailA, password: 'wrong-password' },
              forwardedFor: `198.51.100.${i + 1}` });
        }
        const locked = await requireStatus(base, 'POST', '/api/auth/login', 429,
          { body: { identifier: emailA, password: passwordANew }, forwardedFor: '198.51.100.25' });
        assert.ok(Number(locked.res.headers.get('retry-after')) >= 1, 'Account lockout must provide Retry-After');
        await requireStatus(base, 'POST', '/api/auth/login', 200,
          { body: { identifier: emailB, password: passwordB } });
        const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [emailA]);
        const key = loginAttemptKey(emailA, rows[0].id, tokenSecret);
        await pool.query("UPDATE login_attempts SET window_started_at = now() - interval '16 minutes' WHERE identity_key = $1", [key]);
        await requireStatus(base, 'POST', '/api/auth/login', 200,
          { body: { identifier: usernameA, password: passwordANew } });
      });
    } finally {
      await stopServer(running);
      // Remove only the test users created by this run. Foreign-key cascades
      // clean their sessions and financial data automatically.
      try {
        const { rows } = await pool.query('SELECT id FROM users WHERE email = ANY($1::text[])', [managedEmails]);
        for (const u of rows) {
          await pool.query('DELETE FROM login_attempts WHERE identity_key = $1',
            [loginAttemptKey('', u.id, tokenSecret)]);
        }
        await pool.query('DELETE FROM email_codes WHERE email = ANY($1::text[])', [managedEmails]);
        await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [managedEmails]);
      } finally {
        await pool.end();
      }
    }
  });
