import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import {
  currentStreak,
  isoDate,
  periodBuckets,
  sessionTotals,
  submissionStats,
  weekStart,
  type SessionRow,
} from "@/lib/stats";
import { StudyShelf } from "./StudyShelf";
import {
  searchStudyVideos,
  youtubeConfigured,
  type StudyVideo,
} from "@/lib/youtube";
import { VolumeViews } from "./VolumeViews";
import { SubmissionLedger } from "./SubmissionLedger";
import { StreakTile } from "./StreakTile";
import { NotesSearch } from "./NotesSearch";
import { WeeklyRecap } from "./WeeklyRecap";
import { WhoopInsights } from "./WhoopInsights";
import { WhoopNudges } from "./WhoopNudges";
import {
  maybeSyncWhoop,
  whoopConnected,
  whoopDays,
  whoopUnloggedWorkouts,
  type WhoopNudge,
} from "@/lib/whoop";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name, belt, stripes, avatar_url")
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

  // --- WHOOP insights (owner-only, private view) ---
  const hasWhoop = await whoopConnected(supabase, user!.id);
  let whoopNudges: WhoopNudge[] = [];
  const feelRecovery: { recovery: number; feel: number }[] = [];
  let strainVolume: { label: string; matMin: number; strain: number | null }[] =
    [];
  let avgFeelHighRecovery: number | null = null;
  let avgFeelLowRecovery: number | null = null;
  if (hasWhoop) {
    await maybeSyncWhoop(user!.id);
    whoopNudges = await whoopUnloggedWorkouts(supabase, user!.id);
    const days = await whoopDays(supabase, user!.id);
    const recByDay = new Map(
      days
        .filter((d) => d.recovery_score != null)
        .map((d) => [d.day, d.recovery_score as number]),
    );
    const strainByDay = new Map(
      days
        .filter((d) => d.day_strain != null)
        .map((d) => [d.day, d.day_strain as number]),
    );

    // Feel vs. recovery: one point per session that has a recovery score.
    const hi: number[] = [];
    const lo: number[] = [];
    for (const s of rows) {
      const rec = recByDay.get(s.trained_on);
      if (rec == null) continue;
      feelRecovery.push({ recovery: Math.round(rec), feel: s.feel });
      if (rec >= 70) hi.push(s.feel);
      if (rec < 50) lo.push(s.feel);
    }
    const avg = (a: number[]) =>
      a.length ? a.reduce((n, x) => n + x, 0) / a.length : null;
    avgFeelHighRecovery = avg(hi);
    avgFeelLowRecovery = avg(lo);

    // Strain vs. mat time, last 8 weeks. Mat minutes summed per week; strain
    // averaged over that week's days that have a strain value.
    const weeks: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const ws = weekStart(new Date(now.getTime() - i * 7 * 86400000));
      weeks.push({
        key: isoDate(ws),
        label: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
    }
    strainVolume = weeks.map(({ key, label }) => {
      const wsDate = new Date(key + "T00:00:00");
      const weekEnd = new Date(wsDate.getTime() + 7 * 86400000);
      let matMin = 0;
      for (const s of rows) {
        const d = new Date(s.trained_on + "T00:00:00");
        if (d >= wsDate && d < weekEnd) matMin += s.duration_min;
      }
      const strains: number[] = [];
      strainByDay.forEach((st, day) => {
        const d = new Date(day + "T00:00:00");
        if (d >= wsDate && d < weekEnd) strains.push(st);
      });
      const strain = strains.length
        ? Math.round((strains.reduce((n, x) => n + x, 0) / strains.length) * 10) / 10
        : null;
      return { label, matMin, strain };
    });
  }

  // --- Study shelves (YouTube; ships dark until YOUTUBE_API_KEY is set) ---
  let studyShelves: { tag: string; title: string; videos: StudyVideo[] }[] =
    [];
  if (youtubeConfigured() && rows.length > 0) {
    const subs = submissionStats(rows);
    const nemesis = subs
      .filter((s) => s.caught > 0)
      .sort((a, b) => b.caught - a.caught || a.net - b.net)[0];
    const sharpest = subs
      .filter((s) => s.hit > 0)
      .sort((a, b) => b.hit - a.hit || b.net - a.net)[0];
    const wants: { tag: string; title: string; query: string }[] = [];
    if (nemesis)
      wants.push({
        tag: "Nemesis",
        title: `Escaping the ${nemesis.name} (caught ${nemesis.caught}×)`,
        query: `${nemesis.name} escape bjj`,
      });
    if (sharpest && sharpest.name !== nemesis?.name)
      wants.push({
        tag: "Weapon",
        title: `Sharpening your ${sharpest.name} (${sharpest.hit} finishes)`,
        query: `${sharpest.name} details bjj`,
      });
    studyShelves = await Promise.all(
      wants.map(async (w) => ({
        tag: w.tag,
        title: w.title,
        videos: await searchStudyVideos(supabase, w.query, 4),
      })),
    );
  }

  return (
    <AppShell profile={profile} active="dashboard">
      <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
        Dashboard
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tightish">
        {empty
          ? "Step on the mat."
          : `Welcome to the mat${
              profile?.first_name?.trim()
                ? `, ${profile.first_name.trim()}`
                : profile?.display_name
                  ? `, ${profile.display_name}`
                  : ""
            }.`}
      </h1>
      <div className="belt-rule mt-6 max-w-sm" />

      {whoopNudges.length > 0 && (
        <div className="mt-6">
          <WhoopNudges nudges={whoopNudges} />
        </div>
      )}

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

          {hasWhoop && (
            <section>
              <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
                WHOOP
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-tightish">
                Strain &amp; recovery
              </h2>
              <p className="mt-1 text-sm text-ink-mute">
                Only you see this — it&apos;s never shared with followers.
              </p>
              <div className="mt-5">
                <WhoopInsights
                  feelRecovery={feelRecovery}
                  strainVolume={strainVolume}
                  avgFeelHighRecovery={avgFeelHighRecovery}
                  avgFeelLowRecovery={avgFeelLowRecovery}
                />
              </div>
            </section>
          )}

          <StudyShelf shelves={studyShelves} />

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

