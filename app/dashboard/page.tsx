import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { isoDate, submissionStats, type SessionRow } from "@/lib/stats";
import type { BeltHistoryRow } from "@/lib/journey";
import {
  searchStudyVideos,
  youtubeConfigured,
  type StudyVideo,
} from "@/lib/youtube";

import { DashboardView } from "./DashboardView";

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
          "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, session_type, comp_result, attire, created_at",
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

  return (
    <AppShell profile={profile} active="dashboard">
      <DashboardView
        profile={profile}
        sessions={rows}
        belts={belts}
        now={now}
        studyShelves={studyShelves}
        showFeedback={showFeedback}
      />
    </AppShell>
  );
}
