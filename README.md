# FlowRoll

A BJJ training log. Log what you rolled, watch your mat time and submissions
trend, get feedback from an AI coach, follow training partners and see what they're doing.

Built for one user first, but multi-user from day one.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** — Postgres + magic-link & Google auth + Row-Level Security +
  Storage (the `avatars` bucket for profile photos)
- **`@supabase/ssr`** for browser / server / middleware clients
- **Recharts** for the dashboard charts
- **Anthropic SDK** (Claude) for the Coach chatbot and weekly recaps
- **react-markdown** for rendering Coach replies
- **Tailwind** with a custom belt-color theme
- **Vitest** for unit tests (`npm test`) — see `lib/stats.test.ts`
- Deployed on **Vercel**

## Local setup

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

Then open <http://localhost:3000>.

### Required env vars

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your publishable / anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # used by magic-link redirects
ANTHROPIC_API_KEY=sk-ant-...                 # server-only — powers the Coach chatbot
GOOGLE_PLACES_API_KEY=...                     # server-only, optional — gym autocomplete (Places API New)
```

### Supabase setup

1. Create a new Supabase project.
2. Open the SQL editor and run [`supabase_schema.sql`](./supabase_schema.sql) —
   it's idempotent, you can re-run it.
3. **Authentication → Providers** → enable **Email** (magic link) and **Google**.
4. **Authentication → URL Configuration** → add your dev URL (and later your
   Vercel URL) to "Site URL" and "Redirect URLs".

## What's in v1

- **Magic-link + Google auth** — auto-creates a profile on first sign-in.
- **`/log`** — log a session: date, duration, rounds, gym, what you drilled,
  submissions hit / caught in, training partners, a 1-5 "how it felt", a
  free-text note. Submissions and partners use a chip autocomplete seeded from
  a canonical list plus your own past entries, so names stay normalized. The
  **gym** uses a Google Places autocomplete (`GymPicker`) and stores the
  place's `place_id` so gyms are standardized for cross-gym analytics (free-text
  fallback if the Places key isn't set). `/log?edit=<id>` reuses the same form.
- **`/dashboard`** — streak, lifetime totals, a Daily / Weekly / Monthly toggle
  over the mat-time, rounds, and feel-vs-volume charts (last 14 days / 8 weeks /
  6 months), submission ledger (hit vs caught-in toggle), top training partners,
  searchable notes with inline edit / delete, and a Coach-generated weekly recap.
- **`/feed`** — find training partners by name, follow / unfollow, see their
  recent sessions. **Instagram-style privacy:** toggle your account public or
  private. Public = anyone can follow you instantly. Private = follows become
  requests you Accept / Decline; existing followers keep access; you can Remove
  followers. A pending request grants no visibility. Profiles stay discoverable
  in search (so people can request), but a private account's sessions are
  hidden from everyone who isn't an accepted follower — enforced in Postgres
  RLS, not app code.
- **`/u/[id]`** — profile pages. Avatar (upload your own photo to Supabase
  Storage, or a generated monogram until you do), belt rank, clickable
  follower / following counts that open `/u/[id]/followers` and `/following`
  list pages, session/mat-time/rounds stats, and recent sessions. Reach your
  own profile from the header avatar. A private account viewed by a non-follower
  shows a locked state and locked lists — enforced by RLS + SECURITY DEFINER
  functions, not page code.
- **`/chat`** — "Coach", an AI chatbot (Claude) that answers questions about
  your notes and full log history. Scope-locked to BJJ and your own data — it
  declines anything off-topic. Conversations persist across reloads, render
  markdown, and the training-log context is prompt-cached across turns. Coach
  can also **web-search** for instructional videos/articles (server-side
  `web_search` tool) — locked to BJJ topics, returns real cited links. Capped at
  50 messages/user/day (tamper-proof `check_and_bump_chat_quota` RPC) so one
  account can't run up the API bill.
- **PWA** — installable to a phone home screen (manifest + icons); mobile-tuned
  header and layout for logging mat-side.

## Not in v1 (intentionally)

These are out of scope so we can ship. Tracked for later:

- Comments / reactions on feed sessions
- Leaderboards (mat hours, sub counts, etc.)
- Whoop / Garmin / Apple Health integration
- Photo & video attachments
- Notifications (email digest, push)
- Follower / following counts on profiles (needs a definer count to respect RLS)

## Architecture notes

- **Auth lives in middleware.** Every request to `/dashboard`, `/log`, `/feed`,
  `/chat` refreshes the session and gates unauthenticated users back to `/login`.
- **RLS is the access boundary.** The app never gates "can I read this row?"
  in code — Postgres does. Sessions are readable by the owner or an **accepted**
  follower (a `follows.status = 'accepted'` row). Profiles are readable by all
  authenticated users (needed for discovery/search). A DB trigger sets a new
  follow's status from the target's `is_private` flag — pending for private,
  accepted for public — so a follower can't smuggle in `status='accepted'`
  against a private account. The followee can accept a request or remove a
  follower via their own update/delete policies. Inserts/deletes are
  ownership-scoped.
- **A trigger on `auth.users`** creates a `public.profiles` row on signup,
  pulling `display_name` from OAuth metadata or the email local-part.
- **Server actions** handle all writes (`logSession`, `updateSession`,
  `deleteSession`, `follow`, `unfollow`, `clearConversation`) so we get the
  cookie-bound Supabase client and automatic revalidation.
- **Stats are computed in `lib/stats.ts`** as pure functions with an injectable
  "today", so they're unit-tested in `lib/stats.test.ts` and the dashboard page
  stays a thin server component.
- **Coach persists turns to `chat_messages`** and prompt-caches the system +
  training-log blocks; weekly recaps are cached per (user, week) in
  `weekly_recaps` and only regenerated when a new session lands.

## Project layout

```
app/
  auth/callback/         OAuth & magic-link return handler
  auth/signout/          POST /auth/signout → clears session
  api/chat/              Coach chatbot API (auth + log context + Claude stream)
  api/recap/             Weekly recap generation (cached per user/week)
  chat/                  Coach chat UI + persistence
  dashboard/             Charts, feel trend, ledger, partners, recap, notes
  feed/                  Follows + timeline
  log/                   Session form (create + edit) + server actions
  login/                 Magic-link & Google sign-in
  manifest.ts            PWA manifest
components/TagInput.tsx  Chip autocomplete (submissions, partners)
lib/submissions.ts       Canonical submission names for autocomplete
  error.tsx              Global error boundary
  not-found.tsx          404
  loading.tsx            Route-transition skeleton
components/AppShell.tsx  Header + nav for signed-in routes
lib/supabase/            Browser / server client factories
lib/stats.ts             Pure stat helpers (streak, weekly buckets, totals)
middleware.ts            Auth refresh + route gating
supabase_schema.sql      Tables, RLS, trigger
```

## Deployment

Push to GitHub, import in Vercel, set the three env vars above (with
`NEXT_PUBLIC_SITE_URL` pointing at the Vercel URL), and add that URL to
Supabase's allowed redirect list and to the Google OAuth client's authorized
redirect URIs.
