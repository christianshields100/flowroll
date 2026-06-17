"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const BELTS = ["white", "blue", "purple", "brown", "black"];

// Save the whole Edit Profile form in one shot — name, DoB, belt, stripes, and
// home gym — so the page has a single Save button and sections can't clobber
// each other. (Photo uploads straight to storage via its own component.)
export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const first = (formData.get("first_name") ?? "").toString().trim() || null;
  const last = (formData.get("last_name") ?? "").toString().trim() || null;
  const dob = (formData.get("dob") ?? "").toString().trim() || null;
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
    })
    .eq("id", user.id);

  revalidatePath(`/u/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  redirect(`/u/${user.id}`);
}
