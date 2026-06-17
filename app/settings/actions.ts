"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const BELTS = ["white", "blue", "purple", "brown", "black"];

// Save the Edit Profile form (name, DoB, belt, stripes). Photo and home gym
// are their own components/actions.
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

  await supabase
    .from("profiles")
    .update({ first_name: first, last_name: last, dob, belt, stripes })
    .eq("id", user.id);

  revalidatePath(`/u/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  redirect(`/u/${user.id}`);
}
