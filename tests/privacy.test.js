import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import { registerPrivacyRoutes } from '../privacy.js';
import { publicLegalInfo } from '../legal-config.js';

async function fixture(t, { failure = false } = {}) {
  const queries = [];
  let released = false;
  const passwordHash = await bcrypt.hash('correct password for deletion', 4);
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (failure && sql.startsWith('DELETE FROM users')) throw new Error('test database failure');
      if (sql.includes('SELECT email, password_hash')) return { rows: [{ email: 'owner@example.test', password_hash: passwordHash }] };
      if (sql.includes('SELECT username, email')) return { rows: [{ username: 'owner', email: 'owner@example.test' }] };
      if (sql.includes('SELECT period, income')) return { rows: [{ period: '2026-11', income: '100.00' }] };
      return { rows: [], rowCount: 1 };
    },
    release() { released = true; },
  };
  const app = express();
  app.use(express.json());
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  registerPrivacyRoutes(app, {
    pool: { connect: async () => client }, secret: 'test-secret', isProduction: true,
    auth: (req, res, next) => {
      if (req.get('Authorization') !== 'test-owner') return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: '42' }; next();
    },
    limiter: (_req, _res, next) => next(),
  });
  app.use((_err, _req, res, _next) => res.status(500).json({ error: 'Internal server error' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const request = async (method, route, body, authorized = true) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'test-owner' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { request, queries, released: () => released };
}

test('personal export requires authentication and excludes credentials', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('GET', '/api/me/data', undefined, false)).status, 401);
  assert.equal(f.queries.length, 0);
  const res = await f.request('GET', '/api/me/data');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-disposition'), /attachment/);
  const data = await res.json();
  assert.equal(data.account.email, 'owner@example.test');
  assert.deepEqual(data.months, [{ period: '2026-11', income: '100.00' }]);
  for (const query of f.queries.filter((q) => q.sql.startsWith('SELECT'))) {
    assert.deepEqual(query.params, ['42']);
    assert.doesNotMatch(query.sql, /password_hash|code_hash|user_sessions/);
  }
  assert.ok(f.released());
});

test('deletion rejects missing confirmation, incorrect password and unauthenticated requests', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request('DELETE', '/api/me', {}, false)).status, 401);
  assert.equal((await f.request('DELETE', '/api/me', { password: 'correct password for deletion' })).status, 400);
  assert.equal(f.queries.length, 0);
  assert.equal((await f.request('DELETE', '/api/me', { password: 'incorrect', confirmation: 'DELETE' })).status, 403);
  assert.ok(f.queries.some((q) => q.sql === 'ROLLBACK'));
  assert.ok(!f.queries.some((q) => q.sql.startsWith('DELETE')));
  assert.ok(f.released());
});

test('deletion removes only the authenticated account and clears the secure cookie after commit', async (t) => {
  const f = await fixture(t);
  const res = await f.request('DELETE', '/api/me', { password: 'correct password for deletion', confirmation: 'DELETE', userId: '99' });
  assert.equal(res.status, 200);
  const deletes = f.queries.filter((q) => q.sql.startsWith('DELETE'));
  assert.equal(deletes.length, 3);
  assert.deepEqual(deletes.find((q) => q.sql.startsWith('DELETE FROM users')).params, ['42']);
  assert.deepEqual(deletes.find((q) => q.sql.startsWith('DELETE FROM email_codes')).params, ['owner@example.test']);
  assert.equal(f.queries.at(-1).sql, 'COMMIT');
  assert.match(res.headers.get('set-cookie'), /token=;.*HttpOnly; Secure; SameSite=Lax/);
  assert.ok(f.released());
});

test('database failure rolls deletion back without claiming success or clearing cookie', async (t) => {
  const f = await fixture(t, { failure: true });
  const res = await f.request('DELETE', '/api/me', { password: 'correct password for deletion', confirmation: 'DELETE' });
  assert.equal(res.status, 500);
  assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(res.headers.get('set-cookie'), null);
  assert.ok(f.released());
});

test('public legal details expose an explicit allowlist and never environment secrets', () => {
  const details = publicLegalInfo({ LEGAL_OPERATOR_NAME: ' Operator ', JWT_SECRET: 'must-stay-private', DATABASE_URL: 'private' });
  assert.equal(details.operator, 'Operator');
  assert.equal(details.email, '');
  assert.ok(!JSON.stringify(details).includes('private'));
  assert.deepEqual(Object.keys(details).sort(), ['address', 'country', 'email', 'operations', 'operator', 'version']);
});
