"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Permanent account deletion (compliance item 5). The SECURITY DEFINER RPC
// removes the user's storage objects and the auth.users row in one
// transaction; every app table cascades from auth.users, so the entire
// footprint — profile, sessions, media, chat, feedback, API
// keys, follows, reactions, comments — goes with it, immediately.
export async function deleteMyAccount() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    return { error: "Deletion failed — try again or email us." };
  }

  // The auth user no longer exists; clear the local session cookies.
  await supabase.auth.signOut();
  redirect("/");
}
