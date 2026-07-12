// GET /api/whoop/callback — WHOOP redirects back here with ?code&state.
// Verify state, exchange the code, fetch the WHOOP user id, store the
// connection, then kick off an initial 90-day sync before returning to settings.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, syncWhoop, WHOOP_SCOPES } from "@/lib/whoop";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("whoop_oauth_state")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/settings?whoop=${reason}`);

  if (url.searchParams.get("error")) return fail("denied");
  if (!code || !state || !cookieState || state !== cookieState)
    return fail("state");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tok = await exchangeCode(code);

    // Identify the WHOOP account (needed to route webhooks to this user).
    const profRes = await fetch(
      "https://api.prod.whoop.com/developer/v2/user/profile/basic",
      { headers: { Authorization: `Bearer ${tok.access_token}` }, cache: "no-store" },
    );
    if (!profRes.ok) return fail("profile");
    const prof = (await profRes.json()) as { user_id: number };

    await supabase.from("whoop_connections").upsert(
      {
        user_id: user.id,
        whoop_user_id: prof.user_id,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
        scopes: tok.scope ?? WHOOP_SCOPES,
      },
      { onConflict: "user_id" },
    );

    // Best-effort initial backfill; don't fail the connect if a page errors.
    try {
      await syncWhoop(user.id, 90);
    } catch {
      /* the settings page / dashboard will retry the sync */
    }
  } catch {
    return fail("exchange");
  }

  const res = NextResponse.redirect(`${origin}/settings?whoop=connected`);
  res.cookies.delete("whoop_oauth_state");
  return res;
}
