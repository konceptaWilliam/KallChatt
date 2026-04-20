-- =============================================================
-- Per-group roles — move role from profiles to group_memberships
-- =============================================================

-- Add role to group_memberships
alter table group_memberships
  add column role text not null default 'MEMBER'
  check (role in ('ADMIN', 'MEMBER'));

-- Promote group creators to ADMIN
update group_memberships gm
set role = 'ADMIN'
from groups g
where gm.group_id = g.id
  and gm.user_id = g.created_by;

-- Drop RLS policies that reference profiles.role before dropping the column
drop policy if exists "groups: admin insert" on groups;
drop policy if exists "invites: admin read" on invites;
drop policy if exists "invites: admin insert" on invites;
drop policy if exists "invites: admin delete" on invites;

-- Remove role from profiles
alter table profiles drop column role;

-- ─────────────────────────────────────────────────────────────
-- Recreate RLS policies
-- ─────────────────────────────────────────────────────────────

-- Any authenticated user can create a group
create policy "groups: insert if authenticated"
  on groups for insert
  with check (auth.uid() is not null);

-- Invite policies: tRPC layer enforces group-admin check via service role.
-- Allow authenticated users to select (needed for list queries via user client).
create policy "invites: authenticated read"
  on invites for select
  using (auth.uid() is not null);
