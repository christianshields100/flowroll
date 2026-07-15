import {
  apiClient,
  apiJson,
  bearerHash,
  mapRpcError,
  missingKeyResponse,
  optionsResponse,
} from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const keyHash = bearerHash(req);
  if (!keyHash) return missingKeyResponse();

  const supabase = apiClient();
  const { data, error } = await supabase.rpc("api_get_profile", {
    p_key_hash: keyHash,
  });
  if (error) return mapRpcError(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return apiJson({ error: "profile not found" }, 404);
  return apiJson({ profile: row });
}

export function OPTIONS() {
  return optionsResponse();
}
