-- =============================================================
-- Push debounce bookkeeping — last time we sent a push to a user about a
-- thread. The send fan-out reads this to suppress a burst of pushes for the
-- same thread within a short window (a mention or URGENT thread bypasses it).
-- Purely server-side: only the tRPC admin (service_role) touches it. RLS is
-- enabled with no policies, so direct client access is denied; service_role
-- bypasses RLS.
-- =============================================================

create table if not exists push_throttle (
  user_id        uuid references profiles on delete cascade not null,
  thread_id      uuid references threads on delete cascade not null,
  last_pushed_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

create index if not exists idx_push_throttle_user on push_throttle (user_id);

alter table push_throttle enable row level security;
