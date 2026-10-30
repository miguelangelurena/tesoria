import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingUrlFrom, tokenCookie, cookieFlags } from '../scripts/staging-smoke.mjs';

test('staging safety gate refuses public Tesoria and ambiguous targets', () => {
  const yes = 'I_CONFIRM_STAGING_ONLY';
  assert.equal(stagingUrlFrom('https://tesoria-staging.onrender.com', yes), 'https://tesoria-staging.onrender.com');
  assert.equal(stagingUrlFrom('https://preview-tesoria.example.com', yes), 'https://preview-tesoria.example.com');
  for (const [url, confirm] of [
    [undefined, yes],
    ['https://tesoria.onrender.com', yes],
    ['https://tesoria.onrender.com', ''],
    ['https://tesoria-staging.onrender.com', ''],
    ['http://tesoria-staging.onrender.com', yes],
    ['https://example.com', yes],
    ['https://tesoria-staging.onrender.com/hello', yes],
    ['https://username:password@tesoria-staging.onrender.com', yes],
  ]) assert.throws(() => stagingUrlFrom(url, confirm));
});

test('cookie extractor reads token only and never logs it', () => {
  assert.equal(tokenCookie('token=abc.123; HttpOnly; Secure; SameSite=Lax'), 'token=abc.123');
  assert.throws(() => tokenCookie('something=abc; HttpOnly'));
  assert.throws(() => tokenCookie(''));
});

test('cookie policy expects HttpOnly Secure and SameSite and correct persistence', () => {
  const session = 'token=a.b.c; Path=/; HttpOnly; SameSite=Lax; Secure';
  const remember = `${session}; Max-Age=2592000`;
  assert.equal(cookieFlags(session, false), true);
  assert.equal(cookieFlags(remember, true), true);
  assert.equal(cookieFlags(session, true), false);
  assert.equal(cookieFlags(remember, false), false);
  assert.equal(cookieFlags('token=a.b.c; SameSite=Lax; Secure', false), false);
  assert.equal(cookieFlags('token=a.b.c; SameSite=Lax; HttpOnly', false), false);
});
