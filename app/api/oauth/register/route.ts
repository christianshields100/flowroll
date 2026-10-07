// OAuth dynamic client registration (RFC 7591). AI tools call this once to
// get a client_id before sending the athlete to /oauth/authorize.
import { apiClient } from "@/lib/api-auth";
import { oauthError, oauthJson, OAUTH_CORS } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return oauthError("invalid_client_metadata", "request body must be JSON");
  }
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u) => typeof u === "string") : [];
  if (!uris.length) return oauthError("invalid_redirect_uri", "redirect_uris is required");
  const name = typeof body.client_name === "string" ? body.client_name : "AI assistant";

  const { data, error } = await apiClient().rpc("oauth_register_client", { p_name: name, p_redirect_uris: uris });
  if (error) return oauthError("invalid_redirect_uri", "redirect_uris must be absolute URLs");

  return oauthJson(
    {
      client_id: data,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "read write",
    },
    201,
  );
}
