// GET /api/whoop/connect — kick off the WHOOP OAuth flow.
// Signs in check, sets a short-lived state cookie (CSRF), redirects to WHOOP.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whoopAuthUrl, whoopConfigured } from "@/lib/whoop";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!whoopConfigured())
    return NextResponse.redirect(`${origin}/settings?whoop=unconfigured`);

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(whoopAuthUrl(state));
  res.cookies.set("whoop_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
