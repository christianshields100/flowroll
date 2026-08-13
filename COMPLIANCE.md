# FlowRoll Compliance Summary

Eight legal/compliance items audited and remediated on 2026-08-13. No paid
subscriptions exist, so billing-related obligations don't apply. This is
engineering hardening, not legal review — the privacy policy should get a
lawyer's sanity check before any commercial push.

## 1. Privacy policy — ✅ fixed

Was: a thin policy at `/privacy`, unreachable except by direct URL.
Now: rewritten from the audited data practices ([app/privacy/page.tsx](app/privacy/page.tsx)) with
effective date, full collection inventory, legal bases, retention windows,
user rights (access/export/correction/deletion), children's policy (13+
minimum), business-transfer and legal-request language. Linked from a new
site footer on every signed-in page ([components/SiteFooter.tsx](components/SiteFooter.tsx),
rendered by `AppShell`) and the landing page footer.

## 2. Data-collection disclosure — ✅ fixed

The policy explicitly enumerates every category the code collects: account
(email, name, DoB, belt, photo, home gym), training data + media, social
activity, Coach conversations, WHOOP health data (opt-in), feedback
submissions, the daily visit counter + hosting server logs, and hashed API
keys. It also states what we *don't* run: analytics SDKs, ad trackers,
pixels.

## 3. AI disclosure — ✅ fixed

Policy names Anthropic (Claude) as the provider, states that chat messages
and training context are sent to Anthropic's API, that conversations are
stored in our DB until cleared or account deletion, that Anthropic retains
API data up to ~30 days for abuse monitoring, and that commercial API data
is not used for model training (per Anthropic's commercial terms).

## 4. Third-party disclosure — ✅ fixed

All processors listed by name + purpose: Supabase, Anthropic, Vercel, WHOOP,
Photon/Komoot (gym search), Resend (email), Sentry (when enabled), YouTube/
Google (when enabled). Business-transfer and legal-request notes included.

## 5. Deletion of user uploads — ✅ fixed

- **Account deletion**: in-app, self-serve, immediate. Settings → Danger
  zone ([app/settings/DangerZone.tsx](app/settings/DangerZone.tsx)) with typed
  confirmation → `delete_my_account()` SECURITY DEFINER RPC
  ([supabase_schema.sql](supabase_schema.sql) v12) deletes the user's storage objects
  (both buckets) and the `auth.users` row; every table cascades from it.
  Synchronous — no queue, no retention window beyond encrypted backups
  (≤90 days), as stated in the policy.
- **Session deletion**: `deleteSession` ([app/log/actions.ts](app/log/actions.ts)) now removes the
  session's storage objects before the row (previously orphaned them).
- **In-form removal**: `MediaUploader` already best-effort removes objects.

## 6. Storage bucket not public — ✅ fixed

Was: `session-media` created `public = true` with an explicit public-read
policy — anyone with an object URL could fetch users' photos/videos,
including media on private accounts.
Now (v12): bucket `public = false`, public-read policy dropped; sessions
store bare object paths; media is served via **1-hour signed URLs** minted
server-side ([components/SessionMedia.tsx](components/SessionMedia.tsx)) and client-side for the
uploader's own previews. Existing rows were migrated from URLs to paths.
Verification: `node scripts/check-bucket-access.mjs` — an unauthenticated
request to the public object route now gets 400 `Bucket not found` (PASS).

Two deliberate scope notes: **avatars stay public** (profile pictures shown
on public profiles — disclosed in the policy), and signed-URL minting is
allowed to any *signed-in* user (paths are unguessable and only distributed
through RLS-gated session rows); the fixed exposure is the unauthenticated
public internet.

## 7. No fake testimonials — ✅ clean (nothing to fix)

Swept all user-facing strings for testimonials, reviews, ratings, user
counts, "as seen in" logos, endorsements: none exist. The landing page's
hardcoded demo stats card was already removed in July 2026.

## 8. AI self-harm/crisis response — ✅ fixed

- **Detection layer** ([lib/safety.ts](lib/safety.ts)): phrase-based crisis classifier runs on
  every Coach message *before* the model call; a match returns the crisis
  resource response (988 Suicide & Crisis Lifeline, Crisis Text Line
  741741, findahelpline.com) deterministically. Persisted to the
  conversation like any turn.
- **System prompt** ([app/api/chat/route.ts](app/api/chat/route.ts)): safety section overriding all
  other instructions — empathetic crisis response with resources, never
  harmful guidance, and no medical diagnosis (injuries → see a doctor).
- **Disclaimer**: "Coach is AI-generated and isn't medical advice." shown
  under the chat composer ([app/chat/ChatPanel.tsx](app/chat/ChatPanel.tsx)).
- **Tests** ([lib/safety.test.ts](lib/safety.test.ts)): 24 cases — crisis phrasings trigger, BJJ
  gym talk ("killing it on the mat", "my cardio died") does not, and the
  response contains the 988/741741 resources.

## Verification commands

```bash
npm test                              # unit tests incl. crisis classifier
node scripts/check-bucket-access.mjs  # bucket must reject unauthenticated reads
```
