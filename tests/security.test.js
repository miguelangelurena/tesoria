import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, isAllowedMutation } from '../security.js';

test('money amounts accept valid inputs and disallow malformed or extreme values', () => {
  assert.equal(parseMoney('25.99'), 25.99);
  assert.equal(parseMoney(3000), 3000);
  assert.equal(parseMoney('0'), null);
  assert.equal(parseMoney('0', { allowZero: true }), 0);
  for (const input of ['Infinity', Infinity, 'NaN', -1, '-1', '2.999', '1e308', 1e308, {}, null, '1000000001']) {
    assert.equal(parseMoney(input), null, `should reject ${String(input)}`);
  }
});

test('CSRF guard allows reads, blocks form posts and untrusted origins', () => {
  const allowed = new Set(['https://tesoria.onrender.com']);
  assert.equal(isAllowedMutation('GET', 'https://evil.example', null, allowed), true);
  assert.equal(isAllowedMutation('POST', 'https://tesoria.onrender.com', null, allowed), false);
  assert.equal(isAllowedMutation('DELETE', 'https://evil.example', '1', allowed), false);
  assert.equal(isAllowedMutation('POST', 'https://tesoria.onrender.com', '1', allowed), true);
  assert.equal(isAllowedMutation('PUT', undefined, '1', allowed), true);
});

import { passwordError, MIN_PASSWORD_CHARS, loginAttemptKey, isValidSessionId } from '../security.js';
import crypto from 'node:crypto';

test('new and reset passwords require at least 15 Unicode characters', () => {
  assert.equal(MIN_PASSWORD_CHARS, 15);
  assert.match(passwordError('shortpassword'), /15 characters/);
  assert.match(passwordError('🔐'.repeat(14)), /15 characters/);
  assert.equal(passwordError('correct horse battery staple'), null);
  assert.equal(passwordError('sixteen char pass'), null);
  assert.equal(passwordError(' spaces are okay! '), null);
  assert.equal(passwordError('a'.repeat(72)), null);
  assert.match(passwordError('a'.repeat(73)), /72 UTF-8 bytes/);
  assert.match(passwordError('🔐'.repeat(19)), /72 UTF-8 bytes/);
  assert.match(passwordError(null), /15 characters/);
});

test('login throttling key is pseudonymous, stable and account-scoped', () => {
  const secret = 'a secure secret used for signing';
  const keyByEmail = loginAttemptKey('me@example.com', 42, secret);
  const keyByUsername = loginAttemptKey('myname', 42, secret);
  assert.equal(keyByEmail, keyByUsername, 'email and username for one user should share a limit');
  assert.notEqual(loginAttemptKey('me@example.com', 43, secret), keyByEmail);
  assert.equal(loginAttemptKey('Me@Example.Com', undefined, secret), loginAttemptKey('me@example.com', undefined, secret));
  assert.notEqual(loginAttemptKey('other@example.com', undefined, secret), loginAttemptKey('me@example.com', undefined, secret));
  assert.equal(keyByEmail.length, 64);
  assert.doesNotMatch(keyByEmail, /@|example|42/);
});

test('only random version-4 UUID session IDs are accepted', () => {
  const id = crypto.randomUUID();
  assert.equal(isValidSessionId(id), true);
  assert.equal(isValidSessionId(undefined), false);
  assert.equal(isValidSessionId('old-jwt-without-session'), false);
  assert.equal(isValidSessionId('00000000-0000-0000-0000-000000000000'), false);
});
