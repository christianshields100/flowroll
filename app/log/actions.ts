"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// Validate + extract the shared session fields from form data.
function parseSessionFields(formData: FormData):
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; message: string } {
  const trained_on = formData.get("trained_on");
  const duration_min = Number(formData.get("duration_min"));
  const rounds = Number(formData.get("rounds"));
  const feel = Number(formData.get("feel"));
  const gym = (formData.get("gym") ?? "").toString().trim() || null;
  const drilled = (formData.get("drilled") ?? "").toString().trim() || null;
  const note = (formData.get("note") ?? "").toString().trim() || null;
  const subs_hit = parseSubs(formData.get("subs_hit"));
  const subs_caught_in = parseSubs(formData.get("subs_caught_in"));
  const partners = parseSubs(formData.get("partners"));

  if (!trained_on || typeof trained_on !== "string") {
    return { ok: false, message: "Pick a date." };
  }
  if (!Number.isFinite(duration_min) || duration_min <= 0) {
    return { ok: false, message: "Duration must be a positive number." };
  }
  if (!Number.isFinite(rounds) || rounds < 0) {
    return { ok: false, message: "Rounds must be 0 or more." };
  }
  if (!Number.isFinite(feel) || feel < 1 || feel > 5) {
    return { ok: false, message: "Pick a feel rating (1–5)." };
  }

  return {
    ok: true,
    fields: {
      trained_on,
      duration_min,
      rounds,
      feel,
      gym,
      drilled,
      note,
      subs_hit,
      subs_caught_in,
      partners,
    },
  };
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

  const parsed = parseSessionFields(formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message };
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, ...parsed.fields })
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { status: "ok", sessionId: data.id };
}

export async function updateSession(
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

  const sessionId = (formData.get("session_id") ?? "").toString();
  if (!sessionId) {
    return { status: "error", message: "Missing session id." };
  }

  const parsed = parseSessionFields(formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message };
  }

  // RLS only permits updating your own rows; the eq() is belt and suspenders.
  const { error } = await supabase
    .from("sessions")
    .update(parsed.fields)
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  // Server-side redirect — more reliable than a client router.push from an
  // effect, which can be cancelled by concurrent refreshes.
  redirect("/dashboard");
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !sessionId) return;

  await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/feed");
}
