"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncWhoop } from "@/lib/whoop";

// Manual "Sync now" from the settings card.
export async function syncWhoopNow() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await syncWhoop(user.id, 30);
  } catch {
    /* surfaced via the card's last-synced timestamp not advancing */
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

// Disconnect: drop the connection row (synced metrics/workouts are kept — they
// stay useful; re-connecting refreshes them).
export async function disconnectWhoop() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("whoop_connections").delete().eq("user_id", user.id);
  revalidatePath("/settings");
}
