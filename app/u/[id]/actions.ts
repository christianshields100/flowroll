"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Save the public URL of the just-uploaded avatar to the caller's profile.
// The actual upload happens client-side straight to storage (gated by storage
// RLS to the user's own folder); this only records the resulting URL.
export async function updateAvatarUrl(url: string) {
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);

  revalidatePath(`/u/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
}
