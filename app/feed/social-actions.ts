"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isReaction } from "@/lib/reactions";

// Reactions + comments on sessions. RLS is the real gate (can_view_session +
// own user_id); these checks just fail fast and keep the data clean.

// Add my reaction if it's not there, remove it if it is.
export async function toggleReaction(sessionId: string, emoji: string) {
  if (!sessionId || !isReaction(emoji)) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("session_reactions")
    .select("emoji")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("session_reactions")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .eq("emoji", emoji);
  } else {
    await supabase
      .from("session_reactions")
      .insert({ session_id: sessionId, user_id: user.id, emoji });
  }

  revalidatePath("/feed");
}

export async function addComment(sessionId: string, bodyRaw: string) {
  const body = (bodyRaw ?? "").trim();
  if (!sessionId || body.length < 1 || body.length > 2000) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("session_comments")
    .insert({ session_id: sessionId, user_id: user.id, body });

  revalidatePath("/feed");
}

// Delete a comment. RLS allows the comment's author or the session's owner.
export async function deleteComment(commentId: string) {
  if (!commentId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("session_comments").delete().eq("id", commentId);

  revalidatePath("/feed");
}
