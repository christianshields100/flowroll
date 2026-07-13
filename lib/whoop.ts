import "server-only";
import { createClient } from "@/lib/supabase/server";

// WHOOP v2 OAuth + data sync. Tokens live in whoop_connections (owner-only
// RLS); this module runs on the server with the caller's cookie-bound client,
// so every read/write is already scoped to them. Requires two env vars set in
// Vercel: WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET.

const WHOOP_AUTH = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API = "https://api.prod.whoop.com/developer";

// Everything we need for the five features; `offline` is what buys a refresh token.
export const WHOOP_SCOPES =
  "read:recovery read:cycles read:workout read:sleep read:profile offline";

export function whoopConfigured(): boolean {
  return Boolean(
    process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET,
  );
}

export function whoopRedirectUri(): string {
  // Must EXACTLY match a redirect URL registered in the WHOOP app. Pin it to
  // the canonical production URL (or an explicit override for local dev) rather
  // than deriving from NEXT_PUBLIC_SITE_URL, which may be an apex/preview/
  // localhost value that wouldn't match what's registered and breaks OAuth.
  const override = process.env.WHOOP_REDIRECT_URL?.replace(/\/$/, "");
  return override || "https://www.flowroll.xyz/api/whoop/callback";
}

export function whoopAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: whoopRedirectUri(),
    response_type: "code",
    scope: WHOOP_SCOPES,
    state,
  });
  return `${WHOOP_AUTH}?${p.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(WHOOP_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`WHOOP token exchange failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(code: string) {
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: whoopRedirectUri(),
  });
}

type SupabaseServer = ReturnType<typeof createClient>;

// Return a valid access token for the user, refreshing (and persisting the new
// refresh token — WHOOP rotates it) if it's within 2 minutes of expiry.
async function freshAccessToken(
  supabase: SupabaseServer,
  userId: string,
): Promise<string | null> {
  const { data: conn } = await supabase
    .from("whoop_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) return null;

  const expMs = new Date(conn.expires_at).getTime();
  if (expMs - Date.now() > 120_000) return conn.access_token;

  const t = await postToken({
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token,
    scope: WHOOP_SCOPES,
  });
  await supabase
    .from("whoop_connections")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);
  return t.access_token;
}

async function whoopGet(
  token: string,
  path: string,
  params: Record<string, string>,
): Promise<{ records: unknown[]; next_token?: string }> {
  const url = new URL(`${WHOOP_API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WHOOP GET ${path} -> ${res.status}`);
  const j = (await res.json()) as { records?: unknown[]; next_token?: string };
  return { records: j.records ?? [], next_token: j.next_token };
}

// Walk a paginated WHOOP collection since `start` (ISO), capped so a first sync
// can't run away.
async function collect(
  token: string,
  path: string,
  start: string,
  maxPages = 12,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let next: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string> = { start, limit: "25" };
    if (next) params.nextToken = next;
    const page = await whoopGet(token, path, params);
    out.push(...(page.records as Record<string, unknown>[]));
    next = page.next_token;
    if (!next) break;
  }
  return out;
}

function localDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// Pull recovery + cycles + sleep + workouts since `sinceDays` ago and upsert
// into our tables. Recovery/cycle/sleep collapse into one whoop_cycles row per
// day; workouts land individually and get matched to a logged session.
export async function syncWhoop(
  userId: string,
  sinceDays = 90,
): Promise<{ cycles: number; workouts: number }> {
  const supabase = createClient();
  const token = await freshAccessToken(supabase, userId);
  if (!token) return { cycles: 0, workouts: 0 };

  const start = new Date(
    Date.now() - sinceDays * 24 * 3600 * 1000,
  ).toISOString();

  const [recoveries, cycles, sleeps, workouts] = await Promise.all([
    collect(token, "/v2/recovery", start),
    collect(token, "/v2/cycle", start),
    collect(token, "/v2/activity/sleep", start),
    collect(token, "/v2/activity/workout", start),
  ]);

  // Build per-day rows. Cycles give day strain + the anchor date; recovery adds
  // score/HRV/RHR; sleep adds performance + hours.
  const byDay = new Map<string, Record<string, number | null>>();
  const dayRow = (d: string) => {
    let r = byDay.get(d);
    if (!r) {
      r = {
        day_strain: null,
        recovery_score: null,
        hrv_ms: null,
        resting_hr: null,
        sleep_performance: null,
        sleep_hours: null,
      };
      byDay.set(d, r);
    }
    return r;
  };

  const cycleIdToDay = new Map<string, string>();
  for (const c of cycles) {
    const s = c.start as string | undefined;
    if (!s) continue;
    const d = localDate(s);
    cycleIdToDay.set(String(c.id), d);
    const score = c.score as { strain?: number } | undefined;
    if (score?.strain != null) dayRow(d).day_strain = score.strain;
  }
  for (const rec of recoveries) {
    const cid = rec.cycle_id != null ? String(rec.cycle_id) : null;
    const d = cid ? cycleIdToDay.get(cid) : undefined;
    if (!d) continue;
    const sc = rec.score as
      | { recovery_score?: number; hrv_rmssd_milli?: number; resting_heart_rate?: number }
      | undefined;
    const row = dayRow(d);
    if (sc?.recovery_score != null) row.recovery_score = sc.recovery_score;
    if (sc?.hrv_rmssd_milli != null) row.hrv_ms = sc.hrv_rmssd_milli;
    if (sc?.resting_heart_rate != null) row.resting_hr = sc.resting_heart_rate;
  }
  for (const sl of sleeps) {
    if ((sl as { nap?: boolean }).nap) continue;
    const s = sl.start as string | undefined;
    if (!s) continue;
    const d = localDate(sl.end as string); // credit sleep to wake day
    const sc = sl.score as
      | {
          sleep_performance_percentage?: number;
          stage_summary?: { total_in_bed_time_milli?: number };
        }
      | undefined;
    const row = dayRow(d);
    if (sc?.sleep_performance_percentage != null)
      row.sleep_performance = sc.sleep_performance_percentage;
    const inBed = sc?.stage_summary?.total_in_bed_time_milli;
    if (inBed != null) row.sleep_hours = Math.round((inBed / 3.6e6) * 10) / 10;
    void s;
  }

  const cycleRows = Array.from(byDay.entries()).map(([day, r]) => ({
    user_id: userId,
    day,
    ...r,
    updated_at: new Date().toISOString(),
  }));
  if (cycleRows.length) {
    await supabase
      .from("whoop_cycles")
      .upsert(cycleRows, { onConflict: "user_id,day" });
  }

  // Workouts.
  const woRows = workouts
    .filter((w) => w.id && w.start && w.end)
    .map((w) => {
      const sc = w.score as
        | {
            strain?: number;
            average_heart_rate?: number;
            max_heart_rate?: number;
            kilojoule?: number;
          }
        | undefined;
      return {
        id: String(w.id),
        user_id: userId,
        started_at: w.start as string,
        ended_at: w.end as string,
        local_date: localDate(w.start as string),
        sport: (w.sport_name as string) ?? (w.sport_id != null ? String(w.sport_id) : null),
        strain: sc?.strain ?? null,
        avg_hr: sc?.average_heart_rate ?? null,
        max_hr: sc?.max_heart_rate ?? null,
        kilojoules: sc?.kilojoule ?? null,
        updated_at: new Date().toISOString(),
      };
    });
  if (woRows.length) {
    await supabase
      .from("whoop_workouts")
      .upsert(woRows, { onConflict: "id" });
  }

  await matchWorkoutsToSessions(supabase, userId);

  await supabase
    .from("whoop_connections")
    .update({ needs_sync: false, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { cycles: cycleRows.length, workouts: woRows.length };
}

// Sync if a webhook flagged new data, or it's been >6h. Safe to call on every
// dashboard load — returns fast when nothing's due. Never throws.
export async function maybeSyncWhoop(userId: string): Promise<void> {
  try {
    const supabase = createClient();
    const { data: conn } = await supabase
      .from("whoop_connections")
      .select("needs_sync, last_synced_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conn) return;
    const stale =
      !conn.last_synced_at ||
      Date.now() - new Date(conn.last_synced_at).getTime() > 6 * 3600 * 1000;
    if (conn.needs_sync || stale) await syncWhoop(userId, 30);
  } catch {
    /* non-fatal — the card's timestamp shows staleness */
  }
}

export type WhoopWorkout = {
  session_id: string | null;
  strain: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  kilojoules: number | null;
  local_date: string | null;
  sport: string | null;
};
export type WhoopDay = {
  day: string;
  day_strain: number | null;
  recovery_score: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  sleep_performance: number | null;
  sleep_hours: number | null;
};

// Is the caller's WHOOP connected? (Cheap existence check.)
export async function whoopConnected(
  supabase: SupabaseServer,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("whoop_connections")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

// Matched workouts for the user's sessions, keyed by session_id.
export async function whoopBySession(
  supabase: SupabaseServer,
  userId: string,
): Promise<Map<string, WhoopWorkout>> {
  const { data } = await supabase
    .from("whoop_workouts")
    .select("session_id, strain, avg_hr, max_hr, kilojoules, local_date, sport")
    .eq("user_id", userId)
    .not("session_id", "is", null);
  const map = new Map<string, WhoopWorkout>();
  for (const w of (data ?? []) as WhoopWorkout[]) {
    if (w.session_id) map.set(w.session_id, w);
  }
  return map;
}

export type WhoopNudge = {
  id: string;
  local_date: string | null;
  sport: string | null;
  strain: number | null;
  minutes: number;
};

// BJJ-ish WHOOP workouts with no logged session and no dismissed nudge — the
// "WHOOP saw jiu-jitsu, want to log it?" prompts.
export async function whoopUnloggedWorkouts(
  supabase: SupabaseServer,
  userId: string,
): Promise<WhoopNudge[]> {
  const { data } = await supabase
    .from("whoop_workouts")
    .select("id, local_date, sport, strain, started_at, ended_at")
    .eq("user_id", userId)
    .is("session_id", null)
    .eq("nudge_dismissed", false)
    .order("started_at", { ascending: false })
    .limit(5);
  return ((data ?? []) as Record<string, unknown>[])
    .filter((w) => isBjjSport(w.sport as string))
    .map((w) => ({
      id: String(w.id),
      local_date: (w.local_date as string) ?? null,
      sport: (w.sport as string) ?? null,
      strain: (w.strain as number) ?? null,
      minutes: Math.max(
        0,
        Math.round(
          (new Date(w.ended_at as string).getTime() -
            new Date(w.started_at as string).getTime()) /
            60000,
        ),
      ),
    }));
}

export async function whoopDays(
  supabase: SupabaseServer,
  userId: string,
): Promise<WhoopDay[]> {
  const { data } = await supabase
    .from("whoop_cycles")
    .select(
      "day, day_strain, recovery_score, hrv_ms, resting_hr, sleep_performance, sleep_hours",
    )
    .eq("user_id", userId)
    .order("day", { ascending: true });
  return (data ?? []) as WhoopDay[];
}

const BJJ_SPORT = /jiu|jitsu|bjj|grappl|wrestl|martial|boxing|mma/i;

export function isBjjSport(sport: string | null | undefined): boolean {
  return Boolean(sport && BJJ_SPORT.test(sport));
}

// Link each unmatched workout to a same-day session (prefer BJJ-typed
// workouts). Cheap heuristic: same local date, session not already linked.
async function matchWorkoutsToSessions(
  supabase: SupabaseServer,
  userId: string,
) {
  const { data: workouts } = await supabase
    .from("whoop_workouts")
    .select("id, local_date, sport, session_id")
    .eq("user_id", userId)
    .is("session_id", null);
  if (!workouts?.length) return;

  const dates = Array.from(new Set(workouts.map((w) => w.local_date).filter(Boolean)));
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, trained_on")
    .eq("user_id", userId)
    .in("trained_on", dates as string[]);
  if (!sessions?.length) return;

  const takenSessions = new Set<string>();
  const { data: linked } = await supabase
    .from("whoop_workouts")
    .select("session_id")
    .eq("user_id", userId)
    .not("session_id", "is", null);
  for (const l of linked ?? []) if (l.session_id) takenSessions.add(l.session_id);

  const byDate = new Map<string, string[]>();
  for (const s of sessions) {
    const arr = byDate.get(s.trained_on) ?? [];
    arr.push(s.id);
    byDate.set(s.trained_on, arr);
  }

  // BJJ-ish workouts first so they claim the session over an incidental run.
  const ordered = [...workouts].sort(
    (a, b) => Number(isBjjSport(b.sport)) - Number(isBjjSport(a.sport)),
  );
  for (const w of ordered) {
    const candidates = (byDate.get(w.local_date) ?? []).filter(
      (id) => !takenSessions.has(id),
    );
    if (!candidates.length) continue;
    const sid = candidates[0];
    takenSessions.add(sid);
    await supabase
      .from("whoop_workouts")
      .update({ session_id: sid })
      .eq("id", w.id);
  }
}
