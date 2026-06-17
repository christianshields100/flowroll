import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { BeltChip, type Belt } from "@/components/SessionCard";
import { follow, unfollow } from "@/app/feed/actions";
import { displayName, hasFullName } from "@/lib/profile";

type Kind = "followers" | "following";

type Person = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  belt: Belt;
  stripes: number;
  is_private: boolean;
  avatar_url: string | null;
};

export async function FollowListView({
  id,
  kind,
}: {
  id: string;
  kind: Kind;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!.id;

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name, belt, stripes, avatar_url")
    .eq("id", me)
    .single();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, display_name, is_private")
    .eq("id", id)
    .maybeSingle();
  if (!target) notFound();

  const { data: canView } = await supabase.rpc("can_view_follow_lists", {
    target: id,
  });

  const rpc = kind === "followers" ? "profile_followers" : "profile_following";
  const { data: peopleData } =
    canView === true
      ? await supabase.rpc(rpc, { target: id })
      : { data: [] as Person[] };
  const people = (peopleData ?? []) as Person[];

  // My relationship to each listed person, for the follow buttons.
  const otherIds = people.map((p) => p.id).filter((x) => x !== me);
  const { data: myRels } = otherIds.length
    ? await supabase
        .from("follows")
        .select("followee_id, status")
        .eq("follower_id", me)
        .in("followee_id", otherIds)
    : { data: [] as { followee_id: string; status: string }[] };
  const stateById = new Map<string, "following" | "requested">();
  for (const r of myRels ?? []) {
    stateById.set(
      r.followee_id,
      r.status === "accepted" ? "following" : "requested",
    );
  }

  const title = kind === "followers" ? "Followers" : "Following";

  return (
    <AppShell profile={myProfile} active={null}>
      <Link
        href={`/u/${id}`}
        className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
      >
        ← {target.display_name}
      </Link>
      <h1 className="mt-3 font-display text-3xl tracking-tightish">{title}</h1>
      <div className="belt-rule mt-5 max-w-sm" />

      <div className="mt-8 max-w-xl">
        {canView !== true ? (
          <div className="rounded-sm bg-paper-raised border border-paper-line p-8 text-center">
            <p className="font-display text-xl tracking-tightish">
              This account is private
            </p>
            <p className="mt-2 text-ink-dim">
              Follow {target.display_name} to see who{" "}
              {kind === "followers" ? "follows them" : "they follow"}.
            </p>
          </div>
        ) : people.length === 0 ? (
          <p className="text-sm text-ink-mute font-mono">
            {kind === "followers"
              ? "No followers yet."
              : "Not following anyone yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {people.map((p) => {
              const isMeRow = p.id === me;
              const state = stateById.get(p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-sm bg-paper-raised border border-paper-line px-3 py-2"
                >
                  <Link
                    href={`/u/${p.id}`}
                    className="flex items-center gap-3 min-w-0 group"
                  >
                    <Avatar
                      url={p.avatar_url}
                      name={displayName(p)}
                      belt={p.belt}
                      size="sm"
                    />
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="flex flex-col min-w-0">
                        <span className="text-sm text-ink truncate group-hover:text-accent transition">
                          {displayName(p)}
                        </span>
                        {hasFullName(p) && (
                          <span className="font-mono text-[10px] text-ink-mute truncate">
                            @{p.display_name}
                          </span>
                        )}
                      </span>
                      <BeltChip belt={p.belt} stripes={p.stripes} />
                    </span>
                  </Link>

                  {isMeRow ? (
                    <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                      You
                    </span>
                  ) : state === "following" ? (
                    <form action={unfollow}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className={btnGhost}>
                        Unfollow
                      </button>
                    </form>
                  ) : state === "requested" ? (
                    <form action={unfollow}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className={btnGhost}>
                        Requested
                      </button>
                    </form>
                  ) : (
                    <form action={follow}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className={btnPrimary}>
                        Follow
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

const btnPrimary =
  "font-mono text-[10px] uppercase tracking-dojo px-2.5 py-1 rounded-sm bg-accent text-paper hover:bg-accent-deep transition";
const btnGhost =
  "font-mono text-[10px] uppercase tracking-dojo px-2.5 py-1 rounded-sm border border-paper-line text-ink-dim hover:border-accent hover:text-accent transition";
