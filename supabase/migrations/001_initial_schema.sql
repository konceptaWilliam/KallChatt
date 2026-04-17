-- =============================================================
-- Kallchatt — initial schema + RLS
-- Run this in the Supabase SQL editor (or via supabase db push)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  workspace_id uuid references workspaces on delete cascade,
  display_name text not null,
  email        text not null,
  avatar_url   text,
  role         text not null default 'MEMBER' check (role in ('ADMIN', 'MEMBER')),
  created_at   timestamptz default now()
);

create table if not exists groups (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  name         text not null,
  created_by   uuid references profiles on delete set null,
  created_at   timestamptz default now()
);

create table if not exists group_memberships (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid references groups on delete cascade not null,
  user_id   uuid references profiles on delete cascade not null,
  joined_at timestamptz default now(),
  unique (group_id, user_id)
);

create table if not exists threads (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid references groups on delete cascade not null,
  title      text not null,
  status     text not null default 'OPEN' check (status in ('OPEN', 'URGENT', 'DONE')),
  created_by uuid references profiles on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid references threads on delete cascade not null,
  user_id    uuid references profiles on delete set null,
  body       text not null,
  created_at timestamptz default now()
);

create table if not exists invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  email        text not null,
  invited_by   uuid references profiles on delete set null,
  group_ids    uuid[] not null default '{}',
  accepted     boolean default false,
  token        text unique not null,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────

create index if not exists idx_profiles_workspace      on profiles (workspace_id);
create index if not exists idx_group_memberships_user  on group_memberships (user_id);
create index if not exists idx_group_memberships_group on group_memberships (group_id);
create index if not exists idx_threads_group           on threads (group_id);
create index if not exists idx_threads_updated         on threads (updated_at desc);
create index if not exists idx_messages_thread         on messages (thread_id, created_at);
create index if not exists idx_invites_token           on invites (token);
create index if not exists idx_invites_email           on invites (email);

-- ─────────────────────────────────────────────────────────────
-- Enable Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table workspaces        enable row level security;
alter table profiles          enable row level security;
alter table groups            enable row level security;
alter table group_memberships enable row level security;
alter table threads           enable row level security;
alter table messages          enable row level security;
alter table invites           enable row level security;

-- ─────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────

-- Returns the workspace_id for the currently authenticated user
create or replace function my_workspace_id()
returns uuid
language sql
stable
security definer
as $$
  select workspace_id from profiles where id = auth.uid()
$$;

-- Returns true if the current user is a member of the given group
create or replace function is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from group_memberships
    where group_id = p_group_id and user_id = auth.uid()
  )
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS Policies — workspaces
-- ─────────────────────────────────────────────────────────────

-- Users can read their own workspace
create policy "workspace: read own"
  on workspaces for select
  using (id = my_workspace_id());

-- ─────────────────────────────────────────────────────────────
-- RLS Policies — profiles
-- ─────────────────────────────────────────────────────────────

-- Users can read all profiles in their workspace
create policy "profiles: read workspace members"
  on profiles for select
  using (workspace_id = my_workspace_id());

-- Users can insert their own profile (onboarding)
create policy "profiles: insert own"
  on profiles for insert
  with check (id = auth.uid());

-- Users can update their own profile
create policy "profiles: update own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- RLS Policies — groups
-- ─────────────────────────────────────────────────────────────

-- Users can read groups they are a member of
create policy "groups: read if member"
  on groups for select
  using (is_group_member(id));

-- Admins can insert groups in their workspace
create policy "groups: admin insert"
  on groups for insert
  with check (
    workspace_id = my_workspace_id()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS Policies — group_memberships
-- ─────────────────────────────────────────────────────────────

-- Users can read memberships for groups they belong to
create policy "group_memberships: read own groups"
  on group_memberships for select
  using (is_group_member(group_id));

-- Allow insert during invite acceptance (service role handles this)
-- or when a user is added by an admin via tRPC (uses service role client)
create policy "group_memberships: insert self"
  on group_memberships for insert
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- RLS Policies — threads
-- ─────────────────────────────────────────────────────────────

-- Members can read threads in their groups
create policy "threads: read if group member"
  on threads for select
  using (is_group_member(group_id));

-- Members can create threads in their groups
create policy "threads: insert if group member"
  on threads for insert
  with check (is_group_member(group_id));

-- Members can update thread status
create policy "threads: update if group member"
  on threads for update
  using (is_group_member(group_id));

-- ─────────────────────────────────────────────────────────────
-- RLS Policies — messages
-- ─────────────────────────────────────────────────────────────

-- Members can read messages in threads they have access to
create policy "messages: read if group member"
  on messages for select
  using (
    exists (
      select 1 from threads t
      where t.id = messages.thread_id
        and is_group_member(t.group_id)
    )
  );

-- Members can insert messages into accessible threads
create policy "messages: insert if group member"
  on messages for insert
  with check (
    exists (
      select 1 from threads t
      where t.id = messages.thread_id
        and is_group_member(t.group_id)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS Policies — invites
-- ─────────────────────────────────────────────────────────────

-- Admins can read invites for their workspace
create policy "invites: admin read"
  on invites for select
  using (
    workspace_id = my_workspace_id()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );

-- Anyone (anon or auth) can read an invite by its token — for the invite page
create policy "invites: read by token"
  on invites for select
  using (true); -- token is unguessable; filter is applied in the query

-- Admins can insert invites
create policy "invites: admin insert"
  on invites for insert
  with check (
    workspace_id = my_workspace_id()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );

-- Admins can delete (revoke) invites in their workspace
create policy "invites: admin delete"
  on invites for delete
  using (
    workspace_id = my_workspace_id()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'ADMIN'
    )
  );

-- Authenticated users can mark an invite as accepted
create policy "invites: accept own"
  on invites for update
  using (email = (select email from profiles where id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Realtime: enable publications
-- ─────────────────────────────────────────────────────────────
-- Run these in the Supabase dashboard → Database → Replication,
-- or include here if using the CLI.

-- alter publication supabase_realtime add table messages;
-- alter publication supabase_realtime add table threads;

-- ─────────────────────────────────────────────────────────────
-- Seed: create the first workspace and admin (manual step)
-- ─────────────────────────────────────────────────────────────
-- The first admin is created via the /onboarding flow after
-- signing in with a magic link. No seed data required.
