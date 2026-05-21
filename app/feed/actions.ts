"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Both actions are no-ops if the user isn't signed in or tries to follow themselves.
// RLS also enforces this, but we fail fast here for clean UX.

export async function follow(formData: FormData) {
  const targetId = formData.get("user_id");
  if (typeof targetId !== "string" || !targetId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === targetId) return;

  await supabase
    .from("follows")
    .insert({ follower_id: user.id, followee_id: targetId });

  revalidatePath("/feed");
}

export async function unfollow(formData: FormData) {
  const targetId = formData.get("user_id");
  if (typeof targetId !== "string" || !targetId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", targetId);

  revalidatePath("/feed");
}
