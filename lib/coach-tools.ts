import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { submissionStats, type SessionRow } from "@/lib/stats";

// Coach's retrieval tools. The chat context only carries a summary + the most
// recent sessions; these let the model pull older or aggregate data on demand
// instead of us dumping the whole log into every prompt. Executed with the
// caller's cookie-bound Supabase client, so RLS scopes everything to them.

type SupabaseServer = ReturnType<typeof createClient>;

const SESSION_COLS =
  "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, created_at";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// One session as a compact context line. Shared with the chat route.
export function formatSession(s: SessionRow): string {
  const parts = [
    `${s.trained_on}: ${s.duration_min}min, ${s.rounds} rounds, feel ${s.feel}/5`,
  ];
  if (s.gym) parts.push(`gym: ${s.gym}`);
  if (s.drilled) parts.push(`drilled: ${s.drilled}`);
  if (s.subs_hit?.length) parts.push(`subs hit: ${s.subs_hit.join(", ")}`);
  if (s.subs_caught_in?.length)
    parts.push(`caught in: ${s.subs_caught_in.join(", ")}`);
  if (s.partners?.length) parts.push(`partners: ${s.partners.join(", ")}`);
  if (s.note) parts.push(`note: ${s.note}`);
  return "- " + parts.join(" | ");
}

export const COACH_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "query_sessions",
    description:
      "Fetch the athlete's logged training sessions, newest first. Filter by date range and/or a keyword (matched case-insensitively against gym, drilled, note, submissions, and partners). Use this for any question about sessions older than the recent ones already in context, or to search the log.",
    input_schema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Earliest date to include, YYYY-MM-DD (inclusive).",
        },
        to: {
          type: "string",
          description: "Latest date to include, YYYY-MM-DD (inclusive).",
        },
        contains: {
          type: "string",
          description:
            "Keyword filter, e.g. a submission, partner, gym, or note phrase.",
        },
        limit: {
          type: "number",
          description: "Max sessions to return (default 20, max 50).",
        },
      },
    },
  },
  {
    name: "get_submission_stats",
    description:
      "Per-submission scorecard for the athlete over an optional date range (omit both dates for all time): times finished, times caught in, net, and finish rate. Use this for best-submission / what-catches-me / progress questions, especially scoped to a period.",
    input_schema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Earliest date to include, YYYY-MM-DD (inclusive).",
        },
        to: {
          type: "string",
          description: "Latest date to include, YYYY-MM-DD (inclusive).",
        },
      },
    },
  },
  {
    name: "get_whoop_data",
    description:
      "The athlete's WHOOP data over a date range: per-day recovery score, day strain, HRV, resting HR, sleep performance and hours, plus individual workouts (strain, avg/max HR). Use for readiness questions ('should I train hard today?'), recovery/strain trends, and correlating physiology with how sessions felt. Returns a note if WHOOP isn't connected.",
    input_schema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Earliest date, YYYY-MM-DD (inclusive). Defaults to 14 days ago.",
        },
        to: {
          type: "string",
          description: "Latest date, YYYY-MM-DD (inclusive). Defaults to today.",
        },
      },
    },
  },
  {
    name: "log_session",
    description:
      "Save a NEW training session to the athlete's log. Call this ONLY after you've shown the athlete the exact structured session you're about to save and they explicitly confirmed it in their latest message. Never call it speculatively.",
    input_schema: {
      type: "object",
      properties: {
        trained_on: {
          type: "string",
          description: "Session date, YYYY-MM-DD ('today' resolves via the date in context).",
        },
        duration_min: {
          type: "number",
          description: "Mat time in minutes (1–599).",
        },
        rounds: {
          type: "number",
          description: "Rounds rolled (0–99). Default 0 if unknown.",
        },
        feel: {
          type: "number",
          description: "How it felt, 1–5. Ask the athlete if they didn't say.",
        },
        gym: { type: "string", description: "Gym name, if mentioned." },
        drilled: {
          type: "string",
          description: "What they drilled, if mentioned.",
        },
        subs_hit: {
          type: "array",
          items: { type: "string" },
          description: "Submissions they finished.",
        },
        subs_caught_in: {
          type: "array",
          items: { type: "string" },
          description: "Submissions they got caught in.",
        },
        partners: {
          type: "array",
          items: { type: "string" },
          description: "Training partners mentioned by name.",
        },
        note: {
          type: "string",
          description: "Free-text note distilled from their description.",
        },
      },
      required: ["trained_on", "duration_min", "feel"],
    },
  },
];

async function fetchSessions(
  supabase: SupabaseServer,
  userId: string,
  from?: string,
  to?: string,
): Promise<SessionRow[]> {
  let q = supabase
    .from("sessions")
    .select(SESSION_COLS)
    .eq("user_id", userId)
    .order("trained_on", { ascending: false })
    .limit(300);
  if (from && DATE_RE.test(from)) q = q.gte("trained_on", from);
  if (to && DATE_RE.test(to)) q = q.lte("trained_on", to);
  const { data } = await q;
  return (data ?? []) as SessionRow[];
}

// Execute one Coach tool call; always returns text for the tool_result block.
// Unknown tools / bad input return an explanatory string rather than throwing
// so the model can recover.
export async function runCoachTool(
  supabase: SupabaseServer,
  userId: string,
  name: string,
  input: unknown,
): Promise<string> {
  const args = (input ?? {}) as {
    from?: string;
    to?: string;
    contains?: string;
    limit?: number;
  };

  try {
    if (name === "query_sessions") {
      const rows = await fetchSessions(supabase, userId, args.from, args.to);
      const needle = args.contains?.trim().toLowerCase();
      const matched = needle
        ? rows.filter((s) =>
            [
              s.gym,
              s.drilled,
              s.note,
              ...(s.subs_hit ?? []),
              ...(s.subs_caught_in ?? []),
              ...(s.partners ?? []),
            ]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)),
          )
        : rows;
      const limit = Math.min(50, Math.max(1, Math.floor(args.limit ?? 20)));
      const shown = matched.slice(0, limit);
      if (!shown.length) return "No sessions match that query.";
      const header =
        matched.length > shown.length
          ? `${matched.length} sessions match; showing the ${shown.length} most recent:`
          : `${shown.length} session(s):`;
      return [header, ...shown.map(formatSession)].join("\n");
    }

    if (name === "get_submission_stats") {
      const rows = await fetchSessions(supabase, userId, args.from, args.to);
      const stats = submissionStats(rows);
      if (!stats.length)
        return "No submissions logged in that range.";
      const range =
        args.from || args.to
          ? `${args.from ?? "beginning"} to ${args.to ?? "today"}`
          : "all time";
      const lines = stats.map(
        (s) =>
          `${s.name}: finished ${s.hit}, caught in ${s.caught}, net ${
            s.net >= 0 ? "+" : ""
          }${s.net}, finish rate ${Math.round(s.rate * 100)}%`,
      );
      return [`Submission scorecard (${range}), across ${rows.length} sessions:`, ...lines].join(
        "\n",
      );
    }

    if (name === "get_whoop_data") {
      const to = args.to && DATE_RE.test(args.to) ? args.to : undefined;
      const from = args.from && DATE_RE.test(args.from) ? args.from : undefined;
      const toDate = to ?? new Date().toISOString().slice(0, 10);
      const fromDate =
        from ??
        new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

      const { data: conn } = await supabase
        .from("whoop_connections")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!conn)
        return "WHOOP isn't connected. The athlete can connect it in Settings for recovery/strain data.";

      const [{ data: days }, { data: workouts }] = await Promise.all([
        supabase
          .from("whoop_cycles")
          .select(
            "day, day_strain, recovery_score, hrv_ms, resting_hr, sleep_performance, sleep_hours",
          )
          .eq("user_id", userId)
          .gte("day", fromDate)
          .lte("day", toDate)
          .order("day", { ascending: false }),
        supabase
          .from("whoop_workouts")
          .select("local_date, sport, strain, avg_hr, max_hr")
          .eq("user_id", userId)
          .gte("local_date", fromDate)
          .lte("local_date", toDate)
          .order("local_date", { ascending: false }),
      ]);

      const dayLines = (days ?? []).map((d) => {
        const bits = [`${d.day}:`];
        if (d.recovery_score != null) bits.push(`recovery ${Math.round(d.recovery_score)}%`);
        if (d.day_strain != null) bits.push(`strain ${Number(d.day_strain).toFixed(1)}`);
        if (d.hrv_ms != null) bits.push(`HRV ${Math.round(d.hrv_ms)}ms`);
        if (d.resting_hr != null) bits.push(`RHR ${Math.round(d.resting_hr)}`);
        if (d.sleep_hours != null) bits.push(`sleep ${d.sleep_hours}h`);
        if (d.sleep_performance != null) bits.push(`sleep-perf ${Math.round(d.sleep_performance)}%`);
        return bits.join(" ");
      });
      const woLines = (workouts ?? []).map(
        (w) =>
          `${w.local_date}: ${w.sport ?? "workout"}${
            w.strain != null ? ` strain ${Number(w.strain).toFixed(1)}` : ""
          }${w.avg_hr != null ? ` avg ${Math.round(w.avg_hr)}bpm` : ""}${
            w.max_hr != null ? ` max ${Math.round(w.max_hr)}` : ""
          }`,
      );
      if (!dayLines.length && !woLines.length)
        return `No WHOOP data in ${fromDate}..${toDate}.`;
      return [
        `WHOOP ${fromDate}..${toDate}`,
        dayLines.length ? "Daily:\n" + dayLines.join("\n") : "",
        woLines.length ? "Workouts:\n" + woLines.join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (name === "log_session") {
      const a = (input ?? {}) as {
        trained_on?: string;
        duration_min?: number;
        rounds?: number;
        feel?: number;
        gym?: string;
        drilled?: string;
        subs_hit?: string[];
        subs_caught_in?: string[];
        partners?: string[];
        note?: string;
      };
      if (!a.trained_on || !DATE_RE.test(a.trained_on))
        return "Invalid trained_on — use YYYY-MM-DD.";
      const duration = Math.floor(Number(a.duration_min));
      if (!Number.isFinite(duration) || duration < 1 || duration > 599)
        return "Invalid duration_min — must be 1–599 minutes.";
      const rounds = Math.min(99, Math.max(0, Math.floor(Number(a.rounds) || 0)));
      const feel = Math.floor(Number(a.feel));
      if (!Number.isFinite(feel) || feel < 1 || feel > 5)
        return "Invalid feel — must be 1–5.";
      const clean = (arr?: string[]) =>
        (Array.isArray(arr) ? arr : [])
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 20);

      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: userId,
          trained_on: a.trained_on,
          duration_min: duration,
          rounds,
          feel,
          gym: a.gym?.trim() || null,
          drilled: a.drilled?.trim() || null,
          note: a.note?.trim() || null,
          subs_hit: clean(a.subs_hit),
          subs_caught_in: clean(a.subs_caught_in),
          partners: clean(a.partners),
        })
        .select(SESSION_COLS)
        .single();
      if (error) return `Could not save the session: ${error.message}`;

      revalidatePath("/dashboard");
      revalidatePath("/feed");
      revalidatePath(`/u/${userId}`);
      return `Session saved successfully:\n${formatSession(data as SessionRow)}`;
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : "unknown"}`;
  }
}
