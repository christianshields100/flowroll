// Auth callback — handles BOTH magic-link and Google OAuth.
// Supabase redirects here with a ?code= parameter; we exchange it for a session.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${url.origin}${next}`);
    }
  }

  // Failed or missing code — back to login with a flag.
  return NextResponse.redirect(`${url.origin}/login?error=auth`);
}
