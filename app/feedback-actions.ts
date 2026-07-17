"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// In-app feedback. Rows land in the `feedback` table (insert-own RLS);
// read them in the Supabase table editor, newest first.

export async function submitFeedback(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const message = String(formData.get("message") ?? "").trim().slice(0, 2000);
  if (!message) return { error: "Write a little something first." };
  const ratingRaw = Number(formData.get("rating"));
  const rating =
    Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
      ? ratingRaw
      : null;
  const context = String(formData.get("context") ?? "").slice(0, 100) || null;

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    rating,
    message,
    context,
  });
  if (error) return { error: "Couldn't save that — try again." };

  // Giving feedback also retires the dashboard prompt.
  await supabase
    .from("profiles")
    .update({ feedback_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function dismissFeedbackPrompt() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  await supabase
    .from("profiles")
    .update({ feedback_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  return { ok: true };
}
