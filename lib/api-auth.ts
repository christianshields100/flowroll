import "server-only";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

// --- Public REST API (/api/v1) plumbing ---
//
// Keys look like `frk_<32 url-safe chars>`. Only the sha256 hex of the full
// key is stored (api_keys.key_hash); auth happens inside SECURITY DEFINER
// RPCs (api_get_sessions etc.) which validate the hash, enforce scopes and
// a daily quota, and scope every query to the key's owner. The route
// handlers below never see a user session — just the anon client + RPCs.

export function apiClient() {
  return createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Pull the bearer key from the request and return its hash, or null. */
export function bearerHash(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(frk_[A-Za-z0-9_-]{10,})$/i);
  return m ? hashKey(m[1]) : null;
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function apiError(message: string, status: number) {
  return apiJson({ error: message }, status);
}

/** Map RPC exceptions raised by api_authenticate to HTTP responses. */
export function mapRpcError(message: string | undefined) {
  const msg = message ?? "";
  if (msg.includes("invalid_api_key"))
    return apiError("invalid or revoked API key", 401);
  if (msg.includes("insufficient_scope"))
    return apiError("this key does not have the required scope", 403);
  if (msg.includes("rate_limited"))
    return apiError("daily request limit reached (1000/day)", 429);
  return apiError("internal error", 500);
}

export function missingKeyResponse() {
  return apiError(
    "missing API key — send `Authorization: Bearer frk_...` (create keys in Settings)",
    401,
  );
}

export function optionsResponse() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
