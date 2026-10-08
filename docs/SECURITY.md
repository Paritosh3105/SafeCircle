# Step 1 security and privacy boundaries

## Implemented

- Server ownership checks and strict body schemas prevent self-assigned privilege.
- Request details and application claims use AES-256-GCM with record/owner binding.
- Secure random recovery/session secrets and keyed hashes prevent raw credential storage.
- HttpOnly SameSite Strict cookies, Origin and CSRF checks, rate/body limits.
- HTTPS and durable storage requirements for production configuration.
- No request payload logging, advertising trackers, external fonts, analytics,
  notifications, payment details, uploads, microphone, camera or location access.
- Metadata audit events for request creation/pause and application submission.
- Pseudonymous public-facing account identity. Minimal age/jurisdiction collection.

## Threat model and remaining controls

Step 2A adds separately provisioned staff identities, salted scrypt passwords,
distinct expiring sessions, current-role and active-state checks, and staff CSRF
protection. Staff status workspaces have no private content access. No public
staff registration exists. See [STAFF_AUTH.md](STAFF_AUTH.md) for setup, tested
boundaries and remaining authentication requirements, including MFA and audit.

| Threat | Current control | Remaining work before a live service |
| --- | --- | --- |
| Household device access | Quick exit, neutral view, inactivity locking | Native device testing, safe-contact policies, shared-device review |
| Recovery-code theft | High entropy, hashes at rest, revocation on recovery | User recovery policy, account takeover response, abuse review |
| Malicious applicant | Pending status grants no case access | Independent identity/credential checks, reviewer authentication, appeals |
| Cross-account record access | Owner checks before return/mutation | Staff assignment and scope checks with expiry/suspension |
| Insider access | No staff content endpoints yet | MFA, scoped staff access, read/disclosure audits, break-glass review |
| Database exposure | Encrypted incident/application content | Managed secrets, key rotation, encrypted backups, storage hardening |
| Minor disclosures | Separate route metadata and limits notice | Locally reviewed policy and staffed safeguarding workflow |
| XSS | React text rendering, bounded inputs, security headers | Nonce-based production CSP and independent security review |

The current CSP permits inline scripts and eval for framework development. Tighten
it with reviewed nonces before live deployment. Rate limits are per-process and
per-address because trustProxy is disabled. Review proxy configuration and use a
shared limiter if multiple API instances deploy. Do not blindly trust forwarded IPs.

Production configuration checks are safeguards, not a production-readiness claim.
No live deployments, real provider credentials, payment, formal complaint submission
or external contact exist in this step. API recovery codes are secret credentials,
not a guarantee of anonymity. Encryption at rest does not conceal content from
an authorised process or solve retention/backup deletion.

Notice version tracking, sensitive-read auditing, retention/deletion/export,
backup deletion, staff verification and policy operations remain required.
The current mutation audit records contain identifiers and event names only.
