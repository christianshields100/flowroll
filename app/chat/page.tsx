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
    .select("display_name, belt, stripes")
    .eq("id", user!.id)
    .single();

  return (
    <AppShell profile={profile} active="chat">
      <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
        Coach
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tightish">
        Ask your training log.
      </h1>
      <p className="mt-2 text-ink-dim max-w-xl">
        Questions about your sessions, notes, submissions — or BJJ in general.
        Nothing else; Coach stays on the mat.
      </p>
      <div className="belt-rule mt-6 max-w-sm" />

      <div className="mt-8">
        <ChatPanel />
      </div>
    </AppShell>
  );
}
