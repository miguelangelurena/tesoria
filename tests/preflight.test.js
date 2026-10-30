import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentErrors } from '../scripts/preflight.mjs';

const good = {
  NODE_ENV: 'production',
  SITE_URL: 'https://tesoria.onrender.com',
  DATABASE_URL: 'postgresql://sample:fake@db.example.net/tesoria?sslmode=require',
  JWT_SECRET: 'a'.repeat(40),
  BREVO_API_KEY: 'test-placeholder-not-a-key',
  MAIL_FROM_EMAIL: 'mailer@example.com',
};
const check = (env, buildExists = true) => deploymentErrors(env, { buildExists, nodeVersion: '22.16.0' });

test('accepts plausible production environment without printing sensitive values', () => {
  assert.deepEqual(check(good), []);
});
test('requires critical settings and frontend bundle in production', () => {
  const errors = check({ NODE_ENV: 'production' }, false);
  for (const key of ['JWT_SECRET', 'BREVO_API_KEY', 'SITE_URL', 'DATABASE_URL', 'client/dist']) {
    assert.ok(errors.some(x => x.includes(key)), key);
  }
});
test('rejects non-HTTPS public URLs, invalid database TLS and short JWT secrets', () => {
  const invalid = { ...good, SITE_URL: 'http://example.com/',
    DATABASE_URL: 'postgres://user:pass@example.net/db?sslmode=disable', JWT_SECRET: 'short' };
  const errors = check(invalid);
  assert.equal(errors.length, 3);
  assert.ok(!JSON.stringify(errors).includes('pass@example.net'));
});
test('checks pooled URL first when configured', () => {
  const invalid = { ...good, DATABASE_URL_POOLED: 'postgres://user:pass@example.net/db?sslmode=disable' };
  assert.ok(check(invalid).some(x => x.includes('sslmode')));
});
test('development startup does not require deployment-only variables', () => {
  assert.deepEqual(check({ NODE_ENV: 'development' }, false), []);
});
