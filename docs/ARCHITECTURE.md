# Architecture decisions

## One backend for web and future mobile

The web app calls `/api/v1/*`. Next.js forwards these requests to the independent
Fastify `/v1/*` service. Business rules and ownership checks live in the API,
not in the frontend. PostgreSQL never connects directly to a browser.

The future mobile app calls the versioned API directly. It shares contracts and
validation, not HTML/CSS screens. Current authentication is deliberately for the
web client: HttpOnly cookies, SameSite Strict, exact Origin checks and CSRF.
A native session transport and reviewed OS secure storage are separate work.
Do not simply add a bypass for requests missing Origin.

## Modular monolith

Step 1 uses small modules: configuration, encryption, storage, API routes and
shared contracts. The API route file will split into access/support/verification
modules when staff assignment arrives. Avoid placeholder abstractions without
working behaviours. Future staff verification remains separate from account
creation.

## Storage

PostgreSQL enforces account/session/request relationships and limited statuses.
Store access wraps multi-row writes in transactions. MemoryStore mirrors the
interface for tests and clearly labelled synthetic development sessions.
Incident details and application claims use authenticated encryption with record
and owner identifiers as associated data. High-entropy credentials use keyed
hashes; raw recovery codes and cookie values are not persisted. These measures
are not end-to-end encryption: an authorised API process can decrypt content.

The initial schema has no contact/identity document table because those inputs
are not collected. Reviewer-only credential evidence, clinical notes and optional
contact vaults will get separate permissions and storage in later migrations.

## Authentication and service states

Account creation accepts only age band, jurisdiction and notice acknowledgement.
Unknown role/status keys fail strict validation. The API derives routing, ownership,
private references and default contact settings. All professional applications
remain pending. There is no implemented approval endpoint. Step 2A adds separate
operator-provisioned staff identities and sessions; see STAFF_AUTH.md. Staff
role workspaces expose only development status, with no private content access.

The development service always advertises `acceptsRealCases=false` and no staffing.
It does not simulate receipt by a real organisation or deliver messages outside
its own storage. Professional expiry and suspension will become assignment and
protected-operation gates in step 2.

## API versioning

Reuse `/v1` with additive compatible fields. Breaking changes get `/v2`, or an
explicit coordinated migration. Contracts are version-controlled with both clients.
Add generated OpenAPI documentation when the staff workflow stabilises.
