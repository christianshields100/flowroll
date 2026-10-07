// OAuth token endpoint: authorization_code (with PKCE S256) and refresh_token.
import { apiClient } from "@/lib/api-auth";
import { oauthError, oauthJson, OAUTH_CORS, pkceChallenge, sha256Hex } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

async function readParams(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await req.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    out[k] = String(v);
  });
  return out;
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  let p: Record<string, string>;
  try {
    p = await readParams(req);
  } catch {
    return oauthError("invalid_request", "could not parse request body");
  }
  const clientId = p.client_id ?? "";
  if (!UUID.test(clientId)) return oauthError("invalid_client", "client_id is required", 401);
  const supabase = apiClient();

  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.code_verifier || !p.redirect_uri)
      return oauthError("invalid_request", "code, code_verifier and redirect_uri are required");
    const { data, error } = await supabase.rpc("oauth_exchange_code", {
      p_code_hash: sha256Hex(p.code),
      p_client_id: clientId,
      p_redirect_uri: p.redirect_uri,
      p_verifier_challenge: pkceChallenge(p.code_verifier),
    });
    if (error) return oauthError("invalid_grant", "authorization code is invalid, expired, or already used");
    return oauthJson({ token_type: "Bearer", ...(data as Record<string, unknown>) });
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return oauthError("invalid_request", "refresh_token is required");
    const { data, error } = await supabase.rpc("oauth_refresh", {
      p_refresh_hash: sha256Hex(p.refresh_token),
      p_client_id: clientId,
    });
    if (error) return oauthError("invalid_grant", "refresh token is invalid or expired");
    return oauthJson({ token_type: "Bearer", refresh_token: p.refresh_token, ...(data as Record<string, unknown>) });
  }

  return oauthError("unsupported_grant_type", "use authorization_code or refresh_token");
}
