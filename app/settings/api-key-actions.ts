"use server";

import { createClient } from "@/lib/supabase/server";
import { hashKey } from "@/lib/api-auth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

// API key management for the public REST API (/api/v1). The raw key is
// returned to the caller exactly once; only its sha256 lands in the DB.

export async function createApiKey(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Give the key a name." };
  const write = formData.get("write") === "on";

  // Cap keys per user so a stuck script can't fill the table.
  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("revoked", false);
  if ((count ?? 0) >= 10)
    return { error: "Limit of 10 active keys — revoke one first." };

  const rawKey = "frk_" + randomBytes(24).toString("base64url");
  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    name,
    prefix: rawKey.slice(0, 12),
    key_hash: hashKey(rawKey),
    scopes: write ? ["read", "write"] : ["read"],
  });
  if (error) return { error: "Could not create the key. Try again." };

  revalidatePath("/settings");
  // The only time the raw key ever leaves the server.
  return { key: rawKey };
}

export async function revokeApiKey(keyId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS restricts the update to the caller's own keys.
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked: true })
    .eq("id", keyId);
  if (error) return { error: "Could not revoke the key." };

  revalidatePath("/settings");
  return { ok: true };
}
