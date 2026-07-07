import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
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

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : "unknown"}`;
  }
}
