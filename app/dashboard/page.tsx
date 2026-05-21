import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import {
  currentStreak,
  sessionTotals,
  weeklyBuckets,
  type SessionRow,
} from "@/lib/stats";
import { MatTimeChart, RoundsChart } from "./WeeklyVolumeChart";
import { SubmissionLedger } from "./SubmissionLedger";
import { StreakTile } from "./StreakTile";
import { NotesSearch } from "./NotesSearch";

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
      "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, feel, gym, drilled, note, created_at",
    )
    .eq("user_id", user!.id)
    .order("trained_on", { ascending: false });

  const rows = (sessions ?? []) as SessionRow[];
  const buckets = weeklyBuckets(rows, 8);
  const streak = currentStreak(rows);
  const totals = sessionTotals(rows);
  const empty = rows.length === 0;

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

          <section>
            <SectionHeading
              tag="Volume"
              title="The last 8 weeks"
              hint="Time on the mat and rounds rolled, week by week"
            />
            <div className="mt-5 grid lg:grid-cols-2 gap-6">
              <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
                <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
                  Mat time (min)
                </p>
                <div className="mt-3">
                  <MatTimeChart data={buckets} />
                </div>
              </div>
              <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
                <p className="font-mono text-[10px] uppercase tracking-dojo text-ink">
                  Rounds rolled
                </p>
                <div className="mt-3">
                  <RoundsChart data={buckets} />
                </div>
              </div>
            </div>
          </section>

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

