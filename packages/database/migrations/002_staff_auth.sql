CREATE TABLE staff_identities (
 id uuid PRIMARY KEY,
 username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,80}$'),
 password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('verification_reviewer','safeguarding_lead','administrator')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE staff_sessions (
 token_hash text PRIMARY KEY,
 staff_id uuid NOT NULL REFERENCES staff_identities(id) ON DELETE CASCADE,
 csrf_token text NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE INDEX staff_sessions_identity_idx ON staff_sessions(staff_id);
CREATE INDEX staff_sessions_expiry_idx ON staff_sessions(expires_at);
