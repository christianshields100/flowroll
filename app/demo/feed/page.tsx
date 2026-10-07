import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { BeltChip, SessionCard } from "@/components/SessionCard";
import { SessionSocialReadOnly } from "@/components/SessionSocialReadOnly";
import { displayName } from "@/lib/profile";
import { loadDemo, type DemoPerson } from "@/lib/demo";

export const dynamic = "force-dynamic";

// The sample athlete's feed: her training partners' sessions, read-only.
export default async function DemoFeed() {
  const demo = await loadDemo();
  if (!demo) notFound();
  const following = demo.followingIds.map((id) => demo.people.get(id)).filter(Boolean) as DemoPerson[];
  const followers = demo.followerIds.map((id) => demo.people.get(id)).filter(Boolean) as DemoPerson[];

  return (
    <AppShell profile={demo.profile} active="feed" demo>
      <div className="rise border-b border-ink pb-6">
        <p className="text-[11px] uppercase tracking-dojo text-ink-mute">Dispatches from the mats</p>
        <h1 className="mt-2 text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
          The circle.
        </h1>
      </div>

      <div className="rise rise-2 mt-10 grid lg:grid-cols-[1fr_2fr] gap-10">
        <section className="space-y-8">
          <div className="rounded-sm bg-paper-raised border border-paper-line p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">Your account</p>
                <p className="mt-1 text-sm text-ink">Public</p>
              </div>
              <button type="button" disabled className={btnGhost + " opacity-50 cursor-not-allowed"}>
                Switch to private
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-mute leading-relaxed">
              Anyone can follow you and see your sessions in their feed.
            </p>
          </div>

          <PeopleList title={`Following · ${following.length}`} people={following} action="Unfollow" />
          {followers.length > 0 && (
            <PeopleList title={`Followers · ${followers.length}`} people={followers} action="Remove" />
          )}
        </section>

        <section>
          <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">Timeline</p>
          <h2 className="mt-1 font-display text-2xl tracking-tightish">Recent sessions</h2>
          <ul className="mt-5 space-y-4">
            {demo.feed.map((s) => {
              const author = demo.people.get(s.user_id);
              return (
                <SessionCard
                  key={s.id}
                  session={s}
                  author={
                    author
                      ? { display_name: displayName(author), belt: author.belt, stripes: author.stripes }
                      : null
                  }
                  footer={
                    <SessionSocialReadOnly
                      reactions={demo.reactionsBySession.get(s.id) ?? []}
                      comments={demo.commentsBySession.get(s.id) ?? []}
                    />
                  }
                />
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function PeopleList({ title, people, action }: { title: string; people: DemoPerson[]; action: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">{title}</p>
      <ul className="mt-3 space-y-2">
        {people.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-sm bg-paper-raised border border-paper-line px-3 py-2"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Avatar url={p.avatar_url} name={displayName(p)} belt={p.belt} size="sm" />
              <span className="text-sm text-ink truncate">{displayName(p)}</span>
              <BeltChip belt={p.belt} stripes={p.stripes} />
            </span>
            <button type="button" disabled className={btnGhost + " opacity-50 cursor-not-allowed"}>
              {action}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const btnGhost =
  "text-[13px] px-5 py-2 border border-paper-input text-ink-dim transition-colors";
