import {
  apiClient,
  apiError,
  apiJson,
  bearerHash,
  mapRpcError,
  missingKeyResponse,
  optionsResponse,
} from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Strip the internal user_id before returning session rows — the key already
// identifies the owner, and keeping ids out of payloads keeps scripts simple.
function publicSession(s: Record<string, unknown>) {
  const rest = { ...s };
  delete rest.user_id;
  return rest;
}

/**
 * GET /api/v1/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50&offset=0
 * Lists the key owner's sessions, newest first.
 */
export async function GET(req: Request) {
  const keyHash = bearerHash(req);
  if (!keyHash) return missingKeyResponse();

  const url = new URL(req.url);
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !dateRe.test(from)) || (to && !dateRe.test(to)))
    return apiError("from/to must be YYYY-MM-DD", 400);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isFinite(limit) || !Number.isFinite(offset))
    return apiError("limit/offset must be numbers", 400);

  const supabase = apiClient();
  const { data, error } = await supabase.rpc("api_get_sessions", {
    p_key_hash: keyHash,
    p_from: from,
    p_to: to,
    p_limit: Math.trunc(limit),
    p_offset: Math.trunc(offset),
  });
  if (error) return mapRpcError(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  return apiJson({
    sessions: rows.map(publicSession),
    count: rows.length,
    offset: Math.trunc(offset),
  });
}

/**
 * POST /api/v1/sessions — log a session (requires a key with the `write`
 * scope). Body: { trained_on, duration_min, rounds?, gym?, feel?,
 * subs_hit?, subs_caught_in?, partners?, drilled?, note? }
 */
export async function POST(req: Request) {
  const keyHash = bearerHash(req);
  if (!keyHash) return missingKeyResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError("request body must be JSON", 400);
  }

  const trainedOn = body.trained_on;
  const durationMin = body.duration_min;
  if (typeof trainedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(trainedOn))
    return apiError("trained_on is required (YYYY-MM-DD)", 400);
  const dur = Number(durationMin);
  if (!Number.isFinite(dur) || dur <= 0 || dur >= 600)
    return apiError("duration_min is required (1-599)", 400);
  const feel = body.feel == null ? 3 : Number(body.feel);
  if (!Number.isInteger(feel) || feel < 1 || feel > 5)
    return apiError("feel must be an integer 1-5", 400);
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 20) : [];

  const supabase = apiClient();
  const { data, error } = await supabase.rpc("api_create_session", {
    p_key_hash: keyHash,
    p_trained_on: trainedOn,
    p_duration_min: Math.trunc(dur),
    p_rounds: Number.isFinite(Number(body.rounds))
      ? Math.max(0, Math.min(99, Math.trunc(Number(body.rounds))))
      : 0,
    p_gym: typeof body.gym === "string" ? body.gym.slice(0, 120) : null,
    p_feel: feel,
    p_subs_hit: strArr(body.subs_hit),
    p_subs_caught_in: strArr(body.subs_caught_in),
    p_partners: strArr(body.partners),
    p_drilled:
      typeof body.drilled === "string" ? body.drilled.slice(0, 500) : null,
    p_note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
  });
  if (error) return mapRpcError(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as Record<
    string,
    unknown
  > | null;
  return apiJson({ session: row ? publicSession(row) : null }, 201);
}

export function OPTIONS() {
  return optionsResponse();
}
