-- FlowRoll — v1 schema
-- Paste this entire file into Supabase → SQL Editor → New query → Run.
-- Idempotent: safe to re-run during development.

------------------------------------------------------------
-- Extensions
------------------------------------------------------------
create extension if not exists "pgcrypto";
-- trigram extension powers fuzzy partner search on profiles.display_name
create extension if not exists "pg_trgm";

------------------------------------------------------------
-- profiles
------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  belt         text not null default 'white'
               check (belt in ('white','blue','purple','brown','black')),
  stripes      smallint not null default 0
               check (stripes between 0 and 4),
  created_at   timestamptz not null default now()
);

create index if not exists profiles_display_name_trgm
  on public.profiles using gin (display_name gin_trgm_ops);

-- v3: Instagram-style privacy. Private accounts turn new follows into
-- pending requests that the account owner must accept.
alter table public.profiles
  add column if not exists is_private boolean not null default false;

------------------------------------------------------------
-- sessions
------------------------------------------------------------
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  trained_on      date not null,
  duration_min    integer not null check (duration_min > 0 and duration_min < 600),
  gym             text,
  rounds          integer not null default 0 check (rounds >= 0 and rounds < 100),
  drilled         text,
  subs_hit        text[] not null default '{}',
  subs_caught_in  text[] not null default '{}',
  feel            smallint not null check (feel between 1 and 5),
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists sessions_user_trained_on_idx
  on public.sessions (user_id, trained_on desc);

-- v2: training partners — free-text names, autocompleted in the UI from
-- followed users + your own past entries. Text (not FKs) so partners
-- without accounts can be logged too.
alter table public.sessions
  add column if not exists partners text[] not null default '{}';

------------------------------------------------------------
-- follows
------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

-- v3: follow lifecycle. 'accepted' grants session visibility; 'pending' is a
-- request awaiting the followee. Existing rows default to accepted, so
-- followers from before the privacy feature keep access (Instagram behavior).
alter table public.follows
  add column if not exists status text not null default 'accepted'
  check (status in ('pending','accepted'));

-- The DB, not the client, decides whether a new follow is live or a request —
-- a follower can't smuggle in status='accepted' against a private account.
create or replace function public.set_follow_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select case when p.is_private then 'pending' else 'accepted' end
    into new.status
    from public.profiles p
    where p.id = new.followee_id;
  return new;
end;
$$;

drop trigger if exists set_follow_status_on_insert on public.follows;
create trigger set_follow_status_on_insert
  before insert on public.follows
  for each row execute function public.set_follow_status();

------------------------------------------------------------
-- chat_messages — persisted Coach conversations (v2)
------------------------------------------------------------
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at);

------------------------------------------------------------
-- weekly_recaps — one Coach-generated recap per user per week (v2)
------------------------------------------------------------
create table if not exists public.weekly_recaps (
  user_id    uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  content    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

------------------------------------------------------------
-- Profile auto-create on signup
-- Pulls display_name from raw_user_meta_data->>'display_name' if present,
-- else from the email local-part. Falls back to 'flowroll athlete' for safety.
------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, belt, stripes)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1),
      'flowroll athlete'
    ),
    coalesce(new.raw_user_meta_data->>'belt', 'white'),
    coalesce((new.raw_user_meta_data->>'stripes')::int, 0)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------
-- Row-Level Security
------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.sessions      enable row level security;
alter table public.follows       enable row level security;
alter table public.chat_messages enable row level security;
alter table public.weekly_recaps enable row level security;

-- profiles -----------------------------------------------------------------
drop policy if exists "profiles: read all (authenticated)" on public.profiles;
create policy "profiles: read all (authenticated)"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- sessions -----------------------------------------------------------------
-- Read: own sessions OR sessions of users I follow (accepted follows only —
-- a pending request grants nothing).
drop policy if exists "sessions: read own or followed" on public.sessions;
create policy "sessions: read own or followed"
  on public.sessions for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.followee_id = sessions.user_id
        and f.status = 'accepted'
    )
  );

drop policy if exists "sessions: insert own" on public.sessions;
create policy "sessions: insert own"
  on public.sessions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "sessions: update own" on public.sessions;
create policy "sessions: update own"
  on public.sessions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "sessions: delete own" on public.sessions;
create policy "sessions: delete own"
  on public.sessions for delete
  to authenticated
  using (user_id = auth.uid());

-- chat_messages — strictly private to the owner ----------------------------
drop policy if exists "chat_messages: read own" on public.chat_messages;
create policy "chat_messages: read own"
  on public.chat_messages for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat_messages: insert own" on public.chat_messages;
create policy "chat_messages: insert own"
  on public.chat_messages for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "chat_messages: delete own" on public.chat_messages;
create policy "chat_messages: delete own"
  on public.chat_messages for delete
  to authenticated
  using (user_id = auth.uid());

-- weekly_recaps — strictly private to the owner -----------------------------
drop policy if exists "weekly_recaps: read own" on public.weekly_recaps;
create policy "weekly_recaps: read own"
  on public.weekly_recaps for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "weekly_recaps: insert own" on public.weekly_recaps;
create policy "weekly_recaps: insert own"
  on public.weekly_recaps for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "weekly_recaps: update own" on public.weekly_recaps;
create policy "weekly_recaps: update own"
  on public.weekly_recaps for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- follows ------------------------------------------------------------------
-- Read rows where I'm involved (so the followee can see their followers too)
drop policy if exists "follows: read where involved" on public.follows;
create policy "follows: read where involved"
  on public.follows for select
  to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

drop policy if exists "follows: insert as follower" on public.follows;
create policy "follows: insert as follower"
  on public.follows for insert
  to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "follows: delete as follower" on public.follows;
create policy "follows: delete as follower"
  on public.follows for delete
  to authenticated
  using (follower_id = auth.uid());

-- v3: the followee can decline a request or remove an existing follower.
drop policy if exists "follows: delete as followee" on public.follows;
create policy "follows: delete as followee"
  on public.follows for delete
  to authenticated
  using (followee_id = auth.uid());

-- v3: the followee can accept a pending request (the only allowed update).
drop policy if exists "follows: followee accepts" on public.follows;
create policy "follows: followee accepts"
  on public.follows for update
  to authenticated
  using (followee_id = auth.uid())
  with check (followee_id = auth.uid() and status = 'accepted');
