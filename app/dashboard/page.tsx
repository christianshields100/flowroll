import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import {
  currentStreak,
  isoDate,
  parseDateOnly,
  periodBuckets,
  sessionTotals,
  submissionStats,
  weekStart,
  type SessionRow,
} from "@/lib/stats";
import { StudyShelf } from "./StudyShelf";
import { FeedbackWidget } from "@/components/FeedbackWidget";
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
    .select(
      "id, display_name, first_name, last_name, belt, stripes, avatar_url, visit_count, last_seen_on, feedback_dismissed_at",
    )
    .eq("id", user!.id)
    .single();

  // Once-a-day visit counter; after 3 distinct days the feedback prompt
  // appears (until dismissed or answered).
  const todayIso = isoDate(new Date());
  let visitCount = profile?.visit_count ?? 0;
  if (profile && profile.last_seen_on !== todayIso) {
    visitCount += 1;
    await supabase
      .from("profiles")
      .update({ visit_count: visitCount, last_seen_on: todayIso })
      .eq("id", user!.id);
  }
  const showFeedback = visitCount >= 3 && !profile?.feedback_dismissed_at;

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

  // Masthead copy: issue label on the left, greeting on the right.
  const now = new Date();
  const ws = weekStart(now);
  const weekEnd = new Date(ws.getTime() + 6 * 86400000);
  const weekNo = Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 +
      1) /
      7,
  );
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const daysThisWeek = new Set(
    rows
      .filter((s) => parseDateOnly(s.trained_on) >= ws)
      .map((s) => s.trained_on),
  ).size;
  const NUM_WORDS = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
  ];
  const firstName =
    profile?.first_name?.trim() || profile?.display_name || "";

  return (
    <AppShell profile={profile} active="dashboard">
      <div className="grid sm:grid-cols-[1fr,2fr] gap-2 sm:gap-10 items-end border-b border-ink pb-6">
        <p className="text-[11px] uppercase tracking-dojo text-ink-mute leading-relaxed">
          Vol. 1 — Week {weekNo}
          <br />
          {fmt(ws)}–{fmt(weekEnd)}, {now.getFullYear()}
        </p>
        <h1 className="text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
          {empty ? (
            <>
              For the record{firstName ? `, ${firstName}` : ""}.
              <br />
              <span className="text-ink-mute">The mat is patient.</span>
            </>
          ) : daysThisWeek > 0 ? (
            <>
              Good week{firstName ? `, ${firstName}` : ""}.
              <br />
              <span className="text-ink-mute">
                {NUM_WORDS[Math.min(daysThisWeek, 7)]}{" "}
                {daysThisWeek === 1 ? "day" : "days"} on the mat.
              </span>
            </>
          ) : (
            <>
              Quiet week{firstName ? `, ${firstName}` : ""}.
              <br />
              <span className="text-ink-mute">The mat is patient.</span>
            </>
          )}
        </h1>
      </div>

      {showFeedback && <FeedbackWidget context="dashboard-popup" />}

      {whoopNudges.length > 0 && (
        <div className="mt-6">
          <WhoopNudges nudges={whoopNudges} />
        </div>
      )}

      {empty ? (
        <div className="mt-10 max-w-xl">
          <p className="text-xl font-medium tracking-tightish">
            Nothing on record yet.
          </p>
          <p className="mt-2 text-ink-dim leading-relaxed">
            Log your first roll and the figures start filling in — mat time,
            submissions, streak, a searchable archive.
          </p>
          <a
            href="/log"
            className="mt-6 inline-block bg-ink text-paper px-7 py-3 text-[13px] font-semibold hover:bg-belt-black transition-colors"
          >
            File your first session →
          </a>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          <StreakTile streak={streak} totals={totals} />

          <VolumeViews daily={daily} weekly={weekly} monthly={monthly} />

          {hasWhoop && (
            <section>
              <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
                Fig. 9 — WHOOP
              </p>
              <h2 className="mt-1 text-2xl font-medium tracking-tightish">
                Strain &amp; recovery
              </h2>
              <p className="mt-1 text-sm italic text-ink-mute">
                For your eyes only — never shared with followers.
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

          <section className="grid lg:grid-cols-2 gap-10">
            <div>
              <SectionHeading fig={6} title="The ledger" hint="Tallies across every session" />
              <div className="mt-4">
                <SubmissionLedger sessions={rows} />
              </div>

              {topPartners.length > 0 && (
                <div className="mt-10">
                  <SectionHeading
                    fig={7}
                    title="The usual suspects"
                    hint="Who you've rolled with most"
                  />
                  <ul className="mt-4">
                    {topPartners.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-baseline justify-between gap-3 border-t border-paper-line py-2"
                      >
                        <span className="text-sm text-ink">{p.name}</span>
                        <span className="text-[13px] num text-ink-mute">
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
                fig={8}
                title="The archive"
                hint="Find anything you've drilled or noted"
              />
              <div className="mt-4">
                <NotesSearch sessions={rows} />
              </div>
            </div>
          </section>

          <WeeklyRecap />
        </div>
      )}
    </AppShell>
  );
}

function SectionHeading({
  fig,
  title,
  hint,
}: {
  fig: number;
  title: string;
  hint: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
        Fig. {fig} — {title}
      </p>
      <p className="mt-1 text-sm italic text-ink-mute">{hint}</p>
    </div>
  );
}

