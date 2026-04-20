-- =============================================================
-- Remove workspaces — single-tenant app, groups are enough
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Drop dependent policies first (they reference workspace_id)
-- ─────────────────────────────────────────────────────────────

drop policy if exists "invites: admin read" on invites;
drop policy if exists "invites: admin insert" on invites;
drop policy if exists "invites: admin delete" on invites;
drop policy if exists "groups: admin insert" on groups;
drop policy if exists "profiles: read workspace members" on profiles;
drop policy if exists "workspace: read own" on workspaces;

-- Drop workspace_id from invites
alter table invites drop column workspace_id;

-- Drop workspace_id from groups
alter table groups drop column workspace_id;

-- Drop workspace_id index + column from profiles
drop index if exists idx_profiles_workspace;
alter table profiles drop column workspace_id;

-- Drop workspaces table
drop table if exists workspaces;

-- Drop my_workspace_id helper (no longer needed)
drop function if exists my_workspace_id();

-- ─────────────────────────────────────────────────────────────
-- Recreate RLS policies without workspace scoping
-- ─────────────────────────────────────────────────────────────

-- profiles: all authenticated users can read all profiles
create policy "profiles: read all"
  on profiles for select
  using (auth.uid() is not null);

-- groups: admin insert no longer needs workspace_id check
create policy "groups: admin insert"
  on groups for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );

-- invites: role-only checks (no workspace scoping)
create policy "invites: admin read"
  on invites for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );

create policy "invites: admin insert"
  on invites for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );

create policy "invites: admin delete"
  on invites for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );
