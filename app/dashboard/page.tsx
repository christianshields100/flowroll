import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import {
  currentStreak,
  formatHours,
  isoDate,
  parseDateOnly,
  periodBuckets,
  sessionTotals,
  submissionStats,
  weekStart,
  type SessionRow,
} from "@/lib/stats";
import { generateInsights, submissionTrends } from "@/lib/insights";
import {
  daysBetween,
  humanSpan,
  journeyHeader,
  milestones,
  pace,
  rankLabel,
  type BeltHistoryRow,
} from "@/lib/journey";
import { StudyShelf } from "./StudyShelf";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { InsightsReport } from "@/components/InsightsReport";
import { JourneyHeader } from "@/components/JourneyHeader";
import { MilestoneTimeline } from "@/components/MilestoneTimeline";
import { PromotionCard } from "@/components/PromotionCard";
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

// The dashboard is organised around three questions an athlete actually
// asks: Where am I? What's working — and what isn't? Where am I going?
export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: sessions }, { data: history }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, display_name, first_name, last_name, belt, stripes, avatar_url, visit_count, last_seen_on, feedback_dismissed_at",
        )
        .eq("id", user!.id)
        .single(),
      supabase
        .from("sessions")
        .select(
          "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, session_type, comp_result, created_at",
        )
        .eq("user_id", user!.id)
        .order("trained_on", { ascending: false }),
      supabase
        .from("belt_history")
        .select("id, kind, belt, stripes, promoted_on, created_at")
        .eq("user_id", user!.id),
    ]);

  // Once-a-day visit counter; after 3 distinct days the feedback prompt
  // appears (until dismissed or answered).
  const now = new Date();
  const todayIso = isoDate(now);
  let visitCount = profile?.visit_count ?? 0;
  if (profile && profile.last_seen_on !== todayIso) {
    visitCount += 1;
    await supabase
      .from("profiles")
      .update({ visit_count: visitCount, last_seen_on: todayIso })
      .eq("id", user!.id);
  }
  const showFeedback = visitCount >= 3 && !profile?.feedback_dismissed_at;

  const rows = (sessions ?? []) as SessionRow[];
  const belts = (history ?? []) as BeltHistoryRow[];
  const daily = periodBuckets(rows, "day");
  const weekly = periodBuckets(rows, "week");
  const monthly = periodBuckets(rows, "month");
  const streak = currentStreak(rows);
  const totals = sessionTotals(rows);
  const empty = rows.length === 0;

  // --- Journey ---
  const journey = journeyHeader(belts, rows, now);
  const timeline = milestones(belts, rows);
  const pacing = pace(rows, now);
  const insights = generateInsights(rows, now);
  const trends = submissionTrends(rows, now);

  // Fresh promotion (last 7 days) → celebration card with undo.
  const sortedBelts = [...belts].sort(
    (a, b) =>
      b.promoted_on.localeCompare(a.promoted_on) ||
      b.created_at.localeCompare(a.created_at),
  );
  let promo: {
    rank: string;
    previousRank: string;
    timeAtPrevious: string;
    hoursAtPrevious: string;
  } | null = null;
  if (
    sortedBelts[0]?.kind === "promotion" &&
    sortedBelts[1] &&
    daysBetween(parseDateOnly(sortedBelts[0].promoted_on), now) <= 7
  ) {
    const cur = sortedBelts[0];
    const prev = sortedBelts[1];
    const from = parseDateOnly(prev.promoted_on);
    const to = parseDateOnly(cur.promoted_on);
    const inRank = rows.filter((s) => {
      const d = parseDateOnly(s.trained_on);
      return d >= from && d < to;
    });
    promo = {
      rank: rankLabel(cur.belt, cur.stripes),
      previousRank: rankLabel(prev.belt, prev.stripes),
      timeAtPrevious: humanSpan(daysBetween(from, to)),
      hoursAtPrevious: formatHours(inRank.reduce((n, s) => n + s.duration_min, 0)),
    };
  }

  // Tally partners across all sessions for the "usual suspects" list.
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

  // --- Study shelves (YouTube; ships dark until YOUTUBE_API_KEY is set) ---
  let studyShelves: { tag: string; title: string; videos: StudyVideo[] }[] = [];
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
  const ws = weekStart(now);
  const weekEnd = new Date(ws.getTime() + 6 * 86400000);
  const weekNo = Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
  );
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const daysThisWeek = new Set(
    rows.filter((s) => parseDateOnly(s.trained_on) >= ws).map((s) => s.trained_on),
  ).size;
  const NUM_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
  const firstName = profile?.first_name?.trim() || profile?.display_name || "";
  const fmtDate = (iso: string | null) =>
    iso
      ? parseDateOnly(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" })
      : null;

  return (
    <AppShell profile={profile} active="dashboard">
      <div className="rise grid sm:grid-cols-[1fr,2fr] gap-2 sm:gap-10 items-end border-b border-ink pb-6">
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
                {NUM_WORDS[Math.min(daysThisWeek, 7)]} {daysThisWeek === 1 ? "day" : "days"} on
                the mat.
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

      {promo && (
        <div className="mt-8">
          <PromotionCard {...promo} />
        </div>
      )}

      {empty ? (
        <div className="mt-10 max-w-xl">
          <p className="text-xl font-medium tracking-tightish">Nothing on record yet.</p>
          <p className="mt-2 text-ink-dim leading-relaxed">
            Log your first roll and the figures start filling in — mat time, submissions,
            streak, a searchable archive. After five sessions the app starts telling you
            what it sees.
          </p>
          <a
            href="/log"
            className="mt-6 inline-block bg-ink text-paper px-7 py-3 text-[13px] font-semibold hover:bg-belt-black transition-colors"
          >
            File your first session →
          </a>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {/* ---------------- 1. WHERE YOU ARE ---------------- */}
          <section className="rise rise-1">
            <Question n="I" title="Where you are" />
            <div className="mt-6 space-y-8">
              {journey && <JourneyHeader data={journey} />}
              <StreakTile streak={streak} totals={totals} />
              <div className="grid lg:grid-cols-[3fr,2fr] gap-10">
                <div>
                  <SectionHeading title="The year at a glance" hint="Every day you trained, shaded by mat time" />
                  <div className="mt-4">
                    <TrainingCalendar sessions={rows} today={now} />
                  </div>
                </div>
                <div>
                  <SectionHeading title="Your journey" hint="Promotions, competitions, and marks along the way" />
                  <div className="mt-4">
                    <MilestoneTimeline items={timeline} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------- 2. WHAT'S WORKING ---------------- */}
          <section className="rise rise-2">
            <Question n="II" title="What's working — and what isn't" />
            <div className="mt-6 space-y-10">
              <div>
                <SectionHeading
                  title="The report"
                  hint="Read straight from your log — no guessing, no AI"
                />
                <div className="mt-2">
                  <InsightsReport insights={insights} sessionCount={rows.length} />
                </div>
              </div>

              <VolumeViews daily={daily} weekly={weekly} monthly={monthly} />

              <StudyShelf shelves={studyShelves} />

              <div className="grid lg:grid-cols-2 gap-10">
                <div>
                  <SectionHeading title="The ledger" hint="Every submission, for and against — with the trend" />
                  <div className="mt-4">
                    <SubmissionLedger sessions={rows} trends={Object.fromEntries(trends)} />
                  </div>

                  {topPartners.length > 0 && (
                    <div className="mt-10">
                      <SectionHeading title="The usual suspects" hint="Who you've rolled with most" />
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
                  <SectionHeading title="The archive" hint="Find anything you've drilled or noted" />
                  <div className="mt-4">
                    <NotesSearch sessions={rows} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------- 3. WHERE YOU'RE GOING ---------------- */}
          <section className="rise rise-3">
            <Question n="III" title="Where you're going" />
            <div className="mt-6 grid lg:grid-cols-[1fr,1fr] gap-10">
              <div>
                <SectionHeading title="At this pace" hint="Trailing twelve weeks, projected forward" />
                <p className="mt-4 text-sm text-ink leading-relaxed">
                  {pacing.sessionsPerWeek > 0 ? (
                    <>
                      You&apos;re averaging{" "}
                      <b>{pacing.sessionsPerWeek.toFixed(1)} sessions</b> and{" "}
                      <b>{pacing.hoursPerWeek.toFixed(1)} hours</b> a week.
                      {pacing.nextSessionMark && pacing.nextSessionMarkDate && (
                        <>
                          {" "}
                          Session <b>{pacing.nextSessionMark}</b> lands around{" "}
                          {fmtDate(pacing.nextSessionMarkDate)}
                        </>
                      )}
                      {pacing.nextHourMark && pacing.nextHourMarkDate && (
                        <>
                          {pacing.nextSessionMark ? ", and " : " "}
                          <b>{pacing.nextHourMark} hours</b> around{" "}
                          {fmtDate(pacing.nextHourMarkDate)}
                        </>
                      )}
                      .
                    </>
                  ) : (
                    <span className="italic text-ink-mute">
                      No sessions in the last twelve weeks — the projection restarts with your
                      next roll.
                    </span>
                  )}
                </p>
              </div>
              <div>
                <SectionHeading title="What to work on" hint="The coach knows your whole log" />
                <p className="mt-4 text-sm text-ink-dim leading-relaxed">
                  Goals are next for this space. Until then, the best plan is a conversation:
                </p>
                <Link
                  href={`/chat?q=${encodeURIComponent("Based on my recent sessions, what are the two things I should focus on for the next month, and why?")}`}
                  className="mt-3 inline-block text-[13px] text-accent hover:text-accent-deep transition-colors"
                >
                  Ask Coach what to focus on next →
                </Link>
              </div>
            </div>
          </section>

          <div className="rise rise-4">
            <WeeklyRecap />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Question({ n, title }: { n: string; title: string }) {
  return (
    <div className="border-t border-ink pt-4 flex items-baseline gap-4">
      <span className="text-[11px] uppercase tracking-dojo text-accent">{n}</span>
      <h2 className="text-2xl font-medium tracking-tightish">{title}</h2>
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-dojo text-ink-mute">{title}</p>
      <p className="mt-1 text-sm italic text-ink-mute">{hint}</p>
    </div>
  );
}
