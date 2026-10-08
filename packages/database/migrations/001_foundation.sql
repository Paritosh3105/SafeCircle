CREATE TABLE IF NOT EXISTS accounts (
 id uuid PRIMARY KEY, pseudonym text NOT NULL,
 age_band text NOT NULL CHECK (age_band IN ('adult','under18','undisclosed')),
 jurisdiction text NOT NULL, recovery_hash text NOT NULL UNIQUE,
 notifications_enabled boolean NOT NULL DEFAULT false CHECK (notifications_enabled=false),
 outside_contact_allowed boolean NOT NULL DEFAULT false CHECK (outside_contact_allowed=false),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 csrf_token text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions(account_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS support_requests (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id), reference text NOT NULL UNIQUE,
 help_type text NOT NULL CHECK (help_type IN ('talk','emotional','legal','safety','practical')),
 details_encrypted text NOT NULL, status text NOT NULL CHECK (status IN ('received','paused')),
 route text NOT NULL CHECK (route IN ('adult','safeguarding','eligibility_review')),
 created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_owner_idx ON support_requests(account_id,created_at DESC);
CREATE TABLE IF NOT EXISTS professional_applications (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
 professional_role text NOT NULL CHECK (professional_role IN ('lawyer','psychiatrist','clinical_psychologist','counsellor','ngo_representative','support_worker')),
 status text NOT NULL DEFAULT 'pending_verification' CHECK (status='pending_verification'),
 evidence_encrypted text NOT NULL, created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS applications_owner_idx ON professional_applications(account_id);
CREATE TABLE IF NOT EXISTS audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid NOT NULL REFERENCES accounts(id),
 action text NOT NULL, target_id uuid NOT NULL, created_at timestamptz NOT NULL
);
-- Staff identities, verified credentials, assignment permissions and consent grants arrive in step 2.
-- Applying as a professional never modifies account privileges.
