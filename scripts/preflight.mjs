// Checks production configuration before the API starts; never logs secret values.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function deploymentErrors(env, { buildExists = existsSync(resolve('client/dist/index.html')), nodeVersion = process.versions.node } = {}) {
  if (env.NODE_ENV !== 'production') return [];
  const errors = [];
  const has = key => typeof env[key] === 'string' && env[key].trim() !== '';
  const add = (condition, description) => { if (!condition) errors.push(description); };

  const [major, minor] = nodeVersion.split('.').map(Number);
  add(major > 22 || (major === 22 && minor >= 12), 'Node.js must be >=22.12; set NODE_VERSION=22 on Render');
  add(has('JWT_SECRET') && env.JWT_SECRET.length >= 32, 'JWT_SECRET must contain at least 32 characters');
  add(has('BREVO_API_KEY'), 'BREVO_API_KEY is required for email verification');
  add(has('MAIL_FROM_EMAIL') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.MAIL_FROM_EMAIL),
    'MAIL_FROM_EMAIL must be a verified sender address');
  add(buildExists, 'Missing client/dist/index.html: run npm run build before start');

  try {
    const url = new URL(env.SITE_URL);
    add(url.protocol === 'https:' && url.origin === env.SITE_URL && !url.username && !url.password,
      'SITE_URL must be the exact HTTPS origin, without a trailing slash');
  } catch {
    errors.push('SITE_URL must be the exact HTTPS origin');
  }

  // DATABASE_URL_POOLED overrides DATABASE_URL inside the API. Check the effective value.
  const connection = env.DATABASE_URL_POOLED || env.DATABASE_URL;
  if (!connection) {
    errors.push('DATABASE_URL or DATABASE_URL_POOLED is required');
  } else {
    try {
      const url = new URL(connection);
      add(['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname) && Boolean(url.username),
        'Database connection must be a PostgreSQL URL');
      add(['require', 'verify-full'].includes(url.searchParams.get('sslmode')) &&
          !url.searchParams.has('ssl') && !url.searchParams.has('uselibpqcompat'),
        'Database URL must use sslmode=require or sslmode=verify-full');
    } catch {
      errors.push('Database connection must be a valid PostgreSQL URL');
    }
  }
  return errors;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const errors = deploymentErrors(process.env);
  if (errors.length) {
    console.error('Production preflight FAILED (only variable names/reasons shown):');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(process.env.NODE_ENV === 'production' ? 'Production preflight passed' : 'Development startup');
  }
}
