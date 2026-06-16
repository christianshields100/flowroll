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

-- v4: profile photo (public URL into the `avatars` storage bucket below).
alter table public.profiles
  add column if not exists avatar_url text;

-- v5: home gym, standardized on a Google Places place_id so analytics can
-- group across users (home_gym_name is just the display label).
alter table public.profiles
  add column if not exists home_gym_place_id text,
  add column if not exists home_gym_name text;

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

-- v5: standardized gym. `gym` stays the display name (now the place's name);
-- `gym_place_id` is the Google Places canonical id for cross-gym analytics.
alter table public.sessions
  add column if not exists gym_place_id text;

create index if not exists sessions_gym_place_id_idx
  on public.sessions (gym_place_id);

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
-- chat_usage — per-user daily Coach quota (v3). The counter is bumped only
-- through the SECURITY DEFINER function below, so a user can't reset it by
-- clearing their conversation or by writing the row directly.
------------------------------------------------------------
create table if not exists public.chat_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

-- Atomically record one Coach use for the caller today and return how many
-- remain. Raises 'chat_quota_exceeded' once the daily limit is hit. Runs as
-- definer so it can write chat_usage regardless of RLS; uses auth.uid() so the
-- caller can't bump someone else's counter.
create or replace function public.check_and_bump_chat_quota(daily_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  used integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.chat_usage (user_id, day, count)
    values (uid, current_date, 1)
  on conflict (user_id, day)
    do update set count = public.chat_usage.count + 1
  returning count into used;

  if used > daily_limit then
    -- clamp so the stored counter doesn't run away past the limit
    update public.chat_usage set count = daily_limit
      where user_id = uid and day = current_date;
    raise exception 'chat_quota_exceeded';
  end if;

  return daily_limit - used;
end;
$$;

------------------------------------------------------------
-- Follow graph helpers (v4). The follows table is RLS-gated to rows where the
-- caller is involved, so to show counts/lists for OTHER profiles we go through
-- SECURITY DEFINER functions that apply the privacy rules themselves.
------------------------------------------------------------

-- Accepted follower / following counts for any profile (counts are public,
-- Instagram-style). Definer so it can see edges the caller isn't part of.
create or replace function public.profile_follow_counts(target uuid)
returns table(followers integer, following integer)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.follows
       where followee_id = target and status = 'accepted'),
    (select count(*)::int from public.follows
       where follower_id = target and status = 'accepted');
$$;

-- Can the caller open `target`'s follower/following LISTS? Yes if it's their
-- own profile, the target is public, or they're an accepted follower.
create or replace function public.can_view_follow_lists(target uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    target = auth.uid()
    or exists (select 1 from public.profiles p
                 where p.id = target and p.is_private = false)
    or exists (select 1 from public.follows f
                 where f.follower_id = auth.uid()
                   and f.followee_id = target
                   and f.status = 'accepted');
$$;

-- Accepted followers of `target` (the people who follow them).
create or replace function public.profile_followers(target uuid)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_view_follow_lists(target) then
    return;
  end if;
  return query
    select p.* from public.profiles p
    join public.follows f on f.follower_id = p.id
    where f.followee_id = target and f.status = 'accepted'
    order by f.created_at desc;
end;
$$;

-- Accounts `target` follows.
create or replace function public.profile_following(target uuid)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_view_follow_lists(target) then
    return;
  end if;
  return query
    select p.* from public.profiles p
    join public.follows f on f.followee_id = p.id
    where f.follower_id = target and f.status = 'accepted'
    order by f.created_at desc;
end;
$$;

------------------------------------------------------------
-- avatars storage bucket (v4). Public read so <img> works without signed URLs;
-- a user may only write into their own {user_id}/… folder.
------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: write own folder" on storage.objects;
create policy "avatars: write own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: update own folder" on storage.objects;
create policy "avatars: update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: delete own folder" on storage.objects;
create policy "avatars: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
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
alter table public.chat_usage    enable row level security;

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
-- Read: own sessions, OR any session of a PUBLIC account (Instagram-style —
-- public profiles are viewable by anyone signed in), OR sessions of a private
-- account I have an ACCEPTED follow with. A pending request grants nothing.
-- The feed query still scopes itself to accepted follows, so this only opens
-- up direct profile views, not the timeline.
drop policy if exists "sessions: read own or followed" on public.sessions;
create policy "sessions: read own or followed"
  on public.sessions for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = sessions.user_id and p.is_private = false
    )
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

-- chat_usage — owner may read their counter; writes only via the RPC --------
drop policy if exists "chat_usage: read own" on public.chat_usage;
create policy "chat_usage: read own"
  on public.chat_usage for select
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
