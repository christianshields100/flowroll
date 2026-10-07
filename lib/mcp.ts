import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSessionRow, formatSession, type SessionInput } from "@/lib/coach-tools";
import { currentStreak, sessionTotals, submissionStats, type SessionRow } from "@/lib/stats";
import { generateInsights, submissionTrends } from "@/lib/insights";

// The MCP server's tools — what Claude, ChatGPT, Cursor etc. can do once an
// athlete connects FlowRoll. Every tool runs as that athlete through the
// oauth-authenticated RPCs; nothing here sees anyone else's data.

export const MCP_SERVER_INFO = { name: "flowroll", version: "1.0.0" };

export const MCP_INSTRUCTIONS =
  "FlowRoll is the athlete's Brazilian Jiu-Jitsu training log. Use get_stats for " +
  "any question about progress, best submissions, or what catches them; list_sessions " +
  "to read the log; log_session / log_sessions to save training they describe. Dates " +
  "are YYYY-MM-DD. Never give medical or injury advice — point them to a professional.";

const DATE = { type: "string", description: "YYYY-MM-DD" };

const SESSION_PROPS = {
  trained_on: { type: "string", description: "Session date, YYYY-MM-DD." },
  duration_min: { type: "number", description: "Mat time in minutes (1–599)." },
  rounds: { type: "number", description: "Rounds rolled (0–99). Default 0." },
  feel: { type: "number", description: "How it felt, 1–5. Default 3." },
  gym: { type: "string" },
  session_type: { type: "string", enum: ["training", "open_mat", "competition", "private"] },
  comp_result: { type: "string", description: "Competition result, if any." },
  attire: { type: "string", enum: ["gi", "nogi"] },
  drilled: { type: "string", description: "What they drilled." },
  subs_hit: { type: "array", items: { type: "string" }, description: "Submissions finished." },
  subs_caught_in: { type: "array", items: { type: "string" }, description: "Submissions caught in." },
  partners: { type: "array", items: { type: "string" }, description: "Training partners by name." },
  note: { type: "string" },
};

export const MCP_TOOLS = [
  {
    name: "get_profile",
    description: "The connected athlete's name, belt rank, stripes, and home gym.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_sessions",
    description:
      "Training sessions, newest first. Filter by date range and/or a keyword matched against gym, drilled, note, submissions, and partners.",
    inputSchema: {
      type: "object",
      properties: {
        from: DATE,
        to: DATE,
        contains: { type: "string", description: "Keyword filter." },
        limit: { type: "number", description: "Max rows (default 30, max 500)." },
      },
    },
  },
  {
    name: "get_stats",
    description:
      "Lifetime (or date-ranged) stats: totals, streak, per-submission scorecard (finished / caught / net / finish rate), 90-day trends, and the plain-language insights the dashboard shows.",
    inputSchema: { type: "object", properties: { from: DATE, to: DATE } },
  },
  {
    name: "log_session",
    description: "Save ONE training session the athlete describes. Returns the saved row.",
    inputSchema: { type: "object", properties: SESSION_PROPS, required: ["trained_on", "duration_min"] },
  },
  {
    name: "log_sessions",
    description: "Save SEVERAL sessions at once (up to 50), e.g. when backfilling past weeks.",
    inputSchema: {
      type: "object",
      properties: {
        sessions: { type: "array", maxItems: 50, items: { type: "object", properties: SESSION_PROPS, required: ["trained_on", "duration_min"] } },
      },
      required: ["sessions"],
    },
  },
];

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], isError });

export class McpAuthError extends Error {}

function rpcFail(message: string | undefined): never {
  const m = message ?? "";
  if (m.includes("invalid_token") || m.includes("expired_token")) throw new McpAuthError(m);
  if (m.includes("insufficient_scope")) throw new McpAuthError("insufficient_scope");
  throw new Error(m || "database error");
}

export async function runMcpTool(
  supabase: SupabaseClient,
  tokenHash: string,
  name: string,
  input: unknown,
): Promise<ToolResult> {
  const a = (input ?? {}) as Record<string, unknown>;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dateOr = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : null);

  if (name === "get_profile") {
    const { data, error } = await supabase.rpc("mcp_profile", { p_access_hash: tokenHash });
    if (error) rpcFail(error.message);
    const p = (data as unknown[])?.[0];
    return p ? text(JSON.stringify(p, null, 2)) : text("No profile found.", true);
  }

  if (name === "list_sessions" || name === "get_stats") {
    const { data, error } = await supabase.rpc("mcp_sessions", {
      p_access_hash: tokenHash,
      p_from: dateOr(a.from),
      p_to: dateOr(a.to),
      p_contains: name === "list_sessions" && typeof a.contains === "string" ? a.contains : null,
      p_limit: name === "list_sessions" ? Math.min(500, Math.max(1, Number(a.limit) || 30)) : 500,
    });
    if (error) rpcFail(error.message);
    const rows = ((data ?? []) as (SessionRow & { user_id?: string })[]).map((r) => {
      const { user_id: _u, ...rest } = r;
      void _u;
      return rest as SessionRow;
    });
    if (name === "list_sessions") {
      return text(rows.length ? JSON.stringify(rows, null, 2) : "No sessions match.");
    }
    const totals = sessionTotals(rows);
    const stats = submissionStats(rows);
    const trends = Object.fromEntries(submissionTrends(rows));
    const insights = generateInsights(rows).map((i) => `[${i.kind}] ${i.text}`);
    return text(
      JSON.stringify(
        {
          range: { from: dateOr(a.from), to: dateOr(a.to) },
          sessions: totals.total_sessions,
          mat_minutes: totals.total_min,
          rounds: totals.total_rounds,
          current_streak_days: currentStreak(rows),
          submissions: stats.map((s) => ({ ...s, trend: trends[s.name] ?? "steady" })),
          insights,
        },
        null,
        2,
      ),
    );
  }

  if (name === "log_session" || name === "log_sessions") {
    const inputs: SessionInput[] =
      name === "log_sessions" ? ((Array.isArray(a.sessions) ? a.sessions : []) as SessionInput[]) : [a as SessionInput];
    if (!inputs.length) return text("No sessions given.", true);
    if (inputs.length > 50) return text("Too many sessions — max 50 per call.", true);
    const rows: Record<string, unknown>[] = [];
    for (const s of inputs) {
      const built = buildSessionRow("00000000-0000-0000-0000-000000000000", s);
      if (!built.ok) return text(`Could not save: ${built.error} Nothing was saved.`, true);
      const { user_id: _u, ...row } = built.row;
      void _u;
      rows.push(row);
    }
    const { data, error } = await supabase.rpc("mcp_create_sessions", { p_access_hash: tokenHash, p_rows: rows });
    if (error) rpcFail(error.message);
    const saved = (data ?? []) as SessionRow[];
    return text(`Saved ${saved.length} session${saved.length === 1 ? "" : "s"}:\n${saved.map(formatSession).join("\n")}`);
  }

  return text(`Unknown tool: ${name}`, true);
}
