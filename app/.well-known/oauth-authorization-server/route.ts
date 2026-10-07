import { authServerMetadata, oauthJson, OAUTH_CORS } from "@/lib/oauth";
export const dynamic = "force-dynamic";
export async function GET() { return oauthJson(authServerMetadata()); }
export async function OPTIONS() { return new Response(null, { status: 204, headers: OAUTH_CORS }); }
