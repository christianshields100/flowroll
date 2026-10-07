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
  "to read the log; log_session / log_sessions to save training they describe; " +
  "update_session to fix or complete an entry (never log a duplicate — find the id with " +
  "list_sessions and update it); delete_session to remove one; update_profile for name, " +
  "belt, stripes, home gym, or privacy. Dates are YYYY-MM-DD. Never give medical or " +
  "injury advice — point them to a professional.";

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
  {
    name: "update_session",
    description:
      "Edit an existing session. Pass the session id (from list_sessions) plus only the fields to change. Arrays replace the whole list. Use this instead of logging a corrected duplicate.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Session id." }, ...SESSION_PROPS },
      required: ["id"],
    },
  },
  {
    name: "delete_session",
    description: "Permanently delete one session by id (and any photos attached to it). Confirm with the athlete first.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "update_profile",
    description:
      "Update the athlete's profile: first_name, last_name, belt (white|blue|purple|brown|black), stripes (0–4), home_gym_name, is_private. A higher belt/stripes is recorded as a promotion on their journey timeline.",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        belt: { type: "string", enum: ["white", "blue", "purple", "brown", "black"] },
        stripes: { type: "number", minimum: 0, maximum: 4 },
        home_gym_name: { type: "string" },
        is_private: { type: "boolean", description: "Private accounts approve followers." },
      },
    },
  },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_TYPES = ["training", "open_mat", "competition", "private"];

// Validate a partial session patch (only the keys present), or explain why not.
function buildSessionPatch(a: Record<string, unknown>): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const patch: Record<string, unknown> = {};
  const clean = (v: unknown) =>
    (Array.isArray(v) ? v : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  if ("trained_on" in a) {
    if (typeof a.trained_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(a.trained_on)) return { ok: false, error: "trained_on must be YYYY-MM-DD." };
    patch.trained_on = a.trained_on;
  }
  if ("duration_min" in a) {
    const d = Math.floor(Number(a.duration_min));
    if (!Number.isFinite(d) || d < 1 || d > 599) return { ok: false, error: "duration_min must be 1–599." };
    patch.duration_min = d;
  }
  if ("rounds" in a) patch.rounds = Math.min(99, Math.max(0, Math.floor(Number(a.rounds) || 0)));
  if ("feel" in a) {
    const f = Math.floor(Number(a.feel));
    if (!Number.isFinite(f) || f < 1 || f > 5) return { ok: false, error: "feel must be 1–5." };
    patch.feel = f;
  }
  for (const k of ["gym", "drilled", "note", "comp_result"]) if (k in a) patch[k] = a[k] == null ? "" : String(a[k]);
  for (const k of ["subs_hit", "subs_caught_in", "partners"]) if (k in a) patch[k] = clean(a[k]);
  if ("session_type" in a) {
    if (!SESSION_TYPES.includes(String(a.session_type))) return { ok: false, error: "session_type must be training, open_mat, competition, or private." };
    patch.session_type = a.session_type;
  }
  if ("attire" in a) {
    if (a.attire != null && a.attire !== "" && a.attire !== "gi" && a.attire !== "nogi") return { ok: false, error: "attire must be gi or nogi." };
    patch.attire = a.attire ?? "";
  }
  return { ok: true, patch };
}

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

  if (name === "update_session") {
    const id = String(a.id ?? "");
    if (!UUID_RE.test(id)) return text("id must be a session id from list_sessions.", true);
    const { id: _id, ...fields } = a;
    void _id;
    const built = buildSessionPatch(fields);
    if (!built.ok) return text(built.error, true);
    if (Object.keys(built.patch).length === 0) return text("Nothing to change — pass at least one field.", true);
    const { data, error } = await supabase.rpc("mcp_update_session", { p_access_hash: tokenHash, p_id: id, p_patch: built.patch });
    if (error) {
      if (error.message.includes("not_found")) return text("No session with that id in this athlete's log.", true);
      rpcFail(error.message);
    }
    const row = (data as SessionRow[])?.[0];
    return row ? text(`Updated:\n${formatSession(row)}`) : text("No session with that id in this athlete's log.", true);
  }

  if (name === "delete_session") {
    const id = String(a.id ?? "");
    if (!UUID_RE.test(id)) return text("id must be a session id from list_sessions.", true);
    const { error } = await supabase.rpc("mcp_delete_session", { p_access_hash: tokenHash, p_id: id });
    if (error) {
      if (error.message.includes("not_found")) return text("No session with that id in this athlete's log.", true);
      rpcFail(error.message);
    }
    return text(`Deleted session ${id}.`);
  }

  if (name === "update_profile") {
    const patch: Record<string, unknown> = {};
    for (const k of ["first_name", "last_name", "home_gym_name"]) if (k in a) patch[k] = a[k] == null ? "" : String(a[k]).slice(0, 120);
    if ("belt" in a) patch.belt = String(a.belt).toLowerCase();
    if ("stripes" in a) patch.stripes = Math.floor(Number(a.stripes));
    if ("is_private" in a) patch.is_private = Boolean(a.is_private);
    if (Object.keys(patch).length === 0) return text("Nothing to change — pass at least one field.", true);
    const { data, error } = await supabase.rpc("mcp_update_profile", { p_access_hash: tokenHash, p_patch: patch });
    if (error) {
      if (error.message.includes("invalid_belt")) return text("belt must be white, blue, purple, brown, or black.", true);
      if (error.message.includes("invalid_stripes")) return text("stripes must be 0–4.", true);
      rpcFail(error.message);
    }
    const p = (data as unknown[])?.[0];
    return p ? text(`Profile updated:\n${JSON.stringify(p, null, 2)}`) : text("Profile not found.", true);
  }

  return text(`Unknown tool: ${name}`, true);
}
