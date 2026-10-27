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
      home_gym_name: homeGymName,
      home_gym_place_id: homeGymPlaceId,
    })
    .eq("id", user.id);

  // Belt and stripes are not a plain column write: the athlete says whether
  // the change is a promotion (journey entry, dated) or a correction (no
  // entry), and set_belt() keeps belt_history consistent either way.
  const { data: current } = await supabase
    .from("profiles")
    .select("belt, stripes")
    .eq("id", user.id)
    .single();
  if (current && (current.belt !== belt || current.stripes !== stripes)) {
    const kindRaw = (formData.get("belt_change_kind") ?? "").toString();
    const up = rankOf(belt, stripes) > rankOf(current.belt, current.stripes);
    // A "promotion" to a lower rank can't be one; treat it as a correction.
    const kind = kindRaw === "promotion" && up ? "promotion" : "correction";
    const dateRaw = (formData.get("promoted_on") ?? "").toString();
    const promotedOn =
      kind === "promotion" && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;
    await supabase.rpc("set_belt", {
      p_belt: belt,
      p_stripes: stripes,
      p_kind: kind,
      p_promoted_on: promotedOn,
    });
  }

  revalidatePath(`/u/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  redirect(`/u/${user.id}`);
}

function rankOf(belt: string, stripes: number): number {
  return Math.max(0, BELTS.indexOf(belt)) * 5 + stripes;
}

// Age gate (Terms §2): 13+ enforced from date of birth, server-side.
function isUnder13(dobStr: string): boolean {
  const dob = new Date(dobStr + "T00:00:00");
  if (isNaN(dob.getTime())) return false; // unparseable → let it through as null-ish
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 13);
  return dob > cutoff;
}
