import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CountUp } from "@/components/CountUp";
import { Avatar } from "@/components/Avatar";
import { BeltChip, SessionCard } from "@/components/SessionCard";
import { SessionSocialReadOnly } from "@/components/SessionSocialReadOnly";
import { sessionTotals } from "@/lib/stats";
import { displayName } from "@/lib/profile";
import { loadDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

// The sample athlete's profile, as a training partner would see it.
export default async function DemoProfile() {
  const demo = await loadDemo();
  if (!demo) notFound();
  const target = demo.profile;
  const rows = demo.sessions.slice(0, 30);
  const totals = sessionTotals(demo.sessions);

  return (
    <AppShell profile={demo.profile} active="profile" demo>
      <div className="rise flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5">
          <Avatar url={target.avatar_url} name={displayName(target)} belt={target.belt} size="lg" />
          <div>
            <h1 className="text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
              {displayName(target)}
            </h1>
            <p className="font-mono text-sm text-ink-mute">@{target.display_name}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <BeltChip belt={target.belt} stripes={target.stripes} />
              <span className="font-mono text-[11px] uppercase tracking-dojo text-ink-mute">
                {target.belt} belt
                {target.stripes ? ` · ${target.stripes} stripe${target.stripes > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            {target.home_gym_name && (
              <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
                <span className="uppercase tracking-dojo text-ink-mute">Home gym</span> · {target.home_gym_name}
              </p>
            )}
            <div className="mt-3 flex items-center gap-5">
              <span className="flex items-baseline gap-1.5">
                <span className="font-mono text-base num text-ink">{demo.followers}</span>
                <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                  {demo.followers === 1 ? "follower" : "followers"}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-mono text-base num text-ink">{demo.following}</span>
                <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">following</span>
              </span>
            </div>
          </div>
        </div>
        <div className="self-center">
          <button
            type="button"
            disabled
            title="Sign in to follow athletes"
            className="text-[13px] font-semibold px-5 py-2 bg-ink text-paper opacity-50 cursor-not-allowed"
          >
            Follow
          </button>
        </div>
      </div>

      <div className="belt-rule mt-8" />

      <div className="rise rise-1 mt-8 grid grid-cols-3 gap-6 sm:gap-10 max-w-xl">
        <Stat label="Sessions" value={totals.total_sessions} />
        <Stat label="Mat time" value={totals.total_min} format="hours" />
        <Stat label="Rounds" value={totals.total_rounds} />
      </div>

      <div className="rise rise-2 mt-8">
        <p className="text-[11px] uppercase tracking-dojo text-ink-mute">Recent entries</p>
        <ul className="mt-4 space-y-4">
          {rows.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              footer={
                <SessionSocialReadOnly
                  reactions={demo.reactionsBySession.get(s.id) ?? []}
                  comments={demo.commentsBySession.get(s.id) ?? []}
                />
              }
            />
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, format }: { label: string; value: number; format?: "plain" | "hours" }) {
  return (
    <div className="border-t border-ink pt-3">
      <p className="text-[11px] uppercase tracking-dojo text-ink-mute">{label}</p>
      <p className="mt-2 text-[30px] leading-none font-medium tracking-tightish num text-ink">
        <CountUp value={value} format={format} />
      </p>
    </div>
  );
}
