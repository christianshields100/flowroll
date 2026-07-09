// GET /api/keepalive — pinged by a Vercel cron (see vercel.json) so the
// Supabase free-tier project registers activity and never auto-pauses (idle
// projects pause after ~7 days, which takes the whole site down).
//
// It runs one trivial PostgREST query via fetch — no session needed; RLS
// filters the rows to nothing for anon, but the SQL still executes, which is
// what counts as activity. If CRON_SECRET is set in Vercel, the endpoint
// requires it (Vercel sends it automatically for cron invocations); without
// one it's public but harmless.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: "Supabase env missing" }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return Response.json(
      { ok: res.ok, status: res.status, at: new Date().toISOString() },
      { status: res.ok ? 200 : 502 },
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}
