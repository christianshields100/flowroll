import "server-only";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

// OAuth 2.1 plumbing for the MCP connector. The app is both the resource
// server (/api/mcp) and the authorization server (/oauth/authorize,
// /api/oauth/token). Tokens are opaque; only sha256 hashes hit the database.

export const ISSUER = "https://www.flowroll.xyz";
export const MCP_RESOURCE = `${ISSUER}/api/mcp`;
export const SCOPES = ["read", "write"] as const;

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** PKCE S256: base64url(sha256(verifier)), compared to the stored challenge. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authServerMetadata() {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/api/oauth/token`,
    registration_endpoint: `${ISSUER}/api/oauth/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...SCOPES],
    service_documentation: `${ISSUER}/developers`,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "FlowRoll",
    resource_documentation: `${ISSUER}/developers`,
  };
}

export const OAUTH_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export function oauthJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...OAUTH_CORS, "Cache-Control": "no-store", ...extra },
  });
}

export function oauthError(error: string, description: string, status = 400) {
  return oauthJson({ error, error_description: description }, status);
}

/** Pull the MCP bearer token from a request and return its sha256, or null. */
export function bearerTokenHash(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(fra_[a-f0-9]{64})$/i);
  return m ? sha256Hex(m[1]) : null;
}
