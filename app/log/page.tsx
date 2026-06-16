import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { submissionSuggestions } from "@/lib/submissions";
import type { SessionRow } from "@/lib/stats";
import { LogForm } from "./LogForm";

export default async function LogPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, belt, stripes, avatar_url")
    .eq("id", user!.id)
    .single();

  // Past sessions feed the autocomplete: gym prefill, previously-used
  // submission names, and previously-logged partners.
  const { data: pastSessions } = await supabase
    .from("sessions")
    .select("gym, subs_hit, subs_caught_in, partners")
    .eq("user_id", user!.id)
    .order("trained_on", { ascending: false })
    .limit(200);

  const past = pastSessions ?? [];
  const pastSubs = past.flatMap((s) => [
    ...(s.subs_hit ?? []),
    ...(s.subs_caught_in ?? []),
  ]);
  const subSuggestions = submissionSuggestions(pastSubs);

  // Partner suggestions: people you've logged before + people you follow
  // (accepted follows only — pending requests aren't training partners yet).
  const { data: followRows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", user!.id)
    .eq("status", "accepted");
  const followedIds = (followRows ?? []).map((r) => r.followee_id as string);
  const { data: followedProfiles } = followedIds.length
    ? await supabase
        .from("profiles")
        .select("display_name")
        .in("id", followedIds)
    : { data: [] as { display_name: string }[] };

  const partnerSeen = new Map<string, string>();
  for (const name of [
    ...past.flatMap((s) => s.partners ?? []),
    ...(followedProfiles ?? []).map((p) => p.display_name),
  ]) {
    const key = name.trim().toLowerCase();
    if (key && !partnerSeen.has(key)) partnerSeen.set(key, name.trim());
  }
  const partnerSuggestions = Array.from(partnerSeen.values()).sort((a, b) =>
    a.localeCompare(b),
  );

  // Edit mode: ?edit=<session id>. RLS means this only resolves for own rows.
  let editSession: SessionRow | null = null;
  if (searchParams.edit) {
    const { data } = await supabase
      .from("sessions")
      .select(
        "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, created_at",
      )
      .eq("id", searchParams.edit)
      .eq("user_id", user!.id)
      .maybeSingle();
    editSession = (data as SessionRow | null) ?? null;
  }

  return (
    <AppShell profile={profile} active="log">
      <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
        {editSession ? "Edit session" : "Log a session"}
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tightish">
        {editSession ? "Fix the record." : "What did you roll?"}
      </h1>
      <div className="belt-rule mt-6 max-w-sm" />

      <div className="mt-10">
        <LogForm
          key={editSession?.id ?? "new"}
          defaultGym={past[0]?.gym ?? null}
          subSuggestions={subSuggestions}
          partnerSuggestions={partnerSuggestions}
          editSession={editSession}
        />
      </div>
    </AppShell>
  );
}
