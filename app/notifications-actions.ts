"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAllNotificationsRead() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  return { ok: true };
}

export async function markNotificationRead(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  return { ok: true };
}

export async function updateNotificationPrefs(prefs: {
  social: boolean;
  partners: boolean;
  journey: boolean;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { error } = await supabase
    .from("profiles")
    .update({
      notification_prefs: {
        social: !!prefs.social,
        partners: !!prefs.partners,
        journey: !!prefs.journey,
      },
    })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save." };
  revalidatePath("/settings");
  return { ok: true };
}
