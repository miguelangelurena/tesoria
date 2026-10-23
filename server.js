import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
if (IS_PROD && (process.env.JWT_SECRET || '').length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

const MAX_MONTHS = 12;
const BUCKETS = ['needs', 'wants', 'savings'];
const BUCKET_LABELS = { needs: 'Needs', wants: 'Wants', savings: 'Savings & debt' };
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ID_RE = /^\d+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;
const CODE_TTL = '10 minutes';
const CODE_COOLDOWN_MS = 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// ---------- Email (Brevo HTTPS API) ----------
// Render blocks outbound SMTP on free instances, so email is sent over HTTPS instead.
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Tesoria';

// Error whose message can be shown to the user
function expose(message) {
  const e = new Error(message);
  e.expose = true;
  return e;
}

// Shared HTML template for verification and reset emails.
// Uses tables and inline styles so it renders the same in Gmail, Outlook and Apple Mail.
const SITE_URL = process.env.SITE_URL || 'https://tesoria.onrender.com';

function buildEmailHtml({ heading, intro, code, footerNote }) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f5f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#161f2b;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${heading}. Your code expires in 10 minutes.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e4e7ee;">
        <tr><td style="padding:28px 32px 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:10px;"><img src="${SITE_URL}/icon-192.png" width="32" height="32" alt="" style="display:block;border:0;"></td>
            <td style="vertical-align:middle;font-size:18px;letter-spacing:3px;font-weight:500;color:#f0392b;">TE<span style="color:#65eb62;">$</span>ORIA</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 32px 8px 32px;">
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:#161f2b;">${heading}</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#2b3646;">${intro}</p>
        </td></tr>
        <tr><td style="padding:20px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="center" style="background:#f5f6f9;border:1px solid #e4e7ee;border-radius:12px;padding:20px;">
              <span style="font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#161f2b;">${code}</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7385;">This code expires in <strong style="color:#161f2b;">10 minutes</strong>. Never share it with anyone, including Tesoria staff.</p>
          <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:#6b7385;">${footerNote}</p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0 0;font-size:12px;color:#6b7385;">&copy; Tesoria &middot; Coded by Miguel U.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendCode(email, code, purpose) {
  const isVerify = purpose === 'verify';
  const subject = isVerify ? 'Your Tesoria verification code' : 'Your Tesoria password reset code';
  const intro = isVerify ? 'Use this code to verify your account:' : 'Use this code to reset your password:';

  if (!BREVO_API_KEY || !MAIL_FROM_EMAIL) {
    if (IS_PROD) throw expose('Email is not configured on the server');
    // Development only: print the code in the terminal
    console.log(`[dev] ${purpose} code for ${email}: ${code}`);
    return;
  }

  let res;
  try {
    res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
        to: [{ email }],
        subject,
        textContent: `${intro}\n\n${code}\n\nThe code expires in 10 minutes. If you did not request it, you can ignore this email.`,
        htmlContent: buildEmailHtml({
          heading: isVerify ? 'Verify your email' : 'Reset your password',
          intro,
          code,
          footerNote: isVerify
            ? "If you didn't create a Tesoria account, you can safely ignore this email."
            : "If you didn't request a password reset, you can ignore this email. Your password will not change.",
        }),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error('Email request failed:', err.message);
    throw expose('We could not send the email. Please try again in a moment.');
  }

  if (!res.ok) {
    console.error('Brevo error:', res.status, await res.text().catch(() => ''));
    throw expose('We could not send the email. Please try again in a moment.');
  }
}

// ---------- Database schema ----------
async function initDb() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE`,
    // Existing accounts (created before email verification) stay verified
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true`,
    `CREATE TABLE IF NOT EXISTS months (
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      income NUMERIC NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, period)
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      bucket TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      description TEXT NOT NULL,
      amount NUMERIC NOT NULL CHECK (amount > 0)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tx_user_period ON transactions(user_id, period)`,
    // Bucket keys were Spanish in the first version; rename them to English (idempotent)
    `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_bucket_check`,
    `UPDATE transactions SET bucket = CASE bucket
       WHEN 'necesidades' THEN 'needs'
       WHEN 'deseos' THEN 'wants'
       WHEN 'ahorro' THEN 'savings'
       ELSE bucket END
     WHERE bucket IN ('necesidades', 'deseos', 'ahorro')`,
    `ALTER TABLE transactions ADD CONSTRAINT transactions_bucket_check CHECK (bucket IN ('needs', 'wants', 'savings'))`,
    `CREATE TABLE IF NOT EXISTS email_codes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes(email, purpose)`,
  ];
  for (const sql of statements) await pool.query(sql);
}

// ---------- 12-month retention window ----------
const pad = n => String(n).padStart(2, '0');
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function cutoffPeriod() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - (MAX_MONTHS - 1), 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function validPeriod(p) {
  return PERIOD_RE.test(p) && p >= cutoffPeriod() && p <= currentPeriod();
}
async function purgeOld() {
  const c = cutoffPeriod();
  await pool.query('DELETE FROM transactions WHERE period < $1', [c]);
  await pool.query('DELETE FROM months WHERE period < $1', [c]);
  await pool.query('DELETE FROM email_codes WHERE expires_at < now()');
  // Accounts that never verified their email after a day
  await pool.query(`DELETE FROM users WHERE email_verified = false AND created_at < now() - interval '1 day'`);
}

// ---------- One-time codes ----------
const hashCode = (email, purpose, code) =>
  crypto.createHmac('sha256', JWT_SECRET).update(`${email}:${purpose}:${code}`).digest('hex');

// Creates a 6-digit code and emails it. Returns false if one was sent less than a minute ago.
async function issueCode(email, purpose) {
  const { rows } = await pool.query(
    'SELECT created_at FROM email_codes WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1',
    [email, purpose]
  );
  if (rows[0] && Date.now() - new Date(rows[0].created_at).getTime() < CODE_COOLDOWN_MS) return false;

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query('DELETE FROM email_codes WHERE email = $1 AND purpose = $2', [email, purpose]);
  await pool.query(
    `INSERT INTO email_codes (email, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '${CODE_TTL}')`,
    [email, purpose, hashCode(email, purpose, code)]
  );
  await sendCode(email, code, purpose);
  return true;
}

// True only if the code matches the latest unexpired code. Wrong tries are counted.
async function checkCode(email, purpose, code) {
  const { rows } = await pool.query(
    `SELECT id, code_hash, attempts FROM email_codes
     WHERE email = $1 AND purpose = $2 AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose]
  );
  const row = rows[0];
  if (!row || row.attempts >= CODE_MAX_ATTEMPTS) return false;

  const ok = crypto.timingSafeEqual(
    Buffer.from(hashCode(email, purpose, code)),
    Buffer.from(row.code_hash)
  );
  if (ok) {
    await pool.query('DELETE FROM email_codes WHERE email = $1 AND purpose = $2', [email, purpose]);
  } else {
    await pool.query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
  }
  return ok;
}

// ---------- Input helpers ----------
const clean = v => String(v ?? '').trim();
// Removes control characters and angle brackets so stored text can never look like markup
const stripMarkup = s => s.replace(/[\u0000-\u001F\u007F<>]/g, '');

function parseTx(body) {
  const bucket = body.bucket;
  const description = stripMarkup(clean(body.description)).slice(0, 100);
  const category = stripMarkup(clean(body.category)).slice(0, 40) || 'General';
  const amount = Number(body.amount);
  if (!BUCKETS.includes(bucket) || !description || !(amount > 0)) return null;
  return { bucket, description, category, amount };
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render runs the app behind a proxy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Recharts sets inline styles
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'client', 'dist')));

function auth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies.token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Not authorized' });
  }
}

function periodParam(req, res, next) {
  if (!validPeriod(req.params.period)) {
    return res.status(400).json({ error: 'Month is out of range (last 12 months only)' });
  }
  next();
}

function idParam(req, res, next) {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
  next();
}

function sendToken(res, id, username) {
  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ username });
}

// ---------- Auth ----------
// Brute-force protection: at most 20 auth attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});
// Code spam protection: at most 10 code requests per hour per IP
const codeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many code requests. Try again later.' },
});
app.use('/api/auth', authLimiter);
app.use(['/api/auth/resend', '/api/auth/forgot'], codeLimiter);


// Creates an unverified account and emails a verification code
app.post('/api/auth/register', async (req, res) => {
  const username = clean(req.body.username).toLowerCase();
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Username: 3-30 characters (letters, numbers, . _ -)' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ error: 'Password must be at most 72 bytes' });

  const { rows: taken } = await pool.query(
    'SELECT 1 FROM users WHERE (email = $1 OR username = $2) AND email_verified = true',
    [email, username]
  );
  if (taken[0]) return res.status(409).json({ error: 'Username or email already in use' });

  // Replace unverified leftovers from an earlier attempt
  await pool.query(
    'DELETE FROM users WHERE email_verified = false AND (email = $1 OR username = $2)',
    [email, username]
  );

  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO users (username, email, email_verified, password_hash) VALUES ($1, $2, false, $3)',
      [username, email, hash]
    );
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already in use' });
    throw err;
  }

  await issueCode(email, 'verify');
  res.status(201).json({ needsVerification: true, email });
});

// Confirms the email and signs the user in
app.post('/api/auth/verify', async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const code = clean(req.body.code);
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'Enter the 6-digit code' });

  if (!(await checkCode(email, 'verify', code))) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }
  const { rows } = await pool.query(
    'UPDATE users SET email_verified = true WHERE email = $1 RETURNING id, username',
    [email]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired code' });
  sendToken(res, rows[0].id, rows[0].username);
});

app.post('/api/auth/resend', async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const { rows } = await pool.query(
    'SELECT 1 FROM users WHERE email = $1 AND email_verified = false',
    [email]
  );
  if (rows[0] && !(await issueCode(email, 'verify'))) {
    return res.status(429).json({ error: 'Please wait a minute before requesting another code' });
  }
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  const identifier = clean(req.body.identifier).toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query(
    'SELECT id, username, email, email_verified, password_hash FROM users WHERE email = $1 OR username = $1',
    [identifier]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.email_verified) {
    await issueCode(user.email, 'verify');
    return res.status(403).json({
      error: 'Verify your email first. We sent you a new code.',
      needsVerification: true,
      email: user.email,
    });
  }
  sendToken(res, user.id, user.username);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Always answers the same way, so it can't reveal which emails have accounts
app.post('/api/auth/forgot', async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const { rows } = await pool.query(
    'SELECT 1 FROM users WHERE email = $1 AND email_verified = true',
    [email]
  );
  if (rows[0]) await issueCode(email, 'reset');
  res.json({ ok: true });
});

app.post('/api/auth/reset', async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const code = clean(req.body.code);
  const password = String(req.body.password || '');

  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'Enter the 6-digit code' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ error: 'Password must be at most 72 bytes' });
  if (!(await checkCode(email, 'reset', code))) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2 AND email_verified = true', [hash, email]);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ username: req.user.username, minPeriod: cutoffPeriod(), maxPeriod: currentPeriod() });
});

// ---------- Budget data ----------

// Month: income + transactions
app.get('/api/months/:period', auth, periodParam, async (req, res) => {
  const { period } = req.params;
  const uid = req.user.id;
  const { rows: m } = await pool.query(
    'SELECT income::float8 AS income FROM months WHERE user_id = $1 AND period = $2',
    [uid, period]
  );
  const { rows: transactions } = await pool.query(
    `SELECT id::int AS id, bucket, description, category, amount::float8 AS amount
     FROM transactions WHERE user_id = $1 AND period = $2 ORDER BY id`,
    [uid, period]
  );
  res.json({ income: m[0]?.income ?? 0, transactions });
});

app.put('/api/months/:period/income', auth, periodParam, async (req, res) => {
  const income = Math.max(0, Number(req.body.income) || 0);
  await pool.query(
    `INSERT INTO months (user_id, period, income) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, period) DO UPDATE SET income = EXCLUDED.income`,
    [req.user.id, req.params.period, income]
  );
  res.json({ income });
});

app.post('/api/months/:period/transactions', auth, periodParam, async (req, res) => {
  const tx = parseTx(req.body);
  if (!tx) return res.status(400).json({ error: 'Invalid data' });
  const uid = req.user.id;
  await pool.query(
    'INSERT INTO months (user_id, period, income) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING',
    [uid, req.params.period]
  );
  await pool.query(
    `INSERT INTO transactions (user_id, period, bucket, description, category, amount)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uid, req.params.period, tx.bucket, tx.description, tx.category, tx.amount]
  );
  res.status(201).json({ ok: true });
});

// Edit a transaction (the month doesn't change)
app.put('/api/transactions/:id', auth, idParam, async (req, res) => {
  const tx = parseTx(req.body);
  if (!tx) return res.status(400).json({ error: 'Invalid data' });
  const { rowCount } = await pool.query(
    `UPDATE transactions SET bucket = $1, description = $2, category = $3, amount = $4
     WHERE id = $5 AND user_id = $6`,
    [tx.bucket, tx.description, tx.category, tx.amount, req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', auth, idParam, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ deleted: rowCount });
});

// Categories the user has used (for autocomplete)
app.get('/api/categories', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT category FROM transactions
     WHERE user_id = $1 AND period >= $2 ORDER BY category`,
    [req.user.id, cutoffPeriod()]
  );
  res.json({ categories: rows.map(r => r.category) });
});

// Last 12 months, used by the charts
app.get('/api/summary', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.period, m.income::float8 AS income,
       COALESCE(SUM(t.amount) FILTER (WHERE t.bucket = 'needs'), 0)::float8   AS needs,
       COALESCE(SUM(t.amount) FILTER (WHERE t.bucket = 'wants'), 0)::float8   AS wants,
       COALESCE(SUM(t.amount) FILTER (WHERE t.bucket = 'savings'), 0)::float8 AS savings
     FROM months m
     LEFT JOIN transactions t ON t.user_id = m.user_id AND t.period = m.period
     WHERE m.user_id = $1 AND m.period >= $2 AND m.period <= $3
     GROUP BY m.period, m.income
     ORDER BY m.period`,
    [req.user.id, cutoffPeriod(), currentPeriod()]
  );
  res.json({ months: rows });
});

// Export the last 12 months as CSV
const csvCell = v => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // prevents formula injection in Excel/Sheets
  return `"${s.replace(/"/g, '""')}"`;
};

app.get('/api/export', auth, async (req, res) => {
  const uid = req.user.id;
  const from = cutoffPeriod();
  const to = currentPeriod();
  const { rows: incomes } = await pool.query(
    `SELECT period, income::float8 AS income FROM months
     WHERE user_id = $1 AND period >= $2 AND period <= $3 ORDER BY period`,
    [uid, from, to]
  );
  const { rows: txs } = await pool.query(
    `SELECT period, bucket, category, description, amount::float8 AS amount FROM transactions
     WHERE user_id = $1 AND period >= $2 AND period <= $3 ORDER BY period, id`,
    [uid, from, to]
  );

  const lines = ['Month,Type,Bucket,Category,Description,Amount'];
  for (const m of incomes) {
    lines.push([m.period, 'income', '', '', '', m.income].map(csvCell).join(','));
  }
  for (const t of txs) {
    lines.push([t.period, 'expense', BUCKET_LABELS[t.bucket], t.category, t.description, t.amount].map(csvCell).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tesoria.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

// Catches errors from async route handlers (Express 5 forwards them here)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.expose ? err.message : 'Internal server error' });
});

// ---------- Startup ----------
async function start() {
  await initDb();
  await purgeOld();
  setInterval(() => purgeOld().catch(console.error), 24 * 60 * 60 * 1000);
  app.listen(PORT, () => console.log(`Tesoria running at http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
