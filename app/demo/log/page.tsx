import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LogForm } from "@/app/log/LogForm";
import { submissionSuggestions } from "@/lib/submissions";
import { DEMO_USER_ID, loadDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

// The real log form with the sample athlete's autocomplete; filing disabled.
export default async function DemoLog() {
  const demo = await loadDemo();
  if (!demo) notFound();
  const past = demo.sessions;
  const subSuggestions = submissionSuggestions(
    past.flatMap((s) => [...(s.subs_hit ?? []), ...(s.subs_caught_in ?? [])]),
  );
  const partnerSuggestions = Array.from(
    new Set(past.flatMap((s) => s.partners ?? []).map((p) => p.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const lastAttire = past.find((s) => s.attire)?.attire ?? null;

  return (
    <AppShell profile={demo.profile} active="log" demo>
      <div className="max-w-[640px]">
        <div className="rise border-b border-ink pb-6">
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
            New entry — Nº {past.length + 1}
          </p>
          <h1 className="mt-2 text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
            For the record.
          </h1>
        </div>
        <div className="mt-10">
          <LogForm
            uid={DEMO_USER_ID}
            defaultGym={demo.profile.home_gym_name}
            defaultGymPlaceId={null}
            defaultAttire={lastAttire}
            subSuggestions={subSuggestions}
            partnerSuggestions={partnerSuggestions}
            editSession={null}
            entryNo={past.length + 1}
            demo
          />
        </div>
      </div>
    </AppShell>
  );
}
