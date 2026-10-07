// The FlowRoll MCP server (Streamable HTTP, stateless). One JSON-RPC request
// per POST; auth is an OAuth bearer token issued by /api/oauth/token.
import { apiClient } from "@/lib/api-auth";
import { bearerTokenHash, oauthJson, OAUTH_CORS, ISSUER } from "@/lib/oauth";
import { MCP_INSTRUCTIONS, MCP_SERVER_INFO, MCP_TOOLS, McpAuthError, runMcpTool } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

function unauthorized(desc: string) {
  return oauthJson({ error: "unauthorized", error_description: desc }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource/api/mcp", error="invalid_token", error_description="${desc}"`,
  });
}

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

// No server-initiated stream in this server; clients fall back to plain POST.
export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { ...OAUTH_CORS, Allow: "POST, DELETE, OPTIONS" } });
}

export async function DELETE() {
  return new Response(null, { status: 200, headers: OAUTH_CORS });
}

export async function POST(req: Request) {
  const tokenHash = bearerTokenHash(req);
  if (!tokenHash) return unauthorized("Connect your FlowRoll account to use this server.");

  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return oauthJson(rpcError(null, -32700, "Parse error"), 400);
  }
  const batch = Array.isArray(body);
  const requests = batch ? (body as RpcRequest[]) : [body as RpcRequest];
  const supabase = apiClient();
  const responses: unknown[] = [];

  for (const r of requests) {
    const { id, method, params } = r;
    if (!method) {
      responses.push(rpcError(id, -32600, "Invalid Request"));
      continue;
    }
    // Notifications carry no id and get no response.
    if (id === undefined || id === null) continue;

    try {
      if (method === "initialize") {
        const requested = (params?.protocolVersion as string) ?? PROTOCOL_VERSIONS[0];
        responses.push(
          rpcResult(id, {
            protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: MCP_SERVER_INFO,
            instructions: MCP_INSTRUCTIONS,
          }),
        );
      } else if (method === "ping") {
        responses.push(rpcResult(id, {}));
      } else if (method === "tools/list") {
        responses.push(rpcResult(id, { tools: MCP_TOOLS }));
      } else if (method === "tools/call") {
        const name = String(params?.name ?? "");
        const result = await runMcpTool(supabase, tokenHash, name, params?.arguments);
        responses.push(rpcResult(id, result));
      } else if (method === "resources/list" || method === "prompts/list") {
        responses.push(rpcResult(id, method === "resources/list" ? { resources: [] } : { prompts: [] }));
      } else {
        responses.push(rpcError(id, -32601, `Method not found: ${method}`));
      }
    } catch (err) {
      if (err instanceof McpAuthError) return unauthorized(err.message);
      responses.push(rpcError(id, -32603, err instanceof Error ? err.message : "Internal error"));
    }
  }

  if (responses.length === 0) return new Response(null, { status: 202, headers: OAUTH_CORS });
  return oauthJson(batch ? responses : responses[0]);
}
