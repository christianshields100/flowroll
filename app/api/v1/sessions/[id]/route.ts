import {
  apiClient,
  apiError,
  apiJson,
  bearerHash,
  mapRpcError,
  missingKeyResponse,
  optionsResponse,
} from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/sessions/:id — one session (must belong to the key owner). */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const keyHash = bearerHash(req);
  if (!keyHash) return missingKeyResponse();

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(params.id)) return apiError("invalid session id", 400);

  const supabase = apiClient();
  const { data, error } = await supabase.rpc("api_get_session", {
    p_key_hash: keyHash,
    p_id: params.id,
  });
  if (error) return mapRpcError(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as Record<
    string,
    unknown
  > | null;
  if (!row) return apiError("session not found", 404);
  const rest = { ...row };
  delete rest.user_id;
  return apiJson({ session: rest });
}

export function OPTIONS() {
  return optionsResponse();
}
