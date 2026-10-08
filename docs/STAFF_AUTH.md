# Step 2A: separate staff authentication

This remains a synthetic-only development service. Staff login does not mean
the service is staffed. Professional applications remain pending and requests
remain unassigned. No review decisions, case access or messaging were added.

## Local synthetic fixtures

Run `npm run setup:local` if local configuration does not exist. Add these values
to the ignored root `.env` (choose your own synthetic password of 16–256 characters):

```dotenv
NODE_ENV=development
SYNTHETIC_STAFF_FIXTURES=true
SYNTHETIC_STAFF_PASSWORD=choose-a-local-synthetic-password
```

For memory mode, start `npm run dev`. For PostgreSQL mode:

```bash
docker compose -f infra/compose.yml up -d
# Set STORE_MODE=postgres in .env first.
npm run db:migrate
npm run dev
```

Open http://localhost:3000/staff. Fixture usernames are
`synthetic.verification_reviewer`, `synthetic.safeguarding_lead`, and
`synthetic.administrator`. All use the configured synthetic password. Fixtures
are off by default and rejected outside explicit development mode. Existing
fixture accounts are never overwritten; changing the fixture password does not
reset existing PostgreSQL identities. Memory identities disappear on restart.
Do not commit passwords or enable fixtures in a live environment.

## Controlled provisioning

There is no HTTP staff registration, provisioning, role-change or approval route.
An operator with database access can create an identity with the CLI:

```powershell
# Set STAFF_PROVISION_PASSWORD securely in the current process environment.
# Avoid putting a credential in command history or command-line arguments.
npm run staff:provision -w @safecircle/api -- synthetic.operator verification_reviewer
Remove-Item Env:STAFF_PROVISION_PASSWORD
```

The CLI requires DATABASE_URL from `.env`. Roles are exactly
`verification_reviewer`, `safeguarding_lead`, and `administrator`. Duplicate
usernames fail; provisioning never promotes a visitor account. Access to this
CLI and database credentials is the provisioning trust boundary, not the web UI.
Passwords are salted scrypt hashes (N=32768, r=8, p=3, 64-byte output), using
[OWASP's documented settings](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

To disable a staff identity, an authorised database operator can execute a
parameterised update setting `staff_identities.active=false` and delete its
`staff_sessions` rows. Active state and current role are checked on every
protected API request. Password reset and role changes require an operator
procedure; revoke all sessions when changing credentials or privileges.

## Session boundaries

Staff identities and sessions have separate tables and memory maps, no visitor
account foreign key, and a separate cookie. Token hashes also have a staff
namespace, preventing relabelled visitor cookies from authenticating staff.
Production uses `__Host-sc_staff_session` with Secure, HttpOnly, SameSite Strict
and Path=/; development uses `sc_staff_session` on local HTTP. Raw session
credentials and passwords are not persisted or logged.

Staff sessions have a fixed 30-minute server expiry. Successful login replaces
the presented staff session and rotates token/CSRF credentials. Other devices
can retain their own sessions until logout, disablement or expiry. Logout revokes
the presented server session. The screen clears its workspace at expiry and
does not use localStorage. Visitor logout and quick exit concern visitor sessions;
staff must use the separate staff logout on shared devices.

Exact configured Origin checks cover every mutation, including login. Staff
logout additionally requires its own session CSRF token. Login uses strict input
validation, generic credential failures, a dummy hash for unknown usernames, and
a five-attempt-per-minute per-address limiter. Each role workspace checks the
current role server-side. Administrators have their own workspace and do not
implicitly inherit reviewer or safeguarding privileges. These endpoints return
only development status, never requests or application evidence.

## Verification on 2026-10-08

Before edits: type checks, all 5 existing tests and the web build passed. Windows
sandbox child-process restrictions caused EPERM for tests/build; elevated reruns
passed. Git status could not be checked: Git is unavailable on PATH and this
workspace has no `.git` directory. Existing source was extended in place; no
reset, cleanup, commit or deployment was performed.

After changes: `npm run typecheck`, `npm test` (8 tests), and `npm run build`
passed. Existing Step 1 regressions still pass. New tests cover ordinary and
pending-applicant denial, absent public provisioning, strict login shape,
relabelled visitor-cookie denial, every pair in the staff role matrix, separate
visitor/staff sessions, CSRF and Origin denial, logout/revocation, exact expiry,
deactivation, salted password verification, fixture production rejection,
production cookie flags and login throttling.

Follow-up verification: Git for Windows and Docker Desktop were installed.
Docker's PostgreSQL 17 container is healthy and restricted to loopback. Both
migrations were applied to the local development database; `.env` now uses
PostgreSQL without changing encryption or hashing keys.

All 9 tests passed with PostgreSQL explicitly enabled, including the new
`apps/api/test/postgres.test.ts` integration check. It creates its own temporary
schema, runs the actual migration runner twice, checks database role constraints,
creates synthetic private requests and pending applications, and verifies
staff/private sessions survive closing and recreating the API. It also checks
cross-account and pending-applicant denial, the staff role matrix, CSRF, logout,
disabled staff and expiry, then removes only its own test schema.

To repeat the complete test suite in PowerShell with the local Compose database:

```powershell
$env:TEST_DATABASE_URL='postgresql://safecircle:local-dev-only@localhost:5432/safecircle'
npm test
Remove-Item Env:TEST_DATABASE_URL
```

Without TEST_DATABASE_URL, the PostgreSQL test is explicitly skipped. Do not use
a live database for these checks. Type checks also passed after adding the test.

Repeat verification on 2026-10-08: all 9 API/PostgreSQL tests and workspace type
checks passed. The web build passed. Development processes belonging to this
project were stopped for the build and restarted to load PostgreSQL configuration.
Existing application records and encryption keys were preserved.

The project originated from a ZIP with no Git history. A local repository is now
initialised at `D:\MyOwnProject\safecircle`. No remote, push, commit or source
reset was performed. `.gitignore` excludes `.env` variants (except `.env.example`),
dependencies, Next/build output, coverage, logs, secret directories, private key
files and AWS credential directories. Exclusions were checked with
`git check-ignore`; source files appear as untracked in the new repository.

Browser/UI verification remains pending. This VS Code session has no connected
built-in Browser. HTTP health/page checks and a web build are not visual or
interaction testing; use the manual checklist below.

## Manual browser checklist (pending)

Use synthetic information only. Open http://localhost:3000 in a normal browser
and http://localhost:3000/staff for the staff screen. Retrieve the synthetic
password locally from the ignored `.env`; do not post it in chat or screenshots.

1. Confirm the synthetic-only notice, labelled username/password inputs, keyboard
   focus, Enter-to-submit, readable errors and absence of public staff registration.
2. Submit incorrect credentials; confirm a generic failure and no workspace.
   Repeated attempts should be throttled; allow one minute before continuing.
3. Log in as each `synthetic.<role>` identity. Confirm the correct role and expiry,
   open its role workspace and see the honest disabled-workflows message. Log out
   between identities so the five-attempt limiter does not disrupt the check.
4. While logged in, use browser developer tools to request a different role's
   `/api/v1/staff/workspace/<role>` route. Confirm HTTP 403. The administrator
   must not inherit another role's workspace.
5. Reload with a staff session: it should restore the identity. Log out: reload
   and Back navigation must not restore authenticated API access. Leave a session
   for 30 minutes and confirm expiry locks both the screen and protected API.
6. In a separate browser profile, create ordinary private access, then a pending
   professional application. Request `/api/v1/staff/me` and each staff workspace;
   confirm HTTP 401 and that the applicant remains pending with no privileges.
7. Complete the README Step 1 manual journey: privacy notice, age pathways,
   synthetic request creation/pause, recovery, account isolation, inactivity lock,
   neutral view and quick exit. Staff and visitor sessions are separate; use
   staff logout explicitly when leaving a shared device.
8. Check narrow phone-width and desktop layouts, zoom to 200%, and keyboard-only
   operation. Confirm labels, focus indicators, readable status/error messages,
   masked password entry and no clipped controls or horizontal overflow.
9. Check browser console/network for unexpected errors or external requests.
   Record browser/version, viewport and pass/fail notes; share only synthetic
   screenshots without passwords, recovery codes, session tokens or database keys.

These manual checks remain unchecked until somebody performs them. Live-use
authentication protections below still apply even after the checklist passes.

## Authentication work before live use

Require reviewed staff MFA (prefer phishing-resistant authenticators), secure
enrolment and recovery, compromised-password checks, password reset with global
session revocation, staff offboarding, audited provisioning/role changes/login
events, account-based and shared distributed throttling, alerting and credential
attack response. Add a reviewed staff inactivity policy, session/device management,
expired-session cleanup, and safe shared-device behaviour. Review TLS/proxy
configuration, host/cookie boundaries, nonce-based CSP, secret management,
database permissions and independent security testing. Benchmark password
hashing under load. Existing privacy, retention, safeguarding and operational
requirements in SECURITY.md still apply. No live readiness or public deployment
is implied by this step.
