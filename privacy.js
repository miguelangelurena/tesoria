import bcrypt from 'bcryptjs';
import { loginAttemptKey } from './security.js';

// Mounted after the application's origin/header protection. Authentication and
// password-attempt limiting are injected so these routes share existing policy.
export function registerPrivacyRoutes(app, { pool, auth, limiter, secret, isProduction }) {
  app.get('/api/me/data', auth, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const { rows: users } = await client.query(
        `SELECT username, email, email_verified, created_at, legal_version, legal_accepted_at, privacy_consented_at
         FROM users WHERE id = $1`, [req.user.id]);
      const { rows: months } = await client.query(
        'SELECT period, income FROM months WHERE user_id = $1 ORDER BY period', [req.user.id]);
      const { rows: transactions } = await client.query(
        `SELECT period, bucket, category, description, amount FROM transactions
         WHERE user_id = $1 ORDER BY period, id`, [req.user.id]);
      await client.query('COMMIT');
      res.set('Content-Disposition', 'attachment; filename="tesoria-personal-data.json"');
      // Credentials, code hashes, and session tokens are deliberately excluded.
      res.json({ exportedAt: new Date().toISOString(), account: users[0], months, transactions });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally { client.release(); }
  });

  app.delete('/api/me', limiter, auth, async (req, res) => {
    const password = req.body?.password;
    if (req.body?.confirmation !== 'DELETE' || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: 'Enter your current password and type DELETE to confirm.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT email, password_hash FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Incorrect password' });
      }
      await client.query('DELETE FROM email_codes WHERE email = $1', [rows[0].email]);
      await client.query('DELETE FROM login_attempts WHERE identity_key = $1',
        [loginAttemptKey('', req.user.id, secret)]);
      // Foreign keys remove this user's months, transactions and all sessions.
      await client.query('DELETE FROM users WHERE id = $1', [req.user.id]);
      await client.query('COMMIT');
      res.clearCookie('token', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally { client.release(); }
  });
}
