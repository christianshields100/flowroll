import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import {
  currentStreak,
  periodBuckets,
  sessionTotals,
  type SessionRow,
} from "@/lib/stats";
import { VolumeViews } from "./VolumeViews";
import { SubmissionLedger } from "./SubmissionLedger";
import { StreakTile } from "./StreakTile";
import { NotesSearch } from "./NotesSearch";
import { WeeklyRecap } from "./WeeklyRecap";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, belt, stripes")
    .eq("id", user!.id)
    .single();

  // Pull all your sessions, newest first. One user's history is small.
  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, created_at",
    )
    .eq("user_id", user!.id)
    .order("trained_on", { ascending: false });

  const rows = (sessions ?? []) as SessionRow[];
  // Pre-compute all three views so the client toggle switches instantly.
  const daily = periodBuckets(rows, "day");
  const weekly = periodBuckets(rows, "week");
  const monthly = periodBuckets(rows, "month");
  const streak = currentStreak(rows);
  const totals = sessionTotals(rows);
  const empty = rows.length === 0;

  // Tally partners across all sessions for the "most rolled with" list.
  const partnerCounts = new Map<string, { name: string; count: number }>();
  for (const s of rows) {
    for (const p of s.partners ?? []) {
      const key = p.toLowerCase();
      const cur = partnerCounts.get(key) ?? { name: p, count: 0 };
      cur.count += 1;
      partnerCounts.set(key, cur);
    }
  }
  const topPartners = Array.from(partnerCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <AppShell profile={profile} active="dashboard">
      <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
        Dashboard
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tightish">
        {empty
          ? "Step on the mat."
          : `Welcome to the mat${profile?.display_name ? `, ${profile.display_name}` : ""}.`}
      </h1>
      <div className="belt-rule mt-6 max-w-sm" />

      {empty ? (
        <div className="mt-10 rounded-sm bg-paper-raised border border-paper-line p-8 max-w-xl">
          <p className="font-display text-xl tracking-tightish">
            No sessions yet.
          </p>
          <p className="mt-2 text-ink-dim">
            Log your first roll and your stats will start filling in here —
            weekly mat time, submissions, streak, searchable notes.
          </p>
          <a
            href="/log"
            className="mt-6 inline-block bg-accent text-paper px-5 py-2.5 rounded-sm font-medium hover:bg-accent-deep transition"
          >
            Log a session →
          </a>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <StreakTile streak={streak} totals={totals} />

          <WeeklyRecap />

          <VolumeViews daily={daily} weekly={weekly} monthly={monthly} />

          <section className="grid lg:grid-cols-2 gap-6">
            <div>
              <SectionHeading
                tag="Ledger"
                title="Submissions"
                hint="Tallies across every session"
              />
              <div className="mt-5 rounded-sm bg-paper-raised border border-paper-line p-5">
                <SubmissionLedger sessions={rows} />
              </div>

              {topPartners.length > 0 && (
                <div className="mt-6">
                  <SectionHeading
                    tag="Circle"
                    title="Training partners"
                    hint="Who you've rolled with most"
                  />
                  <ul className="mt-5 rounded-sm bg-paper-raised border border-paper-line p-5 space-y-2">
                    {topPartners.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="text-sm text-ink">{p.name}</span>
                        <span className="font-mono text-[11px] num text-ink-dim">
                          {p.count} {p.count === 1 ? "session" : "sessions"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <SectionHeading
                tag="Memory"
                title="Notes"
                hint="Find anything you've drilled or noted"
              />
              <div className="mt-5">
                <NotesSearch sessions={rows} />
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function SectionHeading({
  tag,
  title,
  hint,
}: {
  tag: string;
  title: string;
  hint: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
        {tag}
      </p>
      <h2 className="mt-1 font-display text-2xl tracking-tightish">{title}</h2>
      <p className="mt-1 text-sm text-ink-mute">{hint}</p>
    </div>
  );
}

