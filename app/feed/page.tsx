import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { parseDateOnly, type SessionRow } from "@/lib/stats";
import { follow, unfollow } from "./actions";

type Belt = "white" | "blue" | "purple" | "brown" | "black";
type Profile = {
  id: string;
  display_name: string;
  belt: Belt;
  stripes: number;
};

const BELT_BG: Record<Belt, string> = {
  white: "bg-belt-white",
  blue: "bg-belt-blue",
  purple: "bg-belt-purple",
  brown: "bg-belt-brown",
  black: "bg-belt-black",
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!.id;

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("display_name, belt, stripes")
    .eq("id", me)
    .single();

  // Who I follow → ids + their profiles.
  const { data: followRows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", me);
  const followedIds = (followRows ?? []).map((r) => r.followee_id as string);

  const { data: followedProfilesData } = followedIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, belt, stripes")
        .in("id", followedIds)
    : { data: [] as Profile[] };
  const followedProfiles = (followedProfilesData ?? []) as Profile[];

  // Search results — only run if a query is present.
  const q = (searchParams.q ?? "").trim();
  let searchResults: Profile[] = [];
  if (q) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, belt, stripes")
      .ilike("display_name", `%${q}%`)
      .neq("id", me)
      .limit(10);
    searchResults = (data ?? []) as Profile[];
  }
  const followedSet = new Set(followedIds);

  // Feed: sessions from followed users only. RLS would allow our own too;
  // explicit IN keeps the feed scoped to partners.
  const { data: feedSessionsData } = followedIds.length
    ? await supabase
        .from("sessions")
        .select(
          "id, user_id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, feel, gym, drilled, note, created_at",
        )
        .in("user_id", followedIds)
        .order("trained_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };
  const feedSessions = (feedSessionsData ?? []) as (SessionRow & {
    user_id: string;
  })[];

  const profileById = new Map(followedProfiles.map((p) => [p.id, p]));

  return (
    <AppShell profile={myProfile} active="feed">
      <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute">
        Feed
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tightish">
        Who&apos;s on the mat?
      </h1>
      <div className="belt-rule mt-6 max-w-sm" />

      <div className="mt-10 grid lg:grid-cols-[1fr_2fr] gap-10">
        {/* LEFT: people */}
        <section className="space-y-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
              Find people
            </p>
            <form method="get" action="/feed" className="mt-3 flex gap-2">
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search by name…"
                className="flex-1 bg-paper border border-paper-line rounded-sm px-3 py-2 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition text-sm"
              />
              <button
                type="submit"
                className="font-mono text-[10px] uppercase tracking-dojo px-3 py-2 rounded-sm bg-accent text-paper hover:bg-accent-deep transition"
              >
                Search
              </button>
            </form>

            {q && (
              <ul className="mt-4 space-y-2">
                {searchResults.length === 0 ? (
                  <li className="text-sm text-ink-mute font-mono">
                    No matches for &ldquo;{q}&rdquo;.
                  </li>
                ) : (
                  searchResults.map((p) => (
                    <PersonRow
                      key={p.id}
                      profile={p}
                      isFollowing={followedSet.has(p.id)}
                    />
                  ))
                )}
              </ul>
            )}
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
              Following · {followedProfiles.length}
            </p>
            <ul className="mt-3 space-y-2">
              {followedProfiles.length === 0 ? (
                <li className="text-sm text-ink-mute font-mono">
                  Not following anyone yet.
                </li>
              ) : (
                followedProfiles.map((p) => (
                  <PersonRow key={p.id} profile={p} isFollowing />
                ))
              )}
            </ul>
          </div>
        </section>

        {/* RIGHT: feed */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
            Timeline
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tightish">
            Recent sessions
          </h2>

          {feedSessions.length === 0 ? (
            <div className="mt-5 rounded-sm bg-paper-raised border border-paper-line p-6">
              <p className="text-ink-dim">
                {followedProfiles.length === 0
                  ? "Follow a training partner and their sessions land here."
                  : "Nothing from your circle yet. Check back after they roll."}
              </p>
            </div>
          ) : (
            <ul className="mt-5 space-y-4">
              {feedSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  author={profileById.get(s.user_id) ?? null}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PersonRow({
  profile,
  isFollowing,
}: {
  profile: Profile;
  isFollowing: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-sm bg-paper-raised border border-paper-line px-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <BeltChip belt={profile.belt} stripes={profile.stripes} />
        <span className="text-sm text-ink truncate">
          {profile.display_name}
        </span>
      </div>
      <form action={isFollowing ? unfollow : follow}>
        <input type="hidden" name="user_id" value={profile.id} />
        <button
          type="submit"
          className={
            isFollowing
              ? "font-mono text-[10px] uppercase tracking-dojo px-2.5 py-1 rounded-sm border border-paper-line text-ink-dim hover:border-accent hover:text-accent transition"
              : "font-mono text-[10px] uppercase tracking-dojo px-2.5 py-1 rounded-sm bg-accent text-paper hover:bg-accent-deep transition"
          }
        >
          {isFollowing ? "Unfollow" : "Follow"}
        </button>
      </form>
    </li>
  );
}

function BeltChip({ belt, stripes }: { belt: Belt; stripes: number }) {
  return (
    <span
      aria-hidden
      className={`block h-3 w-6 ${BELT_BG[belt]} rounded-[1px] relative overflow-hidden flex-shrink-0`}
    >
      {Array.from({ length: stripes }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 bottom-0 w-[3px] bg-belt-stripe/95"
          style={{ right: `${4 + i * 5}px` }}
        />
      ))}
    </span>
  );
}

function SessionCard({
  session,
  author,
}: {
  session: SessionRow & { user_id: string };
  author: Profile | null;
}) {
  const date = parseDateOnly(session.trained_on).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <li className="rounded-sm bg-paper-raised border border-paper-line p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {author && <BeltChip belt={author.belt} stripes={author.stripes} />}
          <span className="font-display text-base tracking-tightish truncate">
            {author?.display_name ?? "Unknown"}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-dojo text-ink-mute">
            {date}
            {session.gym ? ` · ${session.gym}` : ""}
          </span>
        </div>
        <span className="font-mono text-[11px] num text-ink-dim whitespace-nowrap">
          {session.duration_min}m · {session.rounds}r
        </span>
      </div>

      {session.drilled && (
        <p className="mt-3 text-sm text-ink">{session.drilled}</p>
      )}
      {session.note && (
        <p className="mt-1 text-sm text-ink-dim italic">{session.note}</p>
      )}

      {(session.subs_hit?.length || session.subs_caught_in?.length) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {session.subs_hit?.map((x, i) => (
            <span
              key={`h-${i}`}
              className="font-mono text-[10px] uppercase tracking-dojo px-2 py-0.5 rounded-sm bg-accent/10 text-accent border border-accent/30"
            >
              {x}
            </span>
          ))}
          {session.subs_caught_in?.map((x, i) => (
            <span
              key={`c-${i}`}
              className="font-mono text-[10px] uppercase tracking-dojo px-2 py-0.5 rounded-sm bg-belt-black/10 text-belt-black border border-belt-black/30"
            >
              ✗ {x}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}
