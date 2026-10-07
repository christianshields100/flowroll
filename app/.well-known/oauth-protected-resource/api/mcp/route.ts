import { oauthJson, OAUTH_CORS, protectedResourceMetadata } from "@/lib/oauth";
export const dynamic = "force-dynamic";
export async function GET() { return oauthJson(protectedResourceMetadata()); }
export async function OPTIONS() { return new Response(null, { status: 204, headers: OAUTH_CORS }); }
