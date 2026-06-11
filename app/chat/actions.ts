"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Wipe the signed-in user's Coach conversation. RLS limits the delete to
// their own rows; the eq() keeps intent explicit.
export async function clearConversation(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("chat_messages").delete().eq("user_id", user.id);
  revalidatePath("/chat");
}
