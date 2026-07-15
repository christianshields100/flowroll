import {
  apiClient,
  apiJson,
  bearerHash,
  mapRpcError,
  missingKeyResponse,
  optionsResponse,
} from "@/lib/api-auth";
import {
  currentStreak,
  periodBuckets,
  sessionTotals,
  submissionStats,
  type SessionRow,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/stats — lifetime totals, current streak, submission scorecard,
 * and weekly volume (last 8 weeks). Computed from the key owner's sessions
 * with the same code that powers the dashboard.
 */
export async function GET(req: Request) {
  const keyHash = bearerHash(req);
  if (!keyHash) return missingKeyResponse();

  const supabase = apiClient();
  // 200 per page (RPC cap); pull everything for accurate lifetime stats.
  const all: SessionRow[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase.rpc("api_get_sessions", {
      p_key_hash: keyHash,
      p_limit: 200,
      p_offset: offset,
    });
    if (error) return mapRpcError(error.message);
    const rows = (data ?? []) as SessionRow[];
    all.push(...rows);
    if (rows.length < 200) break;
  }

  const totals = sessionTotals(all);
  const streak = currentStreak(all);
  const submissions = submissionStats(all);
  const weekly = periodBuckets(all, "week").map((b) => ({
    week_start: b.key,
    mat_min: b.mat_min,
    rounds: b.rounds,
    subs_hit: b.subs_hit,
    subs_caught_in: b.subs_caught_in,
    feel_avg: b.feel_avg,
  }));

  return apiJson({ totals, streak, submissions, weekly_volume: weekly });
}

export function OPTIONS() {
  return optionsResponse();
}
