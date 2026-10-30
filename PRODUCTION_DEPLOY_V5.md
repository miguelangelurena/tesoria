# Tesoria — production deployment release v5

**Release status:** Production deployment package prepared; **not deployed or verified against a live Neon/Render/Brevo environment in this workspace**. Earlier staging integration checks were reported as successful by the project owner; this is not a substitute for a production smoke test. This release preserves the v4 security hardening and adds deployment checks, a Render Blueprint and an availability check. No live user records are included.

## 1. Release contents and changes

- Reproducible frontend dependencies using `npm ci --include=dev --prefix client` rather than `npm install`.
- Production preflight checks `NODE_ENV`, Node runtime, the built `client/dist/index.html`, HTTPS `SITE_URL`, the **effective** PostgreSQL URL (pooled overrides direct), JWT secret length and Brevo sender settings; it never prints secret values.
- `GET /healthz` responds 200 when PostgreSQL responds to `SELECT 1`, otherwise 503. Useful as Render's `healthCheckPath`.
- Express binds to `0.0.0.0` using the `PORT` environment variable.
- `render.yaml` is an **optional Blueprint intended for a new service**; for the current service `tesoria.onrender.com`, change its Settings directly. Auto-deploy is disabled in the Blueprint.
- Node.js 22.12 or newer required; recommend setting `NODE_VERSION=22` on Render. The package includes source code, not a precompiled bundle.

## 2. Before any production deployment

1. Confirm `npm test`, `npm run build`, `npm run test:integration` (against a disposable database only), `npm run test:staging` (against the dedicated staging deployment) and the Brevo email flows passed.
2. Run `npm audit --omit=dev` and `npm audit --prefix client` from a networked machine and resolve critical/high actionable advisories. No npm dependency audit is claimed to have passed as part of this release.
3. Create a Neon restore point or restorable backup, then **verify restoration in an isolated environment**. The API runs CREATE/ALTER schema statements and deletes records older than 12 months at startup; do not test this against the live database.
4. Confirm which database URL Render actually uses: `DATABASE_URL_POOLED` takes precedence over `DATABASE_URL`. They must both point to the intended production database if both are configured.
5. Keep the **current production `JWT_SECRET` value**. Rotating it would immediately invalidate existing sessions. With the prior v2 session migration, users with old JWTs that predate PostgreSQL-backed sessions already need to sign in once again.
6. Maintain a rollback plan. Reverting to a server that accepts JWTs without a database session ID weakens logout revocation. If you need to roll back, prefer the immediately previous hardened release, not the original repository snapshot.

## 3. Local release verification (PowerShell)

From the extracted project root:

```powershell
node --version
npm ci
npm test
npm run build
Test-Path .\client\dist\index.html  # Must return True
node --check .\server.js
```

The production preflight can be tested **only with local test credentials or staging configuration**; never copy live production secrets into screenshots, console transcripts, or chat. For a normal local test, use a disposable database and `NODE_ENV=development`.

## 4. Deploy on the EXISTING Render service (recommended)

1. Commit the extracted source code to a new Git branch. Review the diff and merge only after the previous checklist is met. Never commit `.env` or credential values.
2. Render Dashboard → **existing Tesoria web service** → Settings:
   - Runtime: Node
   - Root directory: repository root
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/healthz`
   - Disable auto deploy until manual verification is complete.
3. Render → Environment (do not paste values into a repository):
   - `NODE_ENV=production`
   - `NODE_VERSION=22`
   - `SITE_URL=https://tesoria.onrender.com` (use the exact real HTTPS origin if it differs)
   - `DATABASE_URL`: the existing production Neon URL with `sslmode=require` or `sslmode=verify-full`
   - `DATABASE_URL_POOLED` (optional): if present, verify **this points to production**, with valid TLS
   - `JWT_SECRET`: the existing long production secret (at least 32 chars; do not rotate casually)
   - `BREVO_API_KEY`: the production Brevo API key
   - `MAIL_FROM_EMAIL`: sender verified by Brevo
   - `MAIL_FROM_NAME=Tesoria` (optional)
   - `PORT` is supplied by Render; no need to set manually.
4. Use **Manual Deploy** after reviewing the intended commit. Production preflight runs before `server.js`. A missing variable stops startup rather than silently disabling email verification.
5. Watch deploy/build logs. The service becomes ready when `/healthz` returns `200` and the database initializer finishes. Never publish connection strings, cookies or email codes in logs.

**IMPORTANT:** Applying `render.yaml` via a new Blueprint is **not** how to update a service created manually in Render; doing so may create an extra resource. It is provided as an optional reference for a new infrastructure-as-code setup. The blueprint's `DATABASE_URL` is not enough if an old `DATABASE_URL_POOLED` is present: remove/update any stale pooled variable in the Render Dashboard.

## 5. Post-deployment smoke check (no attack traffic)

```powershell
# Safe unauthenticated checks:
(Invoke-WebRequest 'https://tesoria.onrender.com/healthz').StatusCode  # expect 200
(Invoke-WebRequest 'https://tesoria.onrender.com/').StatusCode         # expect 200
```

- In a private browser window, register a disposable account and verify Brevo's code arrives.
- Sign in, add/edit/delete a disposable transaction, and inspect dashboard charts.
- Open a second private profile, sign in, close session A, verify A can no longer call `/api/me` while B still can.
- Exercise Forgot Password with a test inbox, confirm prior sessions no longer work.
- Inspect DevTools: auth cookies should include `HttpOnly`, `Secure`, `SameSite=Lax`.
- Confirm old users can sign in again and historical transactions remain unchanged.
- Review Render error logs and Brevo transactional events for delivery errors.

## 6. Rollback

- Preserve the pre-deploy code revision, restore point and all environment settings before starting.
- If the release fails, roll back **only to the previous hardened v4 version** while investigating. v4 already understands `user_sessions`, `login_attempts` and the 15-character password rule.
- Rollback of **code** does not undo schema/data changes or retention purges. Restore the database only after assessing backups and the impact on any new user changes.
- A rollback to the old original version could restore acceptance of nonrevocable JWTs; do not do that.

## Notes and limitations

- This version does **not** include any live credentials or actual production export.
- Automatic schema changes and data purging on startup remain architectural risks; for a future release migrate to a separate explicit migration job and maintenance plan.
- Existing per-IP rate limiting uses process memory; multi-instance deployments should use a shared store. PostgreSQL already backs the per-account login limiter.
- Browser/host/device testing, live Brevo delivery, PostgreSQL integration, audit of package advisories and Render deploy must still be verified on your infrastructure.
