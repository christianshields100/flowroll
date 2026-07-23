import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { ChatPanel } from "./ChatPanel";

export default async function ChatPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name, belt, stripes, avatar_url")
    .eq("id", user!.id)
    .single();

  // Restore the saved conversation (most recent 50 turns, oldest first).
  const { data: saved } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const initialMessages = (saved ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

  return (
    <AppShell profile={profile} active="chat">
      <div className="max-w-[680px] mx-auto">
        <div className="text-center border-b border-ink pb-6">
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
            Correspondence with
          </p>
          <h1 className="mt-2 text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
            The Coach.
          </h1>
          <p className="mt-2 text-sm italic text-ink-mute">
            Reads your entire log. Politely declines everything else.
          </p>
        </div>

        <div className="mt-8">
          <ChatPanel initialMessages={initialMessages} />
        </div>
      </div>
    </AppShell>
  );
}
