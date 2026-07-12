"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function dismissWhoopNudge(workoutId: string) {
  if (!workoutId) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("whoop_workouts")
    .update({ nudge_dismissed: true })
    .eq("id", workoutId)
    .eq("user_id", user.id);
  revalidatePath("/dashboard");
}
