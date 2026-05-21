"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LogActionState =
  | { status: "idle" }
  | { status: "ok"; sessionId: string }
  | { status: "error"; message: string };

// Split a free-text "submission" input ("triangle, kimura, rnc") into trimmed array.
function parseSubs(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function logSession(
  _prev: LogActionState,
  formData: FormData,
): Promise<LogActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  const trained_on = formData.get("trained_on");
  const duration_min = Number(formData.get("duration_min"));
  const rounds = Number(formData.get("rounds"));
  const feel = Number(formData.get("feel"));
  const gym = (formData.get("gym") ?? "").toString().trim() || null;
  const drilled = (formData.get("drilled") ?? "").toString().trim() || null;
  const note = (formData.get("note") ?? "").toString().trim() || null;
  const subs_hit = parseSubs(formData.get("subs_hit"));
  const subs_caught_in = parseSubs(formData.get("subs_caught_in"));

  if (!trained_on || typeof trained_on !== "string") {
    return { status: "error", message: "Pick a date." };
  }
  if (!Number.isFinite(duration_min) || duration_min <= 0) {
    return { status: "error", message: "Duration must be a positive number." };
  }
  if (!Number.isFinite(rounds) || rounds < 0) {
    return { status: "error", message: "Rounds must be 0 or more." };
  }
  if (!Number.isFinite(feel) || feel < 1 || feel > 5) {
    return { status: "error", message: "Pick a feel rating (1–5)." };
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      trained_on,
      duration_min,
      rounds,
      feel,
      gym,
      drilled,
      note,
      subs_hit,
      subs_caught_in,
    })
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { status: "ok", sessionId: data.id };
}
