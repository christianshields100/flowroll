import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name, dob, belt, stripes, avatar_url")
    .eq("id", user!.id)
    .single();

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="font-display text-2xl tracking-tightish">flowroll</span>
          <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute mt-3">
            Set up your profile
          </p>
        </div>
        <div className="bg-paper-raised border border-paper-line rounded-sm p-7 shadow-paper">
          <OnboardingWizard
            uid={user!.id}
            username={profile?.display_name ?? ""}
            initial={{
              first_name: profile?.first_name ?? "",
              last_name: profile?.last_name ?? "",
              dob: profile?.dob ?? "",
              belt: profile?.belt ?? "white",
              stripes: profile?.stripes ?? 0,
              avatar_url: profile?.avatar_url ?? null,
            }}
          />
        </div>
      </div>
    </main>
  );
}
