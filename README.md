# Tesoria

A full-stack budgeting app built around the **50/30/20 rule**. Enter your monthly income, log your expenses by category, and watch your targets and charts update in real time.

**Live demo:** https://tesoria.onrender.com/

![Tesoria dashboard](docs/screenshot.png)

## Features

- **50/30/20 budgeting.** Needs (50%), Wants (30%) and Savings & debt (20%) targets are calculated from your income automatically.
- **Real-time charts.** Target vs. actual for the month, spending by category, a 12-month trend, and income vs. spending.
- **Full transaction management.** Add, edit and delete transactions, with category suggestions based on your history.
- **Account security.** Email verification with one-time codes, password recovery by code, and rate limiting on authentication routes.
- **12-month retention.** Data older than 12 months is purged automatically, which keeps storage small.
- **CSV export.** Download your last 12 months to Excel or Google Sheets.
- **Responsive UI.** Works on phones, tablets and desktops, and can be installed as an app.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Recharts |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL (Neon) |
| Auth | JWT in httpOnly cookies, bcrypt password hashing |
| Email | Nodemailer (any SMTP provider) |
| Security | Helmet (CSP and security headers), express-rate-limit |

## Project structure

```
tesoria/
├── server.js            # Express API, database schema, auth and email
├── package.json
├── .env.example         # Environment variable template
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
- An SMTP account to send verification emails (optional in development)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/tesoria.git
cd tesoria
npm install
```

### 2. Configure environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes in production | Secret for signing sessions. At least 32 characters. |
| `SMTP_HOST` | For email | SMTP server, for example `smtp.gmail.com` |
| `SMTP_PORT` | For email | Usually `587` |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password or app password |
| `MAIL_FROM` | For email | Sender, for example `Tesoria <you@example.com>` |
| `PORT` | No | Server port. Defaults to `3000`. |
| `NODE_ENV` | No | Set to `production` when deployed |

**Development without SMTP:** if the `SMTP_*` variables are not set, verification and reset codes are printed in the terminal instead of being emailed. This is disabled in production.

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
Build command:  npm install && npm run build
Start command:  npm start
```

Set the environment variables above in the Render dashboard, along with `NODE_ENV=production` and `NODE_VERSION=22`.

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
| `GET` | `/api/months/:period` | Income and transactions for a month (`YYYY-MM`) |
| `PUT` | `/api/months/:period/income` | Set the month's income |
| `POST` | `/api/months/:period/transactions` | Add a transaction |
| `PUT` | `/api/transactions/:id` | Edit a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `GET` | `/api/categories` | Categories used in the last 12 months |
| `GET` | `/api/summary` | 12-month series for the charts |
| `GET` | `/api/export` | CSV export of the last 12 months |

## Security

- Passwords are hashed with bcrypt. Passwords longer than 72 bytes are rejected, because bcrypt ignores anything after that.
- Session tokens are signed JWTs with a pinned algorithm (HS256), stored in `httpOnly`, `SameSite=Lax` cookies. They are `Secure` in production.
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
