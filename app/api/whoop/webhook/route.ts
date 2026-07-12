// POST /api/whoop/webhook — WHOOP pushes here when new data lands.
// We verify the HMAC signature, then only flip needs_sync for that WHOOP user
// via a SECURITY DEFINER RPC (the webhook has no session and can't read tokens
// or write data). The dashboard performs the actual sync on next load.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.WHOOP_CLIENT_SECRET;
  const signature = request.headers.get("x-whoop-signature");
  const ts = request.headers.get("x-whoop-signature-timestamp");
  const raw = await request.text();

  if (!secret || !signature || !ts) {
    return Response.json({ ok: false }, { status: 401 });
  }

  // WHOOP signs base64( HMAC-SHA256( timestamp + rawBody ) ).
  const expected = createHmac("sha256", secret)
    .update(ts + raw)
    .digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const evt = JSON.parse(raw) as { user_id?: number };
    if (evt.user_id != null) {
      // Anon client + definer RPC — the only write a webhook can make.
      const supabase = createClient();
      await supabase.rpc("whoop_mark_needs_sync", {
        p_whoop_user_id: evt.user_id,
      });
    }
  } catch {
    /* malformed body — still 200 so WHOOP doesn't retry-storm */
  }

  return Response.json({ ok: true });
}
