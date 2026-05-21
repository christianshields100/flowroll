import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { LogForm } from "./LogForm";

export default async function LogPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, belt, stripes")
    .eq("id", user!.id)
    .single();

  // Prefill "Gym" with whatever they used last — small UX nicety.
  const { data: lastSession } = await supabase
    .from("sessions")
    .select("gym")
    .eq("user_id", user!.id)
    .order("trained_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell profile={profile} active="log">
      <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
        Log a session
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tightish">
        What did you roll?
      </h1>
      <div className="belt-rule mt-6 max-w-sm" />

      <div className="mt-10">
        <LogForm defaultGym={lastSession?.gym ?? null} />
      </div>
    </AppShell>
  );
}
