# FlowRoll

A BJJ training log. Log what you rolled, watch your mat time and submissions
trend, follow training partners and see what they're doing.

Built for one user first, but multi-user from day one.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** — Postgres + magic-link & Google auth + Row-Level Security
- **`@supabase/ssr`** for browser / server / middleware clients
- **Recharts** for the dashboard charts
- **Tailwind** with a custom belt-color theme
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
  submissions hit / caught in, a 1-5 "how it felt", a free-text note.
- **`/dashboard`** — streak, lifetime totals, weekly mat-time chart, weekly
  rounds chart, submission ledger (hit vs caught-in toggle), searchable notes.
- **`/feed`** — find training partners by name, follow / unfollow, see their
  recent sessions. Read-only.

## Not in v1 (intentionally)

These are out of scope so we can ship. Tracked for later:

- Comments / reactions on feed sessions
- Leaderboards (mat hours, sub counts, etc.)
- Whoop / Garmin / Apple Health integration
- Photo & video attachments
- Per-session editing & deletion UI (DB supports it via RLS, no UI yet)
- Notifications (email digest, push)
- Profile page with full session history for someone you follow

## Architecture notes

- **Auth lives in middleware.** Every request to `/dashboard`, `/log`, `/feed`
  refreshes the session and gates unauthenticated users back to `/login`.
- **RLS is the access boundary.** The app never gates "can I read this row?"
  in code — Postgres does. Sessions are readable by the owner or anyone who
  follows them. Profiles are readable by all authenticated users. Inserts and
  deletes are owner-only.
- **A trigger on `auth.users`** creates a `public.profiles` row on signup,
  pulling `display_name` from OAuth metadata or the email local-part.
- **Server actions** handle all writes (`logSession`, `follow`, `unfollow`)
  so we get the cookie-bound Supabase client and automatic revalidation.
- **Stats are computed in `lib/stats.ts`** as pure functions, so they're
  trivially testable and the dashboard page stays a thin server component.

## Project layout

```
app/
  auth/callback/         OAuth & magic-link return handler
  auth/signout/          POST /auth/signout → clears session
  dashboard/             Charts, ledger, notes search
  feed/                  Follows + timeline
  log/                   Session form + server action
  login/                 Magic-link & Google sign-in
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
