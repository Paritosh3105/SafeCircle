# SafeCircle v0.1 — Step 1 foundation

**Your voice. Your choice.**

Private support for women and girls facing abuse or harassment, especially at
home, and wherever else it happens. Users can explore their options without
being required to make a complaint.

This is a runnable development foundation, not the complete v1 service.
Use made-up information only. No clinicians, lawyers, support workers, police
integrations, emergency response, or credential reviewers are connected.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Web | Next.js App Router + React + TypeScript | Accessible responsive web screens and a familiar React ecosystem |
| API | Node.js + Fastify + TypeScript | Independent versioned service usable by web and future native clients |
| Database | PostgreSQL + SQL migrations + node-postgres | Clear relational constraints, transactions and explicit query ownership checks |
| Shared package | TypeScript + Zod | Reuse input validation and response types across clients |
| Mobile later | React Native + Expo | Native Android/iOS screens with shared TypeScript contracts and the same API |

We intentionally begin as a modular monolith. Microservices, Kafka, video,
payment processing, Redis and uploads are not needed for this first slice.
No external data or AI services receive private disclosures.

## Quick start

Requirements: Node.js 22 or newer, npm, and optionally Docker Compose for PostgreSQL.
Run from the project root:

```bash
npm ci
npm run setup:local
npm run dev
```

Open **http://localhost:3000**. The API listens on 127.0.0.1:4000.
Use localhost rather than 127.0.0.1 in the browser because the API enforces the
configured WEB_ORIGIN. Change WEB_ORIGIN if you intentionally use a different
origin. Do not disable origin checks to fix a configuration mismatch.

Local setup creates `.env` with random keys and development memory storage.
The generated file is excluded from version control and from the source archive.
Memory mode loses accounts, recovery codes and requests when the API restarts.
It is forbidden by production configuration. Recovery codes are credentials.

## Durable PostgreSQL development path

```bash
docker compose -f infra/compose.yml up -d
```

Set `STORE_MODE=postgres` in your local `.env`, retain the generated encryption
and hashing keys, then:

```bash
npm run db:migrate
npm run dev
```

Compose credentials are local development values only. Keep database ports on
loopback. Changing encryption keys without a migration makes existing encrypted
text unreadable. Changing the hashing key invalidates recovery/session lookup.
Real deployment needs managed secrets, key rotation and recovery policy.

## Implemented in step 1

- Responsive landing page highlighting support especially at home and elsewhere.
- Confidentiality notice before private access or request detail submission.
- Pseudonymous private access without legal name, phone, email or payment details.
- Random recovery code shown at creation, recover access, logout and session expiry.
- Secure-cookie flags in production, CSRF and exact configured-origin enforcement.
- AES-256-GCM encryption for request details and application claims, with record binding.
- Hash-only recovery/session credentials in storage, request body limits and rate limiting.
- Owned request creation, listing, retrieval and pause.
- Separate adult, under-18 safeguarding and undisclosed-age eligibility routing labels.
- Pending professional applications with no directory, messaging or case privileges.
- Notifications and outside contact fixed off on the server and database schema.
- Neutral view, quick exit, no browser local storage and client inactivity locking.
- PostgreSQL migration and a database adapter, plus a development-only memory adapter.

Routing labels are recorded for later trained review. They do not start an
operational safeguarding process. Requests stay unassigned, and the app says so.
Quick exit uses a best-effort logout request and replaces the current page.
It cannot erase history or guarantee logout delivery if the network fails.
The server session expires after 30 minutes. The browser attempts logout after
10 minutes of inactivity. Browser-only locking does not override server expiry.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The automated suite exercises the API with the memory adapter. It covers
cross-account reads/mutations, strict input shape, Origin/CSRF enforcement,
pending-applicant access, age routing, session recovery/revocation/expiry,
encryption record binding, and production memory-mode rejection.

PostgreSQL runtime integration is verified by an opt-in test against the local
Compose database; see [docs/STAFF_AUTH.md](docs/STAFF_AUTH.md) for the command and
results. Browser/device testing remains pending. Run the manual journey below.

## Manual journey

1. Open the app, read the privacy notice, choose an age pathway and create access.
2. Keep the recovery code only in a safe place. Submit an empty or synthetic request.
3. Check the private reference and honest unassigned status. Pause the request.
4. Lock the session, then use the code to return to the same account.
5. Open another browser profile and confirm it cannot see the first profile’s requests.
6. Submit a synthetic professional application. It remains pending and grants no access.
7. Check keyboard operation and phone-width layout. Test quick exit and note its limits.

## Directory structure

```text
safecircle/
  apps/
    web/                 Next.js frontend and responsive screens
      app/               Public entry, private workspace and neutral exit
    api/                 Separate Fastify API
      src/               Routes, crypto, sessions and store adapters
      test/              Security and access regression tests
    mobile/              Reserved React Native/Expo roadmap
  packages/
    contracts/           Shared Zod schemas and TypeScript interfaces
    database/
      migrations/        Versioned PostgreSQL schema
  infra/                 Local PostgreSQL compose file
  scripts/               Local setup helper
  docs/                  Architecture, API, security and next steps
```

## Step 2A: staff authentication

Separate operator-provisioned staff identities, role-gated workspaces, password
hashing, expiring sessions and logout are implemented. Visit `/staff` after
explicitly enabling development synthetic fixtures. Setup, provisioning commands,
test results and remaining live-use protections are in [docs/STAFF_AUTH.md](docs/STAFF_AUTH.md).
Step 1 privacy controls and synthetic-only service availability remain in place.
Professional approval, case assignment and messaging are not implemented.

## Next step

Implement separately provisioned staff accounts, strong staff authentication,
reviewer decisions, verified credentials and current-status checks. Then add
assignment-scoped private conversations. Do not enable professional access
merely because an application exists or a profile claims credentials.

See `docs/ROADMAP.md` for the remaining v1 scope. A production environment is
not enabled or deployed as part of this coding-foundation step.
