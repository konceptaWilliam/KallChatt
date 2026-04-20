-- Add expiry to invites: tokens expire 7 days after creation
ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days';
