"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The athlete clicked Allow (or Deny) on the consent screen.
export async function decideAuthorization(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const challenge = String(formData.get("code_challenge") ?? "");
  const scope = String(formData.get("scope") ?? "read write");
  const decision = String(formData.get("decision") ?? "deny");

  let target: URL;
  try {
    target = new URL(redirectUri);
  } catch {
    redirect("/oauth/authorize?error=invalid_request");
  }
  if (state) target.searchParams.set("state", state);

  if (decision !== "allow") {
    target.searchParams.set("error", "access_denied");
    redirect(target.toString());
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("oauth_issue_code", {
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
    p_code_challenge: challenge,
    p_scope: scope,
  });
  if (error || !data) {
    target.searchParams.set("error", "server_error");
    redirect(target.toString());
  }
  target.searchParams.set("code", String(data));
  redirect(target.toString());
}
