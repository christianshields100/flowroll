import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Docs — FlowRoll",
  description: "The FlowRoll REST API: your training data, programmable.",
};

const BASE = "https://www.flowroll.xyz/api/v1";

// Public documentation for the /api/v1 REST API. Keys are created in
// Settings; auth is a simple bearer header.
export default function DevelopersPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-paper-line">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg tracking-tightish hover:text-accent transition"
          >
            flowroll
          </Link>
          <Link
            href="/login"
            className="text-sm text-ink-dim hover:text-accent transition"
          >
            Sign in
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
          Developers
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tightish">
          The FlowRoll API
        </h1>
        <p className="mt-3 text-ink-dim leading-relaxed max-w-xl">
          Your training data, programmable. Pull your sessions and stats into
          scripts, spreadsheets, or agents — or log sessions from anywhere.
        </p>
        <div className="belt-rule mt-6 max-w-sm" />

        <div className="mt-10 space-y-10 text-ink-dim leading-relaxed">
          <Section title="Authentication">
            <p>
              Create an API key in{" "}
              <Link href="/settings" className="text-accent hover:underline">
                Settings → Developer
              </Link>{" "}
              and send it as a bearer token. Keys only access{" "}
              <b>your own data</b> — sessions shared with you by others are
              not exposed. Rate limit: 1,000 requests per key per day.
            </p>
            <Code>{`curl ${BASE}/me \\
  -H "Authorization: Bearer frk_YOUR_KEY"`}</Code>
          </Section>

          <Section title="GET /api/v1/me">
            <p>Your profile: name, belt, stripes, home gym.</p>
            <Code>{`{
  "profile": {
    "id": "…", "display_name": "…",
    "first_name": "…", "last_name": "…",
    "belt": "blue", "stripes": 2,
    "home_gym_name": "…", "created_at": "…"
  }
}`}</Code>
          </Section>

          <Section title="GET /api/v1/sessions">
            <p>
              Your sessions, newest first. Optional query params:{" "}
              <Mono>from</Mono> / <Mono>to</Mono> (YYYY-MM-DD),{" "}
              <Mono>limit</Mono> (max 200), <Mono>offset</Mono>.
            </p>
            <Code>{`curl "${BASE}/sessions?from=2026-06-01&limit=10" \\
  -H "Authorization: Bearer frk_YOUR_KEY"`}</Code>
            <p className="mt-2">
              Each session has <Mono>trained_on</Mono>,{" "}
              <Mono>duration_min</Mono>, <Mono>rounds</Mono>, <Mono>gym</Mono>,{" "}
              <Mono>feel</Mono> (1–5), <Mono>subs_hit</Mono>,{" "}
              <Mono>subs_caught_in</Mono>, <Mono>partners</Mono>,{" "}
              <Mono>drilled</Mono>, <Mono>note</Mono>, <Mono>media_urls</Mono>.
            </p>
            <p className="mt-2">
              Fetch one by id: <Mono>GET /api/v1/sessions/:id</Mono>
            </p>
          </Section>

          <Section title="POST /api/v1/sessions">
            <p>
              Log a session. Requires a key created with <b>allow writes</b>.
              Required: <Mono>trained_on</Mono>, <Mono>duration_min</Mono>.
            </p>
            <Code>{`curl -X POST ${BASE}/sessions \\
  -H "Authorization: Bearer frk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trained_on": "2026-07-14",
    "duration_min": 90,
    "rounds": 6,
    "feel": 4,
    "subs_hit": ["armbar"],
    "note": "logged via the API"
  }'`}</Code>
          </Section>

          <Section title="GET /api/v1/stats">
            <p>
              Lifetime totals, current streak, per-submission scorecard, and
              weekly volume — the same numbers as your dashboard.
            </p>
            <Code>{`{
  "totals": { "total_sessions": 42, "total_min": 3780, … },
  "streak": 3,
  "submissions": [ { "name": "armbar", "hit": 9, "caught": 2, … } ],
  "weekly_volume": [ { "week_start": "2026-07-06", "mat_min": 270, … } ]
}`}</Code>
          </Section>

          <Section title="Errors">
            <p>
              JSON with an <Mono>error</Mono> field. <Mono>401</Mono> missing
              or invalid key · <Mono>403</Mono> missing scope ·{" "}
              <Mono>429</Mono> daily limit reached · <Mono>400</Mono> bad
              input. Revoke a leaked key instantly in Settings.
            </p>
          </Section>
        </div>

        <div className="mt-12">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
          >
            ← Back to FlowRoll
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl tracking-tightish text-ink">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 rounded-sm bg-paper-raised border border-paper-line p-4 overflow-x-auto">
      <code className="font-mono text-[12px] leading-relaxed text-ink-dim whitespace-pre">
        {children}
      </code>
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[12px] bg-paper-raised border border-paper-line rounded-sm px-1.5 py-0.5">
      {children}
    </code>
  );
}
