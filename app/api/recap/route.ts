// POST /api/recap — Coach's weekly recap for the dashboard.
// Generated once per (user, week) and cached in weekly_recaps; regenerated
// only when a session has been logged since the recap was written.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  isoDate,
  submissionScorecard,
  weekStart,
  type SessionRow,
} from "@/lib/stats";

export const runtime = "nodejs";

const MODEL = "claude-opus-4-8";

function formatSession(s: SessionRow): string {
  const parts = [
    `${s.trained_on}: ${s.duration_min}min, ${s.rounds} rounds, feel ${s.feel}/5`,
  ];
  if (s.drilled) parts.push(`drilled: ${s.drilled}`);
  if (s.subs_hit?.length) parts.push(`subs hit: ${s.subs_hit.join(", ")}`);
  if (s.subs_caught_in?.length)
    parts.push(`caught in: ${s.subs_caught_in.join(", ")}`);
  if (s.partners?.length) parts.push(`partners: ${s.partners.join(", ")}`);
  if (s.note) parts.push(`note: ${s.note}`);
  return "- " + parts.join(" | ");
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const now = new Date();
  const thisWeekStart = weekStart(now);
  const weekKey = isoDate(thisWeekStart);
  const lastWeekStart = new Date(
    thisWeekStart.getFullYear(),
    thisWeekStart.getMonth(),
    thisWeekStart.getDate() - 7,
  );

  // Both weeks of sessions in one query (covers comparison context too).
  const { data: sessionsData } = await supabase
    .from("sessions")
    .select(
      "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, created_at",
    )
    .eq("user_id", user.id)
    .gte("trained_on", isoDate(lastWeekStart))
    .order("trained_on", { ascending: false });

  const rows = (sessionsData ?? []) as SessionRow[];
  const thisWeek = rows.filter((s) => s.trained_on >= weekKey);

  // WHOOP recovery/strain for this week, if connected — lets the recap flag
  // when training outpaced recovery.
  const { data: whoopWeek } = await supabase
    .from("whoop_cycles")
    .select("day, day_strain, recovery_score, sleep_hours")
    .eq("user_id", user.id)
    .gte("day", weekKey)
    .order("day", { ascending: true });
  const whoopLine = (whoopWeek ?? [])
    .map((d) => {
      const b: string[] = [d.day];
      if (d.recovery_score != null) b.push(`rec ${Math.round(d.recovery_score)}%`);
      if (d.day_strain != null) b.push(`strain ${Number(d.day_strain).toFixed(1)}`);
      if (d.sleep_hours != null) b.push(`sleep ${d.sleep_hours}h`);
      return b.join(" ");
    })
    .join("; ");
  const lastWeek = rows.filter((s) => s.trained_on < weekKey);

  if (thisWeek.length === 0) {
    return Response.json({ content: null });
  }

  // Serve the cached recap unless a session landed after it was written.
  const { data: cached } = await supabase
    .from("weekly_recaps")
    .select("content, created_at")
    .eq("user_id", user.id)
    .eq("week_start", weekKey)
    .maybeSingle();

  const newestSession = thisWeek.reduce(
    (max, s) => (s.created_at > max ? s.created_at : max),
    "",
  );
  if (cached && cached.created_at > newestSession) {
    return Response.json({ content: cached.content });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Recap is not configured: ANTHROPIC_API_KEY is missing." },
      { status: 500 },
    );
  }

  const prompt = [
    `You are Coach, the assistant inside the FlowRoll BJJ training log. Write this athlete's week-so-far recap for their dashboard.`,
    ``,
    `This week's sessions (week of ${weekKey}):`,
    thisWeek.map(formatSession).join("\n"),
    ``,
    lastWeek.length
      ? `Last week, for comparison:\n${lastWeek.map(formatSession).join("\n")}`
      : `Last week: no sessions logged.`,
    ``,
    submissionScorecard(thisWeek)
      ? `This week's submission scorecard (finished/caught, net): ${submissionScorecard(thisWeek)}`
      : ``,
    whoopLine ? `This week's WHOOP (per day): ${whoopLine}` : ``,
    ``,
    `Write 2-4 sentences, plain text only (no markdown, no greeting). Conversational, specific, second person. Mention concrete numbers or submissions or note themes where they stand out — volume vs last week, repeated catches, what they drilled. If WHOOP data is present and notable, weave in one recovery/strain observation (e.g. training hard on low-recovery days). End with one short pointed suggestion.`,
  ].join("\n");

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (content) {
    await supabase.from("weekly_recaps").upsert({
      user_id: user.id,
      week_start: weekKey,
      content,
      created_at: new Date().toISOString(),
    });
  }

  return Response.json({ content: content || null });
}
