"use server";

import { createClient } from "@/lib/supabase/server";

// Content reports (Terms §5). Rows land in the reports table for operator
// review; insert-own RLS means users can only file as themselves.
export async function reportContent(
  targetType: "session" | "comment" | "profile",
  targetId: string,
  reason: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const cleanReason = reason.trim().slice(0, 1000);
  if (!cleanReason) return { error: "Say briefly what's wrong." };
  if (!["session", "comment", "profile"].includes(targetType)) {
    return { error: "Invalid report." };
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason: cleanReason,
  });
  if (error) return { error: "Couldn't file the report — try again." };
  return { ok: true };
}
