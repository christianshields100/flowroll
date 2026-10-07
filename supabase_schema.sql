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

-- v6: real name (shown on the profile; display_name becomes the @handle),
-- date of birth (collected at onboarding, never shown), and an onboarding flag.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists dob        date,
  add column if not exists onboarded  boolean not null default false;

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
-- The @handle (display_name) is always the email local-part — e.g.
-- christianshields100@gmail.com → "christianshields100". We deliberately ignore
-- any OAuth-provided name (Google sends the person's full name) so the handle
-- stays email-derived; the real name is collected separately in onboarding.
-- Falls back to 'flowroll athlete' only if there's somehow no email.
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
      nullif(split_part(new.email, '@', 1), ''),
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

------------------------------------------------------------
-- v7: social — reactions + comments on sessions
------------------------------------------------------------

-- Reactions: one row per (session, user, emoji). The app uses a small fixed
-- palette but we don't constrain it in the DB beyond a sane length.
create table if not exists public.session_reactions (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, emoji)
);
create index if not exists session_reactions_session_idx
  on public.session_reactions (session_id);

-- Comments: free text, newest-last in the UI.
create table if not exists public.session_comments (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists session_comments_session_idx
  on public.session_comments (session_id, created_at);

-- Whether the caller may see a session — mirrors the "sessions: read own or
-- followed" policy (owner, OR public account, OR accepted follower). SECURITY
-- DEFINER so it can read sessions/profiles/follows regardless of the caller's
-- own row-level visibility; auth.uid() still reflects the caller. Reused by the
-- reaction/comment policies so visibility stays defined in exactly one place.
create or replace function public.can_view_session(sid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.sessions s
    join public.profiles p on p.id = s.user_id
    where s.id = sid
      and (
        s.user_id = auth.uid()
        or p.is_private = false
        or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.followee_id = s.user_id
            and f.status = 'accepted'
        )
      )
  );
$$;

alter table public.session_reactions enable row level security;
alter table public.session_comments  enable row level security;

-- Reactions: read if you can see the session; add only your own on a session
-- you can see; remove only your own.
drop policy if exists "reactions: read visible" on public.session_reactions;
create policy "reactions: read visible"
  on public.session_reactions for select
  to authenticated
  using (public.can_view_session(session_id));

drop policy if exists "reactions: insert own" on public.session_reactions;
create policy "reactions: insert own"
  on public.session_reactions for insert
  to authenticated
  with check (user_id = auth.uid() and public.can_view_session(session_id));

drop policy if exists "reactions: delete own" on public.session_reactions;
create policy "reactions: delete own"
  on public.session_reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- Comments: read if you can see the session; add only as yourself on a visible
-- session; delete your own OR (as the session owner) any comment on your session.
drop policy if exists "comments: read visible" on public.session_comments;
create policy "comments: read visible"
  on public.session_comments for select
  to authenticated
  using (public.can_view_session(session_id));

drop policy if exists "comments: insert own" on public.session_comments;
create policy "comments: insert own"
  on public.session_comments for insert
  to authenticated
  with check (user_id = auth.uid() and public.can_view_session(session_id));

drop policy if exists "comments: delete own or session owner" on public.session_comments;
create policy "comments: delete own or session owner"
  on public.session_comments for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      where s.id = session_comments.session_id and s.user_id = auth.uid()
    )
  );

------------------------------------------------------------
-- v8: session media — photos/videos attached to sessions
------------------------------------------------------------

-- Public URLs into the session-media bucket. Rides along with the session row,
-- so feed/profile visibility is enforced by the existing sessions RLS.
alter table public.sessions
  add column if not exists media_urls text[] not null default '{}';

-- session-media bucket: public read (so <img>/<video> work without signed
-- URLs); a user may only write into their own {user_id}/… folder. 50MB cap,
-- images + video only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('session-media', 'session-media', true, 52428800, array['image/*','video/*'])
  on conflict (id) do nothing;

drop policy if exists "session-media: public read" on storage.objects;
create policy "session-media: public read"
  on storage.objects for select
  using (bucket_id = 'session-media');

drop policy if exists "session-media: write own folder" on storage.objects;
create policy "session-media: write own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'session-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "session-media: delete own folder" on storage.objects;
create policy "session-media: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'session-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

------------------------------------------------------------
-- v9: WHOOP integration — per-user OAuth tokens, synced day metrics
-- (strain/recovery/sleep) and workouts. All owner-only under RLS; the
-- webhook can only flip a needs_sync flag (never read tokens or write data).
------------------------------------------------------------

create table if not exists public.whoop_connections (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  whoop_user_id  bigint not null,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  scopes         text,
  needs_sync     boolean not null default false,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists whoop_connections_whoop_user_idx
  on public.whoop_connections (whoop_user_id);

-- One row per physiological day.
create table if not exists public.whoop_cycles (
  user_id           uuid not null references auth.users(id) on delete cascade,
  day               date not null,
  day_strain        numeric,
  recovery_score    numeric,
  hrv_ms            numeric,
  resting_hr        numeric,
  sleep_performance numeric,
  sleep_hours       numeric,
  updated_at        timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.whoop_workouts (
  id             uuid primary key, -- WHOOP v2 workout UUID
  user_id        uuid not null references auth.users(id) on delete cascade,
  started_at     timestamptz not null,
  ended_at       timestamptz not null,
  local_date     date,
  sport          text,
  strain         numeric,
  avg_hr         numeric,
  max_hr         numeric,
  kilojoules     numeric,
  session_id     uuid references public.sessions(id) on delete set null,
  nudge_dismissed boolean not null default false,
  updated_at     timestamptz not null default now()
);
create index if not exists whoop_workouts_user_started_idx
  on public.whoop_workouts (user_id, started_at desc);

alter table public.whoop_connections enable row level security;
alter table public.whoop_cycles      enable row level security;
alter table public.whoop_workouts    enable row level security;

drop policy if exists "whoop_connections: own" on public.whoop_connections;
create policy "whoop_connections: own"
  on public.whoop_connections for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "whoop_cycles: own" on public.whoop_cycles;
create policy "whoop_cycles: own"
  on public.whoop_cycles for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "whoop_workouts: own" on public.whoop_workouts;
create policy "whoop_workouts: own"
  on public.whoop_workouts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Called by the (cookie-less) webhook route after signature verification.
-- Deliberately minimal: it can only request a re-sync for an already-connected
-- WHOOP user — no token access, no data writes — so a forged call with the
-- anon key can at worst trigger an extra sync.
create or replace function public.whoop_mark_needs_sync(p_whoop_user_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.whoop_connections
     set needs_sync = true
   where whoop_user_id = p_whoop_user_id;
$$;

-- ============================================================
-- v10: Public REST API keys + YouTube study cache
-- ============================================================

-- Per-user API keys for the public REST API (/api/v1). The raw key is shown
-- once at creation; only its sha256 hex lands here. `prefix` is the first
-- few characters, kept for display ("frk_a1b2c3…").
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  prefix       text not null,
  key_hash     text not null unique,
  scopes       text[] not null default '{read}',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked      boolean not null default false
);

create index if not exists api_keys_user_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);
drop policy if exists "api_keys_insert_own" on public.api_keys;
create policy "api_keys_insert_own" on public.api_keys
  for insert with check (auth.uid() = user_id);
drop policy if exists "api_keys_update_own" on public.api_keys;
create policy "api_keys_update_own" on public.api_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "api_keys_delete_own" on public.api_keys;
create policy "api_keys_delete_own" on public.api_keys
  for delete using (auth.uid() = user_id);

-- Daily request counts per key. No policies: only the SECURITY DEFINER
-- functions below read or write it (same pattern as chat_usage).
create table if not exists public.api_usage (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  day    date not null,
  count  integer not null default 0,
  primary key (key_id, day)
);
alter table public.api_usage enable row level security;

-- Shared cache of YouTube search results (public, non-sensitive data;
-- keyed by normalized query). 7-day TTL enforced app-side.
create table if not exists public.study_cache (
  query      text primary key,
  results    jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.study_cache enable row level security;
drop policy if exists "study_cache_select" on public.study_cache;
create policy "study_cache_select" on public.study_cache
  for select to authenticated using (true);
drop policy if exists "study_cache_insert" on public.study_cache;
create policy "study_cache_insert" on public.study_cache
  for insert to authenticated with check (true);
drop policy if exists "study_cache_update" on public.study_cache;
create policy "study_cache_update" on public.study_cache
  for update to authenticated using (true) with check (true);

-- Internal: validate a key hash, enforce scope + daily quota, touch
-- last_used_at. Returns the owning user id. Raises invalid_api_key /
-- insufficient_scope / rate_limited. Not granted to clients — only the
-- api_* endpoint functions below call it.
create or replace function public.api_authenticate(
  p_key_hash text,
  p_scope text default 'read',
  p_daily_limit integer default 1000
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  k public.api_keys%rowtype;
  n integer;
begin
  select * into k from public.api_keys
   where key_hash = p_key_hash and not revoked;
  if not found then
    raise exception 'invalid_api_key';
  end if;
  if not (p_scope = any (k.scopes)) then
    raise exception 'insufficient_scope';
  end if;
  insert into public.api_usage (key_id, day, count)
  values (k.id, current_date, 1)
  on conflict (key_id, day) do update set count = public.api_usage.count + 1
  returning count into n;
  if n > p_daily_limit then
    raise exception 'rate_limited';
  end if;
  update public.api_keys set last_used_at = now() where id = k.id;
  return k.user_id;
end;
$$;

revoke execute on function public.api_authenticate(text, text, integer) from public, anon, authenticated;

-- GET /api/v1/me
create or replace function public.api_get_profile(p_key_hash text)
returns table (
  id uuid, display_name text, first_name text, last_name text,
  belt text, stripes smallint, home_gym_name text, created_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare uid uuid;
begin
  uid := public.api_authenticate(p_key_hash, 'read');
  return query
    select p.id, p.display_name, p.first_name, p.last_name,
           p.belt, p.stripes, p.home_gym_name, p.created_at
      from public.profiles p
     where p.id = uid;
end;
$$;

-- GET /api/v1/sessions (and /api/v1/stats, which aggregates app-side)
create or replace function public.api_get_sessions(
  p_key_hash text,
  p_from date default null,
  p_to date default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns setof public.sessions
language plpgsql security definer set search_path = public
as $$
declare uid uuid;
begin
  uid := public.api_authenticate(p_key_hash, 'read');
  return query
    select * from public.sessions s
     where s.user_id = uid
       and (p_from is null or s.trained_on >= p_from)
       and (p_to is null or s.trained_on <= p_to)
     order by s.trained_on desc, s.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- GET /api/v1/sessions/:id
create or replace function public.api_get_session(p_key_hash text, p_id uuid)
returns setof public.sessions
language plpgsql security definer set search_path = public
as $$
declare uid uuid;
begin
  uid := public.api_authenticate(p_key_hash, 'read');
  return query
    select * from public.sessions s where s.id = p_id and s.user_id = uid;
end;
$$;

-- POST /api/v1/sessions (requires the 'write' scope)
create or replace function public.api_create_session(
  p_key_hash text,
  p_trained_on date,
  p_duration_min integer,
  p_rounds integer default 0,
  p_gym text default null,
  p_feel smallint default 3,
  p_subs_hit text[] default '{}',
  p_subs_caught_in text[] default '{}',
  p_partners text[] default '{}',
  p_drilled text default null,
  p_note text default null
) returns public.sessions
language plpgsql security definer set search_path = public
as $$
declare uid uuid; s public.sessions;
begin
  uid := public.api_authenticate(p_key_hash, 'write');
  insert into public.sessions
    (user_id, trained_on, duration_min, rounds, gym, feel,
     subs_hit, subs_caught_in, partners, drilled, note)
  values
    (uid, p_trained_on, p_duration_min, coalesce(p_rounds, 0), p_gym,
     coalesce(p_feel, 3), coalesce(p_subs_hit, '{}'),
     coalesce(p_subs_caught_in, '{}'), coalesce(p_partners, '{}'),
     p_drilled, p_note)
  returning * into s;
  return s;
end;
$$;

grant execute on function public.api_get_profile(text) to anon, authenticated;
grant execute on function public.api_get_sessions(text, date, date, integer, integer) to anon, authenticated;
grant execute on function public.api_get_session(text, uuid) to anon, authenticated;
grant execute on function public.api_create_session(text, date, integer, integer, text, smallint, text[], text[], text[], text, text) to anon, authenticated;

-- ============================================================
-- v11: In-app feedback + lightweight visit tracking
-- ============================================================

-- Once-per-day visit counter, bumped by the dashboard. Powers the
-- "you've been here a few times — how's it going?" feedback prompt.
alter table public.profiles
  add column if not exists visit_count integer not null default 0,
  add column if not exists last_seen_on date,
  add column if not exists feedback_dismissed_at timestamptz;

-- User feedback, one row per submission. Read it straight from the
-- Supabase table editor / SQL (order by created_at desc).
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     smallint check (rating between 1 and 5),
  message    text not null check (char_length(message) between 1 and 2000),
  context    text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = user_id);
drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback
  for select using (auth.uid() = user_id);

-- ============================================================
-- v12: Compliance — account deletion + private session media
-- ============================================================

-- Full account deletion, callable by the signed-in user. Removes the
-- user's storage objects, then the auth.users row; every app table
-- references auth.users (directly or via profiles) with ON DELETE CASCADE,
-- so the whole footprint goes in one transaction.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  -- Storage objects live under {user_id}/... in both buckets.
  delete from storage.objects
   where bucket_id in ('avatars', 'session-media')
     and (storage.foldername(name))[1] = uid::text;
  -- Cascades wipe profiles, sessions, media rows, chat, WHOOP, feedback,
  -- api keys, follows, reactions, comments, usage counters.
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.delete_my_account() from anon;

-- session-media goes PRIVATE: no more unauthenticated reads. Files are
-- served via short-lived signed URLs minted server-side; minting requires
-- a storage SELECT policy, granted to signed-in users (paths are
-- unguessable and only ever distributed through RLS-gated session rows).
update storage.buckets set public = false where id = 'session-media';

drop policy if exists "session-media: public read" on storage.objects;
drop policy if exists "session-media: authenticated read" on storage.objects;
create policy "session-media: authenticated read" on storage.objects
  for select to authenticated
  using (bucket_id = 'session-media');

-- Migrate stored media_urls from full public URLs to bare object paths.
update public.sessions
   set media_urls = (
     select coalesce(array_agg(
       regexp_replace(u, '^.*/storage/v1/object/public/session-media/', '')
     ), '{}')
     from unnest(media_urls) u
   )
 where media_urls <> '{}';

-- ============================================================
-- v13: WHOOP removal + content reports
-- ============================================================

-- The WHOOP integration is retired: drop its tables (and all stored health
-- data) and the webhook RPC.
drop function if exists public.whoop_mark_needs_sync(bigint);
drop table if exists public.whoop_workouts;
drop table if exists public.whoop_cycles;
drop table if exists public.whoop_connections;

-- User reports of content (sessions, comments, profiles). Insert-own via
-- RLS; reviewed by the operator directly in the table editor.
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('session','comment','profile')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter_id);

-- ============================================================
-- v14: Journey — belt history (auto-captured), session types
-- ============================================================

-- Numeric rank so belt/stripe changes can be compared. white=0..black=4,
-- five slots per belt for stripes.
create or replace function public.belt_rank(p_belt text, p_stripes integer)
returns integer language sql immutable as $$
  select (array_position(array['white','blue','purple','brown','black'], p_belt) - 1) * 5
         + coalesce(p_stripes, 0);
$$;

-- One row per rank the athlete has held. 'start' = the rank they had when
-- they began tracking; 'promotion' = a rank increase captured from the
-- profile belt/stripes change. Nothing here is typed by hand: a trigger on
-- profiles maintains it.
create table if not exists public.belt_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('start','promotion')),
  belt        text not null check (belt in ('white','blue','purple','brown','black')),
  stripes     smallint not null default 0 check (stripes between 0 and 4),
  promoted_on date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists belt_history_user_idx
  on public.belt_history (user_id, promoted_on, created_at);

alter table public.belt_history enable row level security;

drop policy if exists "belt_history_select_own" on public.belt_history;
create policy "belt_history_select_own" on public.belt_history
  for select using (auth.uid() = user_id);
-- Users may correct dates; inserts/deletes go through the trigger + RPC.
drop policy if exists "belt_history_update_own" on public.belt_history;
create policy "belt_history_update_own" on public.belt_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger: capture rank changes from the profile.
--  * during onboarding (old.onboarded = false): the chosen rank is the
--    'start' row, not a promotion
--  * rank up: insert a 'promotion' (seeding a 'start' from the old rank
--    if history is empty, dated at profile creation)
--  * rank down: BJJ has no demotions, so treat it as a correction — remove
--    the most recent promotion if it matches the rank being backed out
--  * skipped entirely when flowroll.skip_belt_trigger is set (undo RPC)
create or replace function public.track_belt_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  old_rank integer := public.belt_rank(old.belt, old.stripes);
  new_rank integer := public.belt_rank(new.belt, new.stripes);
  latest public.belt_history%rowtype;
begin
  if current_setting('flowroll.skip_belt_trigger', true) = '1' then
    return new;
  end if;

  if not old.onboarded then
    delete from public.belt_history where user_id = new.id and kind = 'start';
    insert into public.belt_history (user_id, kind, belt, stripes, promoted_on)
    values (new.id, 'start', new.belt, new.stripes, current_date);
    return new;
  end if;

  if new_rank = old_rank then
    return new;
  end if;

  if not exists (select 1 from public.belt_history where user_id = new.id) then
    insert into public.belt_history (user_id, kind, belt, stripes, promoted_on)
    values (new.id, 'start', old.belt, old.stripes, old.created_at::date);
  end if;

  if new_rank > old_rank then
    insert into public.belt_history (user_id, kind, belt, stripes, promoted_on)
    values (new.id, 'promotion', new.belt, new.stripes, current_date);
  else
    select * into latest from public.belt_history
     where user_id = new.id
     order by promoted_on desc, created_at desc limit 1;
    if found and latest.kind = 'promotion'
       and public.belt_rank(latest.belt, latest.stripes) = old_rank then
      delete from public.belt_history where id = latest.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_track_belt on public.profiles;
create trigger profiles_track_belt
  after update of belt, stripes, onboarded on public.profiles
  for each row execute function public.track_belt_change();

-- Undo the most recent promotion: remove its row and put the profile back
-- to the previous rank, with the trigger suppressed. All journey stats are
-- derived at read time, so nothing else needs restoring.
create or replace function public.undo_last_promotion()
returns void language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  latest public.belt_history%rowtype;
  prev public.belt_history%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into latest from public.belt_history
   where user_id = uid order by promoted_on desc, created_at desc limit 1;
  if not found or latest.kind <> 'promotion' then
    raise exception 'nothing_to_undo';
  end if;
  select * into prev from public.belt_history
   where user_id = uid and id <> latest.id
   order by promoted_on desc, created_at desc limit 1;
  if not found then raise exception 'nothing_to_undo'; end if;

  perform set_config('flowroll.skip_belt_trigger', '1', true);
  update public.profiles set belt = prev.belt, stripes = prev.stripes where id = uid;
  delete from public.belt_history where id = latest.id;
end;
$$;

grant execute on function public.undo_last_promotion() to authenticated;
revoke execute on function public.undo_last_promotion() from anon;

-- Backfill: every onboarded profile gets a 'start' row at its current rank.
insert into public.belt_history (user_id, kind, belt, stripes, promoted_on)
select p.id, 'start', p.belt, p.stripes, p.created_at::date
  from public.profiles p
 where p.onboarded
   and not exists (select 1 from public.belt_history h where h.user_id = p.id);

-- Session types: competitions become first-class journey events.
alter table public.sessions
  add column if not exists session_type text not null default 'training'
    check (session_type in ('training','open_mat','competition','private')),
  add column if not exists comp_result text;

-- ============================================================
-- v15: In-app notifications
-- ============================================================

-- Per-category opt-outs: {"social": false, "partners": false, "journey": false}
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in (
               'follow_request','follow_accepted','new_follower','reaction',
               'comment','partner_logged','milestone','promotion','recap')),
  actor_id   uuid references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No insert policy: rows are created only by the SECURITY DEFINER helpers.

create or replace function public.notify_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''),
    display_name)
  from public.profiles where id = p_user;
$$;

-- Insert a notification unless the recipient muted its category or is the
-- actor themselves. Actor name is denormalised at write time.
create or replace function public.notify(
  p_user uuid, p_type text, p_actor uuid, p_session uuid, p_data jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare prefs jsonb; cat text;
begin
  if p_user is null or (p_actor is not null and p_user = p_actor) then return; end if;
  select notification_prefs into prefs from public.profiles where id = p_user;
  cat := case
    when p_type in ('follow_request','follow_accepted','new_follower','reaction','comment') then 'social'
    when p_type = 'partner_logged' then 'partners'
    else 'journey' end;
  if coalesce((prefs ->> cat)::boolean, true) = false then return; end if;
  insert into public.notifications (user_id, type, actor_id, session_id, data)
  values (p_user, p_type, p_actor, p_session,
          coalesce(p_data, '{}'::jsonb)
            || jsonb_build_object('actor_name', public.notify_name(p_actor)));
end $$;

-- Follows: request / accepted / new follower.
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.notify(new.followee_id, 'follow_request', new.follower_id, null, '{}');
    else
      perform public.notify(new.followee_id, 'new_follower', new.follower_id, null, '{}');
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify(new.follower_id, 'follow_accepted', new.followee_id, null, '{}');
    perform public.notify(new.followee_id, 'new_follower', new.follower_id, null, '{}');
  end if;
  return new;
end $$;

drop trigger if exists notify_on_follow on public.follows;
create trigger notify_on_follow
  after insert or update of status on public.follows
  for each row execute function public.notify_on_follow();

-- Reactions: batched into one unread notification per session
-- ("Dave and 2 others reacted") instead of one ping per emoji.
create or replace function public.notify_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; existing uuid;
begin
  select user_id into owner from public.sessions where id = new.session_id;
  if owner is null or owner = new.user_id then return new; end if;
  select id into existing from public.notifications
   where user_id = owner and type = 'reaction' and session_id = new.session_id
     and read_at is null
   order by created_at desc limit 1;
  if existing is not null then
    update public.notifications set
      data = data || jsonb_build_object(
        'count', coalesce((data->>'count')::int, 1) + 1,
        'actors', (select jsonb_agg(distinct x)
                     from jsonb_array_elements_text(
                       coalesce(data->'actors', '[]'::jsonb) || to_jsonb(array[new.user_id::text])) x),
        'actor_name', public.notify_name(new.user_id)),
      actor_id = new.user_id,
      created_at = now()
    where id = existing;
  else
    perform public.notify(owner, 'reaction', new.user_id, new.session_id,
      jsonb_build_object('count', 1, 'actors', to_jsonb(array[new.user_id::text]), 'emoji', new.emoji));
  end if;
  return new;
end $$;

drop trigger if exists notify_on_reaction on public.session_reactions;
create trigger notify_on_reaction
  after insert on public.session_reactions
  for each row execute function public.notify_on_reaction();

-- Comments: the session owner, plus anyone else already in the thread.
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; r record; snippet text;
begin
  select user_id into owner from public.sessions where id = new.session_id;
  snippet := left(btrim(new.body), 90);
  perform public.notify(owner, 'comment', new.user_id, new.session_id,
    jsonb_build_object('snippet', snippet));
  for r in
    select distinct user_id from public.session_comments
     where session_id = new.session_id
       and user_id <> new.user_id and user_id <> owner
  loop
    perform public.notify(r.user_id, 'comment', new.user_id, new.session_id,
      jsonb_build_object('snippet', snippet, 'reply', true));
  end loop;
  return new;
end $$;

drop trigger if exists notify_on_comment on public.session_comments;
create trigger notify_on_comment
  after insert on public.session_comments
  for each row execute function public.notify_on_comment();

-- Sessions: tell named training partners (matched by name/handle), and fire
-- milestone notifications when a session-count or hour mark is crossed.
create or replace function public.notify_on_session()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; r record; n integer; hrs numeric; prev_hrs numeric; m integer;
begin
  foreach p in array coalesce(new.partners, '{}'::text[]) loop
    for r in
      select id from public.profiles
       where id <> new.user_id and (
         lower(display_name) = lower(btrim(p)) or
         lower(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) = lower(btrim(p)))
       limit 3
    loop
      perform public.notify(r.id, 'partner_logged', new.user_id, new.id,
        jsonb_build_object('trained_on', new.trained_on));
    end loop;
  end loop;

  select count(*), coalesce(sum(duration_min), 0) / 60.0 into n, hrs
    from public.sessions where user_id = new.user_id;
  prev_hrs := hrs - new.duration_min / 60.0;
  if n in (10, 25, 50, 100, 250, 500, 1000) then
    perform public.notify(new.user_id, 'milestone', null, new.id,
      jsonb_build_object('kind', 'sessions', 'mark', n));
  end if;
  foreach m in array array[10, 25, 50, 100, 250, 500, 1000] loop
    if prev_hrs < m and hrs >= m then
      perform public.notify(new.user_id, 'milestone', null, new.id,
        jsonb_build_object('kind', 'hours', 'mark', m));
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists notify_on_session on public.sessions;
create trigger notify_on_session
  after insert on public.sessions
  for each row execute function public.notify_on_session();

-- Promotions (from the belt-history trigger).
create or replace function public.notify_on_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'promotion' then
    perform public.notify(new.user_id, 'promotion', null, null,
      jsonb_build_object('belt', new.belt, 'stripes', new.stripes));
  end if;
  return new;
end $$;

drop trigger if exists notify_on_promotion on public.belt_history;
create trigger notify_on_promotion
  after insert on public.belt_history
  for each row execute function public.notify_on_promotion();

-- Undo also retracts the promotion notification.
create or replace function public.undo_last_promotion()
returns void language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  latest public.belt_history%rowtype;
  prev public.belt_history%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into latest from public.belt_history
   where user_id = uid order by promoted_on desc, created_at desc limit 1;
  if not found or latest.kind <> 'promotion' then
    raise exception 'nothing_to_undo';
  end if;
  select * into prev from public.belt_history
   where user_id = uid and id <> latest.id
   order by promoted_on desc, created_at desc limit 1;
  if not found then raise exception 'nothing_to_undo'; end if;

  perform set_config('flowroll.skip_belt_trigger', '1', true);
  update public.profiles set belt = prev.belt, stripes = prev.stripes where id = uid;
  delete from public.belt_history where id = latest.id;
  delete from public.notifications
   where user_id = uid and type = 'promotion' and created_at >= latest.created_at;
end;
$$;

-- Weekly recap ready (called by the recap route after generating new text).
create or replace function public.notify_recap()
returns void language sql security definer set search_path = public as $$
  select public.notify(auth.uid(), 'recap', null, null, '{}'::jsonb);
$$;
grant execute on function public.notify_recap() to authenticated;
revoke execute on function public.notify_recap() from anon;

-- ============================================================
-- v16: Gi / No-gi on sessions
-- ============================================================

-- Nullable on purpose: older rows (and quick logs) simply don't say.
alter table public.sessions
  add column if not exists attire text
    check (attire is null or attire in ('gi','nogi'));

-- Public API: accept attire on create (api_get_* use select *, so reads
-- already include it).
drop function if exists public.api_create_session(text, date, integer, integer, text, smallint, text[], text[], text[], text, text);
create or replace function public.api_create_session(
  p_key_hash text,
  p_trained_on date,
  p_duration_min integer,
  p_rounds integer default 0,
  p_gym text default null,
  p_feel smallint default 3,
  p_subs_hit text[] default '{}',
  p_subs_caught_in text[] default '{}',
  p_partners text[] default '{}',
  p_drilled text default null,
  p_note text default null,
  p_attire text default null
) returns public.sessions
language plpgsql security definer set search_path = public
as $$
declare uid uuid; s public.sessions;
begin
  uid := public.api_authenticate(p_key_hash, 'write');
  if p_attire is not null and p_attire not in ('gi','nogi') then
    raise exception 'attire must be gi or nogi';
  end if;
  insert into public.sessions
    (user_id, trained_on, duration_min, rounds, gym, feel,
     subs_hit, subs_caught_in, partners, drilled, note, attire)
  values
    (uid, p_trained_on, p_duration_min, coalesce(p_rounds, 0), p_gym,
     coalesce(p_feel, 3), coalesce(p_subs_hit, '{}'),
     coalesce(p_subs_caught_in, '{}'), coalesce(p_partners, '{}'),
     p_drilled, p_note, p_attire)
  returning * into s;
  return s;
end;
$$;
grant execute on function public.api_create_session(text, date, integer, integer, text, smallint, text[], text[], text[], text, text, text) to anon, authenticated;


-- ============================================================
-- v17: Demo athlete + public read-only snapshot for /demo
-- ============================================================
-- Two synthetic accounts (never sign in): the demo athlete and a training
-- partner who reacts/comments. Fixed ids so the app can pin the demo.
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,is_sso_user)
values
 ('00000000-0000-0000-0000-000000000000','00000000-0000-4000-a000-000000000001','authenticated','authenticated','demo-maya@flowroll.xyz',crypt(gen_random_uuid()::text,gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}','2026-01-04 15:00:00+00',now(),'','','','',false),
 ('00000000-0000-0000-0000-000000000000','00000000-0000-4000-a000-000000000002','authenticated','authenticated','demo-jordan@flowroll.xyz',crypt(gen_random_uuid()::text,gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}','2026-01-04 15:00:00+00',now(),'','','','',false)
on conflict (id) do nothing;

select set_config('flowroll.skip_belt_trigger','1',true);
update public.profiles set display_name='mayareyes', first_name='Maya', last_name='Reyes', belt='blue', stripes=2, onboarded=true, is_private=false, home_gym_name='Ironwood BJJ', home_gym_place_id='demo-ironwood', created_at='2026-01-04 15:00:00+00' where id='00000000-0000-4000-a000-000000000001';
update public.profiles set display_name='jordanlee', first_name='Jordan', last_name='Lee', belt='purple', stripes=1, onboarded=true, is_private=false, home_gym_name='Ironwood BJJ', home_gym_place_id='demo-ironwood' where id='00000000-0000-4000-a000-000000000002';

delete from public.belt_history where user_id='00000000-0000-4000-a000-000000000001';
insert into public.belt_history (user_id,kind,belt,stripes,promoted_on,created_at) values
 ('00000000-0000-4000-a000-000000000001','start','white',4,'2026-01-05','2026-01-05 15:00:00+00'),
 ('00000000-0000-4000-a000-000000000001','promotion','blue',0,'2026-04-11','2026-04-11 20:00:00+00'),
 ('00000000-0000-4000-a000-000000000001','promotion','blue',1,'2026-07-18','2026-07-18 20:00:00+00'),
 ('00000000-0000-4000-a000-000000000001','promotion','blue',2,'2026-09-26','2026-09-26 20:00:00+00');

insert into public.follows (follower_id,followee_id,status) values ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000001','accepted'),('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','accepted') on conflict do nothing;

insert into public.sessions (user_id,trained_on,duration_min,rounds,feel,gym,drilled,subs_hit,subs_caught_in,partners,note,session_type,comp_result,attire)
select '00000000-0000-4000-a000-000000000001', v.* from (values
('2026-01-07'::date,75,5,3,'Ironwood BJJ','Mount escapes — bridge and roll, elbow-knee','{}'::text[],array['armbar','RNC']::text[],array['Theo']::text[],null,'training',null,'gi'),
('2026-01-09'::date,90,5,3,'Ironwood BJJ','Scissor sweep and hip bump chain',array['RNC']::text[],array['kimura']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-01-12'::date,90,6,2,'Ironwood BJJ','Cross-collar choke from mount','{}'::text[],array['triangle','RNC']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-01-14'::date,75,4,4,'Ironwood BJJ','Shrimping, technical stand-up, basic frames',array['americana','americana']::text[],array['armbar','triangle']::text[],array['Sam','Jordan']::text[],'Breathing stayed calm the whole session.','training',null,'gi'),
('2026-01-17'::date,90,9,2,'Ironwood BJJ','Scissor sweep and hip bump chain',array['armbar']::text[],array['kimura','triangle']::text[],array['Theo','Nina','Jordan']::text[],null,'open_mat',null,'nogi'),
('2026-01-19'::date,90,6,4,'Ironwood BJJ','Scissor sweep and hip bump chain',array['americana']::text[],array['armbar','triangle']::text[],array['Jordan','Sam']::text[],'Gassed by round four.','training',null,'gi'),
('2026-01-21'::date,75,6,3,'Ironwood BJJ','Side control escapes — frame and shrimp',array['americana']::text[],array['kimura','RNC']::text[],array['Theo','Alex']::text[],null,'training',null,'gi'),
('2026-01-23'::date,75,4,3,'Ironwood BJJ','Americana from side control',array['americana']::text[],array['armbar']::text[],array['Alex','Nina']::text[],null,'training',null,'gi'),
('2026-01-24'::date,90,7,2,'Ironwood BJJ',null,array['americana']::text[],array['RNC']::text[],array['Nina','Sam','Jordan']::text[],null,'open_mat',null,'nogi'),
('2026-01-26'::date,90,5,3,'Ironwood BJJ','Mount escapes — bridge and roll, elbow-knee',array['armbar','americana']::text[],array['armbar','RNC']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-01-28'::date,75,5,3,'Ironwood BJJ','Side control escapes — frame and shrimp',array['americana']::text[],array['kimura']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-01-29'::date,60,2,4,'Ironwood BJJ','Private with Coach Dev — triangle details','{}'::text[],'{}'::text[],array['Coach Dev']::text[],null,'private',null,'gi'),
('2026-01-30'::date,75,6,2,'Ironwood BJJ','Mount escapes — bridge and roll, elbow-knee','{}'::text[],array['triangle']::text[],array['Sam']::text[],null,'training',null,'gi'),
('2026-02-02'::date,75,6,3,'Ironwood BJJ','Basic guard passing — knee slice',array['kimura']::text[],array['triangle','armbar']::text[],array['Sam']::text[],null,'training',null,'gi'),
('2026-02-04'::date,75,5,3,'Ironwood BJJ','Cross-collar choke from mount','{}'::text[],array['RNC']::text[],array['Jordan','Nina']::text[],null,'training',null,'gi'),
('2026-02-06'::date,75,5,3,'Ironwood BJJ','Scissor sweep and hip bump chain',array['americana']::text[],array['kimura','guillotine']::text[],array['Nina','Alex']::text[],null,'training',null,'gi'),
('2026-02-07'::date,90,9,3,'Ironwood BJJ','Scissor sweep and hip bump chain',array['americana']::text[],array['triangle','armbar']::text[],array['Sam','Nina']::text[],null,'open_mat',null,'nogi'),
('2026-02-09'::date,75,4,3,'Ironwood BJJ',null,'{}'::text[],array['triangle']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-02-11'::date,60,6,3,'Ironwood BJJ','Cross-collar choke from mount',array['americana']::text[],array['kimura','armbar']::text[],array['Alex']::text[],'Need to drill the knee line escape, not think about it.','training',null,'gi'),
('2026-02-13'::date,60,4,3,'Ironwood BJJ',null,array['americana']::text[],array['armbar']::text[],array['Jordan','Sam']::text[],null,'training',null,'gi'),
('2026-02-16'::date,90,4,4,'Ironwood BJJ','Scissor sweep and hip bump chain',array['americana']::text[],array['guillotine','armbar']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-02-18'::date,75,6,3,'Ironwood BJJ','Cross-collar choke from mount','{}'::text[],array['armbar','kimura']::text[],array['Nina','Sam']::text[],'Kept leaving my arm in when I pass.','training',null,'gi'),
('2026-02-20'::date,75,4,3,'Ironwood BJJ','Mount escapes — bridge and roll, elbow-knee',array['armbar']::text[],array['armbar']::text[],array['Jordan','Alex']::text[],null,'training',null,'gi'),
('2026-02-23'::date,75,6,2,'Ironwood BJJ','Side control escapes — frame and shrimp',array['armbar']::text[],array['armbar','kimura']::text[],array['Theo','Nina']::text[],null,'training',null,'gi'),
('2026-02-25'::date,90,6,3,'Ironwood BJJ','Basic guard passing — knee slice',array['RNC']::text[],array['triangle','guillotine']::text[],array['Sam','Nina']::text[],'Gassed by round four.','training',null,'gi'),
('2026-02-27'::date,60,4,3,'Ironwood BJJ','Shrimping, technical stand-up, basic frames',array['americana']::text[],array['triangle']::text[],array['Nina']::text[],null,'training',null,'gi'),
('2026-03-02'::date,75,6,3,'Ironwood BJJ','Americana from side control','{}'::text[],array['armbar','triangle']::text[],array['Sam','Nina']::text[],null,'training',null,'gi'),
('2026-03-04'::date,75,4,2,'Ironwood BJJ','Basic guard passing — knee slice','{}'::text[],array['kimura']::text[],array['Jordan','Alex']::text[],'Jordan is a problem from the back.','training',null,'gi'),
('2026-03-06'::date,90,4,3,'Ironwood BJJ','Shrimping, technical stand-up, basic frames',array['armbar']::text[],array['kimura']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-03-07'::date,90,9,3,'Ironwood BJJ','Closed guard retention and hip escapes','{}'::text[],array['guillotine','armbar']::text[],array['Sam','Jordan']::text[],null,'open_mat',null,'nogi'),
('2026-03-09'::date,90,4,3,'Ironwood BJJ','Shrimping, technical stand-up, basic frames',array['kimura']::text[],array['armbar']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-03-12'::date,60,2,3,'Ironwood BJJ','Private with Coach Dev — guard passing posture','{}'::text[],'{}'::text[],array['Coach Dev']::text[],'Finally hit it in live rounds.','private',null,'gi'),
('2026-03-14'::date,180,3,5,'Grappling Industries NYC',null,array['americana','RNC','armbar']::text[],'{}'::text[],'{}'::text[],'Gold! Three matches, three finishes. Nerves were brutal before the first one.','competition','Gold — white adult, 3–0','gi'),
('2026-03-16'::date,75,5,3,'Ironwood BJJ','Side control escapes — frame and shrimp','{}'::text[],array['kimura','armbar']::text[],array['Nina','Alex']::text[],null,'training',null,'gi'),
('2026-03-18'::date,90,5,3,'Ironwood BJJ','Cross-collar choke from mount',array['RNC']::text[],array['guillotine']::text[],array['Nina','Jordan']::text[],null,'training',null,'gi'),
('2026-03-20'::date,75,5,2,'Ironwood BJJ','Scissor sweep and hip bump chain',array['americana']::text[],array['triangle','armbar']::text[],array['Alex','Nina']::text[],null,'training',null,'gi'),
('2026-03-23'::date,90,6,3,'Ironwood BJJ','Mount escapes — bridge and roll, elbow-knee',array['kimura']::text[],array['kimura']::text[],array['Nina','Jordan']::text[],null,'training',null,'gi'),
('2026-03-25'::date,75,4,3,'Ironwood BJJ',null,array['americana']::text[],array['armbar','kimura']::text[],array['Theo']::text[],null,'training',null,'gi'),
('2026-03-27'::date,75,5,3,'Ironwood BJJ','Americana from side control','{}'::text[],array['RNC','RNC']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-03-30'::date,60,6,3,'Ironwood BJJ','Basic guard passing — knee slice',array['americana']::text[],array['RNC','RNC']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-04-04'::date,90,8,3,'Ironwood BJJ',null,array['armbar']::text[],array['heel hook']::text[],array['Jordan','Nina','Sam','Alex']::text[],null,'open_mat',null,'nogi'),
('2026-04-10'::date,60,5,3,'Ironwood BJJ','Triangle setups from closed guard',array['RNC']::text[],array['armbar','armbar']::text[],array['Sam','Jordan']::text[],null,'training',null,'gi'),
('2026-04-13'::date,75,6,3,'Ironwood BJJ','Back control — seatbelt and the RNC finish',array['armbar']::text[],array['armbar','armbar']::text[],array['Alex','Theo']::text[],null,'training',null,'gi'),
('2026-04-20'::date,75,6,3,'Ironwood BJJ','Back control — seatbelt and the RNC finish',array['triangle','triangle']::text[],array['kimura','armbar']::text[],array['Alex','Jordan']::text[],null,'training',null,'gi'),
('2026-04-22'::date,60,5,3,'Ironwood BJJ',null,array['triangle']::text[],array['triangle']::text[],array['Nina','Jordan']::text[],null,'training',null,'gi'),
('2026-04-23'::date,60,2,2,'Ironwood BJJ','Private with Coach Dev — guard passing posture','{}'::text[],'{}'::text[],array['Coach Dev']::text[],null,'private',null,'gi'),
('2026-04-24'::date,75,5,3,'Ironwood BJJ',null,array['triangle']::text[],array['kimura']::text[],array['Theo','Alex']::text[],null,'training',null,'gi'),
('2026-04-25'::date,90,8,3,'Ironwood BJJ',null,array['RNC']::text[],array['heel hook','RNC','heel hook']::text[],array['Theo','Nina']::text[],null,'open_mat',null,'nogi'),
('2026-04-27'::date,90,4,3,'Ironwood BJJ','Guard retention vs the toreando',array['armbar']::text[],array['armbar']::text[],array['Theo','Nina']::text[],null,'training',null,'gi'),
('2026-04-29'::date,60,6,3,'Ironwood BJJ','Half guard — knee shield and the old school sweep',array['kimura']::text[],array['kimura','armbar']::text[],array['Sam']::text[],null,'training',null,'gi'),
('2026-05-01'::date,75,6,3,'Ironwood BJJ','Knee cut pass with the cross-face',array['triangle']::text[],array['kimura','kimura']::text[],array['Nina']::text[],'Hands too low — got snapped down twice.','training',null,'gi'),
('2026-05-02'::date,120,6,3,'Ironwood BJJ',null,array['armbar']::text[],array['armbar']::text[],array['Jordan','Sam']::text[],null,'open_mat',null,'nogi'),
('2026-05-04'::date,60,4,2,'Ironwood BJJ','Back control — seatbelt and the RNC finish','{}'::text[],'{}'::text[],array['Sam']::text[],null,'training',null,'gi'),
('2026-05-08'::date,60,5,3,'Ironwood BJJ','Guard retention vs the toreando','{}'::text[],array['armbar']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-05-11'::date,75,4,3,'Ironwood BJJ','Kimura trap from half guard',array['armbar']::text[],array['kimura']::text[],array['Nina','Jordan']::text[],null,'training',null,'gi'),
('2026-05-13'::date,90,4,2,'Ironwood BJJ','Kimura trap from half guard','{}'::text[],'{}'::text[],array['Theo']::text[],null,'training',null,'gi'),
('2026-05-16'::date,90,8,3,'Ironwood BJJ','Guard retention vs the toreando',array['kimura','kimura']::text[],array['triangle']::text[],array['Jordan']::text[],null,'open_mat',null,'nogi'),
('2026-05-18'::date,90,6,4,'Ironwood BJJ','Armbar from guard, hip angle details',array['armbar','RNC']::text[],array['heel hook']::text[],array['Theo']::text[],null,'training',null,'gi'),
('2026-05-20'::date,75,5,4,'Ironwood BJJ','Kimura trap from half guard',array['RNC']::text[],array['RNC','RNC']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-05-22'::date,75,5,3,'Ironwood BJJ','Takedowns — single leg, snap down to front headlock',array['RNC']::text[],array['heel hook']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-05-23'::date,90,8,3,'Ironwood BJJ','Back control — seatbelt and the RNC finish',array['armbar']::text[],array['armbar','armbar']::text[],array['Nina','Sam','Jordan']::text[],null,'open_mat',null,'nogi'),
('2026-05-25'::date,75,4,4,'Ironwood BJJ','Half guard — knee shield and the old school sweep',array['RNC']::text[],'{}'::text[],array['Sam','Jordan']::text[],null,'training',null,'gi'),
('2026-05-27'::date,75,4,3,'Ironwood BJJ','Kimura trap from half guard','{}'::text[],array['triangle']::text[],array['Jordan']::text[],'Tired week, low energy.','training',null,'gi'),
('2026-05-29'::date,75,6,4,'Ironwood BJJ','Armbar from guard, hip angle details',array['armbar','RNC']::text[],array['heel hook']::text[],array['Jordan','Alex']::text[],null,'training',null,'gi'),
('2026-05-30'::date,90,9,3,'Ironwood BJJ','Back control — seatbelt and the RNC finish',array['triangle']::text[],array['RNC','triangle']::text[],array['Alex','Jordan']::text[],null,'open_mat',null,'nogi'),
('2026-06-01'::date,75,5,2,'Ironwood BJJ','Half guard — knee shield and the old school sweep',array['RNC']::text[],array['RNC']::text[],array['Alex','Sam']::text[],null,'training',null,'gi'),
('2026-06-03'::date,60,5,2,'Ironwood BJJ','Knee cut pass with the cross-face',array['triangle']::text[],array['RNC','kimura']::text[],array['Jordan','Theo']::text[],'Need to drill the knee line escape, not think about it.','training',null,'gi'),
('2026-06-04'::date,60,2,3,'Ironwood BJJ','Private with Coach Dev — triangle details','{}'::text[],'{}'::text[],array['Coach Dev']::text[],null,'private',null,'gi'),
('2026-06-05'::date,90,6,3,'Ironwood BJJ','Guard retention vs the toreando',array['triangle']::text[],array['armbar']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-06-06'::date,90,9,3,'Ironwood BJJ',null,array['armbar']::text[],array['heel hook','heel hook']::text[],array['Nina','Theo']::text[],null,'open_mat',null,'nogi'),
('2026-06-08'::date,60,4,4,'Ironwood BJJ','Kimura trap from half guard',array['triangle','armbar']::text[],array['triangle']::text[],array['Theo']::text[],'Breathing stayed calm the whole session.','training',null,'gi'),
('2026-06-12'::date,75,6,4,'Ironwood BJJ','Triangle setups from closed guard',array['triangle']::text[],array['heel hook','triangle']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-06-13'::date,120,6,3,'Ironwood BJJ','Takedowns — single leg, snap down to front headlock','{}'::text[],array['armbar','triangle']::text[],array['Theo','Alex']::text[],'Tired week, low energy.','open_mat',null,'nogi'),
('2026-06-29'::date,75,6,2,'Ironwood BJJ','Armbar from guard, hip angle details',array['bow and arrow']::text[],array['armbar','kimura']::text[],array['Sam']::text[],null,'training',null,'gi'),
('2026-07-01'::date,90,5,4,'Ironwood BJJ','Triangle finishing — the angle and the shoulder walk',array['armbar','triangle','RNC']::text[],array['armbar']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-07-06'::date,75,4,3,'Ironwood BJJ',null,array['triangle']::text[],array['heel hook']::text[],array['Sam']::text[],'Finally hit it in live rounds.','training',null,'gi'),
('2026-07-08'::date,75,6,4,'Ironwood BJJ','Ashi garami entries (no-gi)',array['bow and arrow','triangle']::text[],array['heel hook']::text[],array['Sam','Jordan']::text[],null,'training',null,'gi'),
('2026-07-10'::date,75,4,4,'Ironwood BJJ','Heel hook defense — clearing the knee line',array['triangle','RNC']::text[],array['guillotine']::text[],array['Jordan','Nina']::text[],null,'training',null,'gi'),
('2026-07-13'::date,75,6,4,'Ironwood BJJ','Open mat — positional rounds from the back',array['RNC']::text[],array['armbar']::text[],array['Sam']::text[],null,'training',null,'gi'),
('2026-07-15'::date,75,6,4,'Ironwood BJJ','Bow and arrow from the back','{}'::text[],'{}'::text[],array['Sam','Jordan']::text[],null,'training',null,'gi'),
('2026-07-16'::date,60,2,3,'Ironwood BJJ','Private with Coach Dev — triangle details','{}'::text[],'{}'::text[],array['Coach Dev']::text[],null,'private',null,'gi'),
('2026-07-17'::date,75,5,4,'Ironwood BJJ','Open mat — positional rounds from the back',array['armbar']::text[],'{}'::text[],array['Jordan']::text[],'Breathing stayed calm the whole session.','training',null,'nogi'),
('2026-07-20'::date,75,5,4,'Ironwood BJJ','Front headlock to guillotine and anaconda',array['triangle','triangle']::text[],'{}'::text[],array['Jordan']::text[],'Passing felt effortless for once.','training',null,'gi'),
('2026-07-22'::date,60,6,4,'Ironwood BJJ','Open mat — positional rounds from the back',array['bow and arrow','triangle']::text[],array['heel hook']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-07-24'::date,75,6,3,'Ironwood BJJ','Bow and arrow from the back',array['bow and arrow']::text[],array['armbar']::text[],array['Alex']::text[],null,'training',null,'gi'),
('2026-07-31'::date,60,6,2,'Ironwood BJJ',null,'{}'::text[],array['heel hook']::text[],array['Jordan']::text[],'Gassed by round four.','training',null,'gi'),
('2026-08-03'::date,75,6,4,'Ironwood BJJ',null,array['triangle','triangle']::text[],array['kimura']::text[],array['Sam']::text[],null,'training',null,'gi'),
('2026-08-05'::date,75,6,4,'Ironwood BJJ','Open mat — positional rounds from the back',array['triangle']::text[],'{}'::text[],array['Alex','Sam']::text[],null,'training',null,'nogi'),
('2026-08-07'::date,75,6,4,'Ironwood BJJ','Front headlock to guillotine and anaconda',array['triangle','triangle']::text[],'{}'::text[],array['Sam','Theo']::text[],'Best rounds in weeks.','training',null,'gi'),
('2026-08-08'::date,120,9,3,'Ironwood BJJ','Heel hook defense — clearing the knee line',array['RNC']::text[],array['heel hook','heel hook']::text[],array['Sam','Theo','Alex','Nina']::text[],'Gassed by round four.','open_mat',null,'nogi'),
('2026-08-10'::date,75,5,3,'Ironwood BJJ','Open mat — positional rounds from the back',array['triangle']::text[],array['heel hook']::text[],array['Nina','Jordan']::text[],null,'training',null,'gi'),
('2026-08-15'::date,180,5,5,'Grappling Industries NYC',null,array['triangle','triangle','bow and arrow']::text[],array['armbar']::text[],'{}'::text[],'Bronze. Lost the semi to an armbar from top — same leak as always.','competition','Bronze — blue adult, 2–1','gi'),
('2026-08-19'::date,75,4,4,'Ironwood BJJ',null,array['RNC','RNC']::text[],array['heel hook']::text[],array['Jordan','Sam']::text[],'Best rounds in weeks.','training',null,'gi'),
('2026-08-27'::date,60,2,3,'Ironwood BJJ','Private with Coach Dev — guard passing posture','{}'::text[],'{}'::text[],array['Coach Dev']::text[],'Breathing stayed calm the whole session.','private',null,'gi'),
('2026-08-28'::date,90,4,4,'Ironwood BJJ','Knee cut to back take',array['armbar','bow and arrow']::text[],'{}'::text[],array['Sam']::text[],'Best rounds in weeks.','training',null,'gi'),
('2026-08-29'::date,120,9,4,'Ironwood BJJ',null,array['bow and arrow','triangle']::text[],'{}'::text[],array['Nina','Alex']::text[],'Felt sharp today.','open_mat',null,'nogi'),
('2026-08-31'::date,60,5,4,'Ironwood BJJ',null,array['RNC','bow and arrow']::text[],array['kimura']::text[],array['Jordan','Nina']::text[],null,'training',null,'gi'),
('2026-09-02'::date,60,4,4,'Ironwood BJJ','Knee cut to back take',array['armbar']::text[],'{}'::text[],array['Nina','Alex']::text[],'Best rounds in weeks.','training',null,'nogi'),
('2026-09-04'::date,90,5,4,'Ironwood BJJ','Knee cut to back take',array['triangle','bow and arrow']::text[],array['heel hook']::text[],array['Sam']::text[],'Finally hit it in live rounds.','training',null,'gi'),
('2026-09-07'::date,75,6,4,'Ironwood BJJ','Armbar defense from mount',array['triangle','armbar']::text[],array['kimura']::text[],array['Alex','Nina']::text[],null,'training',null,'gi'),
('2026-09-09'::date,75,4,5,'Ironwood BJJ','Knee cut to back take',array['triangle']::text[],'{}'::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-09-12'::date,90,9,4,'Ironwood BJJ','Knee cut to back take',array['armbar','triangle']::text[],array['heel hook']::text[],array['Jordan','Theo','Sam']::text[],null,'open_mat',null,'nogi'),
('2026-09-14'::date,60,5,3,'Ironwood BJJ','Ashi garami entries (no-gi)',array['RNC']::text[],'{}'::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-09-16'::date,90,5,3,'Ironwood BJJ','Ashi garami entries (no-gi)',array['bow and arrow','armbar']::text[],array['heel hook']::text[],array['Sam','Jordan']::text[],'Best rounds in weeks.','training',null,'gi'),
('2026-09-18'::date,90,5,4,'Ironwood BJJ','Triangle finishing — the angle and the shoulder walk',array['bow and arrow','armbar']::text[],'{}'::text[],array['Nina']::text[],null,'training',null,'nogi'),
('2026-09-19'::date,120,6,4,'Ironwood BJJ','Front headlock to guillotine and anaconda',array['triangle','armbar']::text[],array['heel hook']::text[],array['Jordan','Alex']::text[],null,'open_mat',null,'nogi'),
('2026-09-21'::date,90,5,3,'Ironwood BJJ','Heel hook defense — clearing the knee line',array['bow and arrow']::text[],array['armbar','heel hook']::text[],array['Theo']::text[],null,'training',null,'gi'),
('2026-09-23'::date,90,5,4,'Ironwood BJJ','Knee cut to back take',array['triangle','RNC','triangle']::text[],array['triangle']::text[],array['Jordan']::text[],null,'training',null,'gi'),
('2026-09-25'::date,75,4,4,'Ironwood BJJ','Bow and arrow from the back',array['bow and arrow','triangle']::text[],array['kimura']::text[],array['Jordan']::text[],null,'training',null,'nogi'),
('2026-09-30'::date,60,6,3,'Ironwood BJJ','Front headlock to guillotine and anaconda',array['triangle']::text[],array['armbar','armbar']::text[],array['Sam','Jordan']::text[],'Jordan is a problem from the back.','training',null,'gi'),
('2026-10-02'::date,75,6,3,'Ironwood BJJ','Open mat — positional rounds from the back',array['armbar','bow and arrow']::text[],array['heel hook','heel hook']::text[],array['Jordan']::text[],'Passing felt effortless for once.','training',null,'gi'),
('2026-10-03'::date,90,7,4,'Ironwood BJJ','Half guard to back take',array['RNC','RNC']::text[],array['triangle']::text[],array['Sam','Jordan']::text[],'Felt sharp today.','open_mat',null,'nogi'),
('2026-10-05'::date,60,5,4,'Ironwood BJJ','Bow and arrow from the back',array['triangle','armbar']::text[],array['heel hook']::text[],array['Nina','Jordan']::text[],'Finally hit it in live rounds.','training',null,'gi'),
('2026-10-08'::date,60,2,3,'Ironwood BJJ','Private with Coach Dev — back attacks','{}'::text[],'{}'::text[],array['Coach Dev']::text[],null,'private',null,'gi')
) as v(trained_on,duration_min,rounds,feel,gym,drilled,subs_hit,subs_caught_in,partners,note,session_type,comp_result,attire)
where not exists (select 1 from public.sessions where user_id='00000000-0000-4000-a000-000000000001');

-- Jordan reacts to a spread of sessions and leaves a few comments.
insert into public.session_reactions (session_id,user_id,emoji,created_at)
select s.id,'00000000-0000-4000-a000-000000000002', case when row_number() over (order by s.trained_on) % 3 = 0 then '👊' else '🔥' end, s.trained_on::timestamptz + interval '20 hours'
from public.sessions s where s.user_id='00000000-0000-4000-a000-000000000001' and (extract(day from s.trained_on)::int % 4 = 1 or s.session_type='competition')
on conflict do nothing;
insert into public.session_comments (session_id,user_id,body,created_at)
select s.id,'00000000-0000-4000-a000-000000000002', c.body, s.trained_on::timestamptz + interval '21 hours'
from (values
 ('2026-03-14','Three finishes in your first comp. Nobody does that.'),
 ('2026-04-11','Blue belt!! Took you long enough 😄'),
 ('2026-08-15','That semi was closer than the result. Keep the elbow in.'),
 ('2026-09-26','Second stripe. The triangle is officially a weapon now.'),
 ('2026-10-03','I am never rolling no-gi with you again.')
) as c(day,body)
join public.sessions s on s.user_id='00000000-0000-4000-a000-000000000001' and s.trained_on=c.day::date
where not exists (select 1 from public.session_comments x where x.session_id=s.id and x.user_id='00000000-0000-4000-a000-000000000002');

-- Everything /demo needs in one definer call, readable without an account.
create or replace function public.demo_snapshot()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'date_of_birth' - 'visit_count' - 'last_seen_on' - 'feedback_dismissed_at' - 'notification_prefs' from public.profiles p where p.id='00000000-0000-4000-a000-000000000001'),
    'sessions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.trained_on desc, s.created_at desc),'[]'::jsonb) from public.sessions s where s.user_id='00000000-0000-4000-a000-000000000001'),
    'belt_history', (select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) from public.belt_history b where b.user_id='00000000-0000-4000-a000-000000000001'),
    'reactions', (select coalesce(jsonb_agg(jsonb_build_object('session_id',r.session_id,'emoji',r.emoji,'count',r.n)),'[]'::jsonb) from (select session_id, emoji, count(*) n from public.session_reactions where session_id in (select id from public.sessions where user_id='00000000-0000-4000-a000-000000000001') group by 1,2) r),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'session_id',c.session_id,'body',c.body,'created_at',c.created_at,'author',jsonb_build_object('display_name',p.display_name,'first_name',p.first_name,'last_name',p.last_name,'belt',p.belt,'avatar_url',p.avatar_url)) order by c.created_at),'[]'::jsonb) from public.session_comments c join public.profiles p on p.id=c.user_id where c.session_id in (select id from public.sessions where user_id='00000000-0000-4000-a000-000000000001')),
    'followers', (select count(*) from public.follows where followee_id='00000000-0000-4000-a000-000000000001' and status='accepted'),
    'following', (select count(*) from public.follows where follower_id='00000000-0000-4000-a000-000000000001' and status='accepted')
  );
$$;
grant execute on function public.demo_snapshot() to anon, authenticated;

