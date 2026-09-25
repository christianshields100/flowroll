"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Belt-history maintenance. The trigger on profiles creates rows; these
// actions only correct them: undo the latest promotion (restores the prior
// rank via the RPC) or fix a promotion's date.

export async function undoLastPromotion() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.rpc("undo_last_promotion");
  if (error) {
    return {
      error: error.message.includes("nothing_to_undo")
        ? "Nothing to undo."
        : "Couldn't undo that — try again.",
    };
  }
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

export async function updatePromotionDate(id: string, promotedOn: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(promotedOn)) return { error: "Pick a date." };
  if (promotedOn > new Date().toISOString().slice(0, 10)) {
    return { error: "That's in the future." };
  }

  // RLS restricts this to the caller's own rows.
  const { error } = await supabase
    .from("belt_history")
    .update({ promoted_on: promotedOn })
    .eq("id", id);
  if (error) return { error: "Couldn't save the date." };
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}
