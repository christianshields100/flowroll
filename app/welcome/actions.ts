"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const BELTS = ["white", "blue", "purple", "brown", "black"];

// Finish first-time setup: save the collected fields and flip `onboarded` so
// the middleware stops redirecting here. Photo (if added) was already saved by
// the AvatarUploader.
export async function completeOnboarding(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const first = (formData.get("first_name") ?? "").toString().trim() || null;
  const last = (formData.get("last_name") ?? "").toString().trim() || null;
  const dob = (formData.get("dob") ?? "").toString().trim() || null;
  // Age gate (Terms §2): under-13 DoB is never saved; the date input's
  // client-side max gives the visible feedback.
  if (dob && isUnder13(dob)) return;
  const beltRaw = (formData.get("belt") ?? "").toString();
  const belt = BELTS.includes(beltRaw) ? beltRaw : "white";
  const stripes = Math.min(
    4,
    Math.max(0, Math.floor(Number(formData.get("stripes")) || 0)),
  );
  const homeGymName =
    (formData.get("home_gym_name") ?? "").toString().trim() || null;
  const homeGymPlaceId =
    (formData.get("home_gym_place_id") ?? "").toString().trim() || null;

  await supabase
    .from("profiles")
    .update({
      first_name: first,
      last_name: last,
      dob,
      belt,
      stripes,
      home_gym_name: homeGymName,
      home_gym_place_id: homeGymPlaceId,
      onboarded: true,
    })
    .eq("id", user.id);

  redirect("/dashboard");
}

// Age gate (Terms §2): 13+ enforced from date of birth, server-side.
function isUnder13(dobStr: string): boolean {
  const dob = new Date(dobStr + "T00:00:00");
  if (isNaN(dob.getTime())) return false; // unparseable → let it through as null-ish
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 13);
  return dob > cutoff;
}
