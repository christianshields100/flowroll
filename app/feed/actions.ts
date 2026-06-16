"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Both actions are no-ops if the user isn't signed in or tries to follow themselves.
// RLS also enforces this, but we fail fast here for clean UX.

export async function follow(formData: FormData) {
  const targetId = formData.get("user_id");
  if (typeof targetId !== "string" || !targetId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === targetId) return;

  await supabase
    .from("follows")
    .insert({ follower_id: user.id, followee_id: targetId });

  revalidatePath("/feed");
}

// Unfollow an accepted follow, or cancel a pending request — same delete.
export async function unfollow(formData: FormData) {
  const targetId = formData.get("user_id");
  if (typeof targetId !== "string" || !targetId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", targetId);

  revalidatePath("/feed");
}

// Accept a pending follow request aimed at me.
export async function acceptFollowRequest(formData: FormData) {
  const requesterId = formData.get("user_id");
  if (typeof requesterId !== "string" || !requesterId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("follower_id", requesterId)
    .eq("followee_id", user.id)
    .eq("status", "pending");

  revalidatePath("/feed");
}

// Decline a pending request OR remove an existing follower — both delete the
// follow row where I'm the followee (RLS: "delete as followee").
export async function removeFollower(formData: FormData) {
  const followerId = formData.get("user_id");
  if (typeof followerId !== "string" || !followerId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followee_id", user.id);

  revalidatePath("/feed");
}

// Toggle account privacy. Going public auto-accepts any pending requests
// (Instagram behavior — a public account has nothing to gate).
export async function setAccountPrivacy(formData: FormData) {
  const makePrivate = formData.get("is_private") === "true";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ is_private: makePrivate })
    .eq("id", user.id);

  if (!makePrivate) {
    await supabase
      .from("follows")
      .update({ status: "accepted" })
      .eq("followee_id", user.id)
      .eq("status", "pending");
  }

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}
