import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { submissionStats, type SessionRow } from "@/lib/stats";
import { searchStudyVideos, videoUrl, youtubeConfigured } from "@/lib/youtube";

// Coach's retrieval tools. The chat context only carries a summary + the most
// recent sessions; these let the model pull older or aggregate data on demand
// instead of us dumping the whole log into every prompt. Executed with the
// caller's cookie-bound Supabase client, so RLS scopes everything to them.

type SupabaseServer = ReturnType<typeof createClient>;

const SESSION_COLS =
  "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, attire, created_at";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// One session as a compact context line. Shared with the chat route.
export function formatSession(s: SessionRow): string {
  const parts = [
    `${s.trained_on}: ${s.duration_min}min, ${s.rounds} rounds, feel ${s.feel}/5`,
  ];
  if (s.attire) parts.push(s.attire === "gi" ? "gi" : "no-gi");
  if (s.gym) parts.push(`gym: ${s.gym}`);
  if (s.drilled) parts.push(`drilled: ${s.drilled}`);
  if (s.subs_hit?.length) parts.push(`subs hit: ${s.subs_hit.join(", ")}`);
  if (s.subs_caught_in?.length)
    parts.push(`caught in: ${s.subs_caught_in.join(", ")}`);
  if (s.partners?.length) parts.push(`partners: ${s.partners.join(", ")}`);
  if (s.note) parts.push(`note: ${s.note}`);
  return "- " + parts.join(" | ");
}

const SESSION_INPUT_PROPS: Record<string, unknown> = {
  trained_on: {
    type: "string",
    description: "Session date, YYYY-MM-DD ('today' resolves via the date in context).",
  },
  duration_min: { type: "number", description: "Mat time in minutes (1–599)." },
  rounds: { type: "number", description: "Rounds rolled (0–99). Default 0 if unknown." },
  feel: { type: "number", description: "How it felt, 1–5. Default 3 if they didn't say." },
  gym: { type: "string", description: "Gym name, if mentioned." },
  session_type: {
    type: "string",
    enum: ["training", "open_mat", "competition", "private"],
    description: "Kind of session. Default training.",
  },
  comp_result: { type: "string", description: "Competition result, if it was a competition." },
  attire: {
    type: "string",
    enum: ["gi", "nogi"],
    description: "Gi or no-gi, if the athlete said (don't guess).",
  },
  drilled: { type: "string", description: "What they drilled, if mentioned." },
  subs_hit: { type: "array", items: { type: "string" }, description: "Submissions they finished." },
  subs_caught_in: { type: "array", items: { type: "string" }, description: "Submissions they got caught in." },
  partners: { type: "array", items: { type: "string" }, description: "Training partners mentioned by name." },
  note: { type: "string", description: "Free-text note distilled from their description." },
};

export type SessionInput = {
  trained_on?: string;
  duration_min?: number;
  rounds?: number;
  feel?: number;
  gym?: string;
  session_type?: string;
  comp_result?: string;
  attire?: string;
  drilled?: string;
  subs_hit?: string[];
  subs_caught_in?: string[];
  partners?: string[];
  note?: string;
};

const SESSION_TYPES = ["training", "open_mat", "competition", "private"];

// Validate one tool-supplied session into an insertable row, or explain why not.
export function buildSessionRow(
  userId: string,
  a: SessionInput,
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  if (!a.trained_on || !DATE_RE.test(a.trained_on))
    return { ok: false, error: "Invalid trained_on — use YYYY-MM-DD." };
  const duration = Math.floor(Number(a.duration_min));
  if (!Number.isFinite(duration) || duration < 1 || duration > 599)
    return { ok: false, error: `${a.trained_on}: duration_min must be 1–599 minutes.` };
  const rounds = Math.min(99, Math.max(0, Math.floor(Number(a.rounds) || 0)));
  const feelRaw = a.feel == null ? 3 : Math.floor(Number(a.feel));
  const feel = Number.isFinite(feelRaw) ? Math.min(5, Math.max(1, feelRaw)) : 3;
  const clean = (arr?: string[]) =>
    (Array.isArray(arr) ? arr : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 20);
  const session_type = SESSION_TYPES.includes(a.session_type ?? "") ? a.session_type : "training";
  return {
    ok: true,
    row: {
      user_id: userId,
      trained_on: a.trained_on,
      duration_min: duration,
      rounds,
      feel,
      gym: a.gym?.trim() || null,
      session_type,
      comp_result: session_type === "competition" ? a.comp_result?.trim().slice(0, 120) || null : null,
      attire: a.attire === "gi" || a.attire === "nogi" ? a.attire : null,
      drilled: a.drilled?.trim() || null,
      note: a.note?.trim() || null,
      subs_hit: clean(a.subs_hit),
      subs_caught_in: clean(a.subs_caught_in),
      partners: clean(a.partners),
    },
  };
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
    name: "find_videos",
    description:
      "Search YouTube for BJJ instructional videos on a specific technique or problem (e.g. 'armbar escape', 'half guard sweeps'). Returns titles, channels, and links. Use when the athlete asks what to study or when recommending drills for a weakness. Prefer specific queries over broad ones.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Technique + intent, e.g. 'triangle escape', 'knee cut pass details'. 'bjj' is appended automatically if missing.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "log_session",
    description:
      "Save ONE training session to the athlete's log. Use after they've described a session and said to log it (or confirmed your summary). For several sessions at once, use log_sessions instead.",
    input_schema: { type: "object", properties: SESSION_INPUT_PROPS, required: ["trained_on", "duration_min"] },
  },
  {
    name: "log_sessions",
    description:
      "Save SEVERAL training sessions in one call (up to 50) — backfilling past weeks, pasting a list, etc. One confirmation covers the whole batch; never ask per session. Each item uses the same fields as log_session.",
    input_schema: {
      type: "object",
      properties: {
        sessions: {
          type: "array",
          maxItems: 50,
          items: { type: "object", properties: SESSION_INPUT_PROPS, required: ["trained_on", "duration_min"] },
        },
      },
      required: ["sessions"],
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

    if (name === "find_videos") {
      const q = String((input as { query?: string })?.query ?? "").trim();
      if (!q) return "Provide a search query.";
      if (!youtubeConfigured())
        return "Video search isn't configured on this deployment — suggest techniques by name instead and mention they can search YouTube.";
      const query = /\bbjj|jiu/i.test(q) ? q : `${q} bjj`;
      const videos = await searchStudyVideos(supabase, query, 5);
      if (!videos.length) return `No videos found for "${query}".`;
      return [
        `Videos for "${query}" (share as markdown links):`,
        ...videos.map((v) => `- [${v.title}](${videoUrl(v)}) — ${v.channel}`),
      ].join("\n");
    }

    if (name === "log_session" || name === "log_sessions") {
      const inputs: SessionInput[] =
        name === "log_sessions"
          ? (Array.isArray((input as { sessions?: unknown })?.sessions)
              ? ((input as { sessions: SessionInput[] }).sessions ?? [])
              : [])
          : [(input ?? {}) as SessionInput];
      if (inputs.length === 0) return "No sessions given.";
      if (inputs.length > 50) return "Too many sessions in one call — max 50.";
      const rows: Record<string, unknown>[] = [];
      for (const a of inputs) {
        const built = buildSessionRow(userId, a);
        if (!built.ok) return `Could not save: ${built.error} Nothing was saved.`;
        rows.push(built.row);
      }
      const { data, error } = await supabase
        .from("sessions")
        .insert(rows)
        .select(SESSION_COLS);
      if (error) return `Could not save the session(s): ${error.message}`;

      revalidatePath("/dashboard");
      revalidatePath("/feed");
      revalidatePath(`/u/${userId}`);
      const saved = (data ?? []) as SessionRow[];
      return `Saved ${saved.length} session${saved.length === 1 ? "" : "s"}:\n${saved.map(formatSession).join("\n")}`;
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : "unknown"}`;
  }
}
