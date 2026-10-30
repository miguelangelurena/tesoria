# Tesoria

A full-stack budgeting app built around the **50/30/20 rule**. Enter your monthly income, log your expenses by category, and watch your targets and charts update in real time.

**Live demo:** https://tesoria.onrender.com/

## Features

- **50/30/20 budgeting.** Needs (50%), Wants (30%) and Savings & debt (20%) targets are calculated from your income automatically.
- **Real-time charts.** Target vs. actual for the month, spending by category, a 12-month trend, and income vs. spending.
- **Full transaction management.** Add, edit and delete transactions, with category suggestions based on your history.
- **Account security.** Email verification with one-time codes, password recovery by code, 15-character minimum for new passwords, and PostgreSQL-backed login throttling per account plus per-IP limits.
- **12-month retention.** Data older than 12 months is purged automatically, which keeps storage small.
- **Copy from the previous month.** Start a month from the last one, or add whatever is missing later.
- **Account.** Change your username from the Account button.
- **CSV export.** Download your last 12 months to Excel or Google Sheets.
- **Stay signed in.** A "Keep me signed in" option keeps you signed in for 30 days (renewed each visit) using an httpOnly cookie and a server-side PostgreSQL session. Signing out invalidates only the current device; the username field is pre-filled from the device.
- **Responsive UI.** Works on phones, tablets and desktops, and can be installed as an app. On phones the menu, the new-transaction form and the charts start collapsed.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Recharts |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL (Neon) |
| Auth | JWT in httpOnly cookies, bcrypt password hashing |
| Email | [Brevo](https://www.brevo.com) transactional email API (sent over HTTPS) |
| Security | Helmet (CSP and security headers), express-rate-limit |

## Project structure

```
tesoria/
├── server.js            # Express API, database schema, auth and email
├── package.json
└── client/
    ├── index.html
    ├── vite.config.js
    ├── public/          # Favicons, app icons, web manifest
    └── src/
        ├── App.jsx      # Routing between landing, auth and dashboard
        ├── api.js       # HTTP client for the API
        ├── constants.js # Budget buckets, colors and formatters
        └── components/  # Landing, Login, Dashboard, Charts, and more
```

## Getting started

### Prerequisites

- Node.js 20.19 or newer (Node 22 LTS recommended)
- A PostgreSQL database. A free [Neon](https://neon.tech) project works well.
- A [Brevo](https://www.brevo.com) account and API key to send verification emails (optional in development)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/tesoria.git
cd tesoria
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root (it is git-ignored) with your values:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DATABASE_URL_POOLED` | No | Pooled connection string (for example Neon's pooler). Used instead of `DATABASE_URL` when set. |
| `JWT_SECRET` | Yes in production | Secret for signing sessions. At least 32 characters. |
| `BREVO_API_KEY` | For email | Brevo API key |
| `MAIL_FROM_EMAIL` | For email | Sender address, verified in Brevo |
| `MAIL_FROM_NAME` | No | Sender name. Defaults to `Tesoria`. |
| `SITE_URL` | No | Public URL of the site, used for the logo in emails. Defaults to `https://tesoria.onrender.com`. |
| `PORT` | No | Server port. Defaults to `3000`. |
| `NODE_ENV` | No | Set to `production` when deployed |

**Development without email:** if `BREVO_API_KEY` and `MAIL_FROM_EMAIL` are not set, verification and reset codes are printed in the terminal instead of being emailed. This is disabled in production, where registration fails with "Email is not configured on the server".

### 3. Build and run

```bash
npm run build   # installs client dependencies and compiles the frontend
npm start       # starts the server on http://localhost:3000
```

The database schema is created automatically on first start.

### Development mode

To work on the frontend with hot reload, run the API and the Vite dev server in separate terminals:

```bash
# Terminal 1: API on port 3000
npm start

# Terminal 2: frontend on port 5173 (proxies /api to port 3000)
cd client
npm run dev
```

## Deployment

The app is deployed as a single Node.js web service. The Express server serves the compiled frontend from `client/dist` and the API from `/api`.

**Render (build command / start command):**

```
Build command:  npm ci && npm run build
Start command:  npm start
```

Set the environment variables above in the Render dashboard, along with `NODE_ENV=production` and `NODE_VERSION=22`. Email goes through Brevo's HTTPS API because Render's free instances block outbound SMTP.

## API overview

All budget routes require a valid session cookie.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account and send a verification code |
| `POST` | `/api/auth/verify` | Confirm the email and sign in |
| `POST` | `/api/auth/resend` | Send a new verification code |
| `POST` | `/api/auth/login` | Sign in with username or email |
| `POST` | `/api/auth/forgot` | Send a password reset code |
| `POST` | `/api/auth/reset` | Set a new password with the code |
| `POST` | `/api/auth/logout` | End the session |
| `GET` | `/api/me` | Current user and allowed month range |
| `PUT` | `/api/me/username` | Change the username (needs the current password) |
| `GET` | `/api/months/:period` | Income and transactions for a month (`YYYY-MM`) |
| `PUT` | `/api/months/:period/income` | Set the month's income |
| `POST` | `/api/months/:period/copy-previous` | Add the previous month's income (if this month has none) and, when the body has `expenses: true`, its expenses. Never overwrites or duplicates |
| `POST` | `/api/months/:period/transactions` | Add a transaction |
| `PUT` | `/api/transactions/:id` | Edit a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `GET` | `/api/categories` | Categories used in the last 12 months |
| `GET` | `/api/summary` | 12-month series for the charts |
| `GET` | `/api/export` | CSV export of the last 12 months |

## Security

- Passwords are hashed with bcrypt. Passwords longer than 72 bytes are rejected, because bcrypt ignores anything after that.
- Session tokens are signed JWTs with a pinned algorithm (HS256), stored in `httpOnly`, `SameSite=Lax` cookies. They are `Secure` in production. The session is never kept in `localStorage`, where any injected script could read it. Without "Keep me signed in" the cookie ends when the browser closes.
- Verification and reset codes are stored as HMAC hashes, expire after 10 minutes, and lock out after 5 wrong attempts.
- Authentication routes are rate limited per IP.
- Helmet sets security headers and a Content Security Policy.
- Request bodies are limited to 10 KB.
- User-provided text is escaped by React and stripped of angle brackets and control characters on the server.
- CSV exports are protected against formula injection.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

Coded by **Miguel U.**


## Authentication hardening (October 2026)

- **Password creation/reset:** New passwords must be at least 15 Unicode characters and at most 72 UTF-8 bytes (bcryptjs limit). Existing accounts can still sign in with their previous passwords; no automatic password reset is triggered. Long passphrases with spaces work.
- **Login throttling:** PostgreSQL tracks up to 10 login attempts per account per 15-minute window, shared across instances and between email/username aliases, in addition to the existing per-IP limiter. Unknown identifiers use a pseudonymous HMAC key; successful logins clear the count. The reset-password flow remains available. Attackers can still temporarily throttle a known account; monitor for denial-of-service.
- **Per-device logout:** New JWTs carry a random session UUID stored in PostgreSQL. Logout deletes that session, immediately invalidating the token even if copied; other devices remain logged in. Remember-me sessions renew their existing server-side session ID. Password resets still revoke all existing sessions through `session_version`.
- **Migration impact:** JWTs issued before this change do not include a registered session UUID. They receive HTTP 401 on the first authenticated request, so users must sign in once more after rollout. The startup schema initializer creates `user_sessions` and `login_attempts` tables automatically.
- **Testing:** `npm test` runs logic-level checks. Full authentication and concurrent rate-limit verification require a separate staging PostgreSQL database and end-to-end tests before deployment.
- **Future hardening:** Consider a comprehensive breached-password blocklist, refresh-token rotation or shorter absolute session lifetimes, session activity alerts and centralized security monitoring.

## Security regression tests: authentication (staging)

Use a **separate disposable PostgreSQL database** named with `_test` or `_staging`, then follow [`AUTH_STAGING_TEST_PLAN.md`](AUTH_STAGING_TEST_PLAN.md). The suite starts an isolated local API, exercises registration, verification, two-device logout, cookie renewal, password reset and per-account throttling, and cleans up its test users. It intentionally refuses to run against a database not explicitly marked as staging/test.

- Unit tests: `npm test`
- Integration tests (explicit opt-in): `npm run test:integration`

The integration suite requires `TESORIA_TEST_DATABASE_URL` and `TESORIA_TEST_CONFIRM=I_UNDERSTAND_THIS_USES_A_TEST_DB`. Never point it at production.


## Staging deployment checks (Phase 4)

Run `npm test` for unit/security policy tests, then use `npm run test:staging` only against a separate HTTPS staging deployment. See [STAGING_DEPLOY_V4.md](STAGING_DEPLOY_V4.md). The smoke test will refuse the public Tesoria domain.

## Production release (v5)

See [`PRODUCTION_DEPLOY_V5.md`](PRODUCTION_DEPLOY_V5.md) for Render rollout, backups, environment preflight, health checks and rollback. Production uses `npm ci && npm run build`, `npm start`, and `GET /healthz`; no production environment secrets are included in this repository.
