import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { displayName } from "@/lib/profile";
import { parseDateOnly, type SessionRow } from "@/lib/stats";
import { fetchSessionSocial } from "@/lib/social";
import { SessionSocial } from "@/components/SessionSocial";
import { SessionMedia } from "@/components/SessionMedia";
import {
  acceptFollowRequest,
  follow,
  removeFollower,
  setAccountPrivacy,
  unfollow,
} from "./actions";

type Belt = "white" | "blue" | "purple" | "brown" | "black";
type Profile = {
  id: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  belt: Belt;
  stripes: number;
  is_private?: boolean;
  avatar_url?: string | null;
};
// What the signed-in user's relationship to a profile is.
type FollowState = "following" | "requested" | "none";

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
    .select(
      "id, display_name, first_name, last_name, belt, stripes, is_private, avatar_url, home_gym_place_id, home_gym_name",
    )
    .eq("id", me)
    .single();

  // Outgoing: who I follow (accepted) and who I've requested (pending).
  const { data: outgoing } = await supabase
    .from("follows")
    .select("followee_id, status")
    .eq("follower_id", me);
  const followedIds = (outgoing ?? [])
    .filter((r) => r.status === "accepted")
    .map((r) => r.followee_id as string);
  const requestedIds = new Set(
    (outgoing ?? [])
      .filter((r) => r.status === "pending")
      .map((r) => r.followee_id as string),
  );

  // Incoming: pending requests to approve + my accepted followers.
  const { data: incoming } = await supabase
    .from("follows")
    .select("follower_id, status")
    .eq("followee_id", me);
  const requesterIds = (incoming ?? [])
    .filter((r) => r.status === "pending")
    .map((r) => r.follower_id as string);
  const followerIds = (incoming ?? [])
    .filter((r) => r.status === "accepted")
    .map((r) => r.follower_id as string);

  // One profile fetch for everyone we need to render.
  const neededIds = Array.from(
    new Set([...followedIds, ...requesterIds, ...followerIds]),
  );
  const { data: knownProfilesData } = neededIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, belt, stripes, is_private, avatar_url")
        .in("id", neededIds)
    : { data: [] as Profile[] };
  const profileById = new Map(
    ((knownProfilesData ?? []) as Profile[]).map((p) => [p.id, p]),
  );

  const followedProfiles = followedIds
    .map((id) => profileById.get(id))
    .filter(Boolean) as Profile[];
  const requesterProfiles = requesterIds
    .map((id) => profileById.get(id))
    .filter(Boolean) as Profile[];
  const followerProfiles = followerIds
    .map((id) => profileById.get(id))
    .filter(Boolean) as Profile[];

  // Search results — only run if a query is present.
  const q = (searchParams.q ?? "").trim();
  let searchResults: Profile[] = [];
  if (q) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, first_name, last_name, belt, stripes, is_private, avatar_url")
      .or(
        `display_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`,
      )
      .neq("id", me)
      .limit(10);
    searchResults = (data ?? []) as Profile[];
  }
  const followedSet = new Set(followedIds);
  const stateFor = (id: string): FollowState =>
    followedSet.has(id) ? "following" : requestedIds.has(id) ? "requested" : "none";

  // Cold start: people who share my home gym that I don't already follow.
  let gymSuggestions: Profile[] = [];
  if (myProfile?.home_gym_place_id) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, display_name, first_name, last_name, belt, stripes, is_private, avatar_url",
      )
      .eq("home_gym_place_id", myProfile.home_gym_place_id)
      .neq("id", me)
      .limit(12);
    gymSuggestions = ((data ?? []) as Profile[])
      .filter((p) => !followedSet.has(p.id) && !requestedIds.has(p.id))
      .slice(0, 5);
  }

  // Have I logged anything yet? Drives the "log your first session" nudge.
  const { count: mySessionCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me);

  // Feed: sessions from accepted follows only. RLS enforces this too;
  // the explicit IN keeps the feed scoped and the query cheap.
  const { data: feedSessionsData } = followedIds.length
    ? await supabase
        .from("sessions")
        .select(
          "id, user_id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, media_urls, created_at",
        )
        .in("user_id", followedIds)
        .order("trained_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };
  const feedSessions = (feedSessionsData ?? []) as (SessionRow & {
    user_id: string;
  })[];

  // Reactions + comments for the sessions we're about to render.
  const { reactionsBySession, commentsBySession } = await fetchSessionSocial(
    supabase,
    feedSessions.map((s) => ({ id: s.id, user_id: s.user_id })),
    me,
  );

  return (
    <AppShell profile={myProfile} active="feed">
      <div className="border-b border-ink pb-6">
        <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
          Dispatches from the mats
        </p>
        <h1 className="mt-2 text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
          The circle.
        </h1>
      </div>

      <div className="mt-10 grid lg:grid-cols-[1fr_2fr] gap-10">
        {/* LEFT: people */}
        <section className="space-y-8">
          <PrivacyCard isPrivate={myProfile?.is_private ?? false} />

          {requesterProfiles.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
                Follow requests · {requesterProfiles.length}
              </p>
              <ul className="mt-3 space-y-2">
                {requesterProfiles.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-sm bg-paper-raised border border-paper-line px-3 py-2"
                  >
                    <Link
                      href={`/u/${p.id}`}
                      className="flex items-center gap-3 min-w-0 group"
                    >
                      <Avatar url={p.avatar_url} name={displayName(p)} belt={p.belt} size="sm" />
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-ink truncate group-hover:text-accent transition">
                          {displayName(p)}
                        </span>
                        <BeltChip belt={p.belt} stripes={p.stripes} />
                      </span>
                    </Link>
                    <span className="flex items-center gap-2">
                      <form action={acceptFollowRequest}>
                        <input type="hidden" name="user_id" value={p.id} />
                        <button type="submit" className={btnPrimary}>
                          Accept
                        </button>
                      </form>
                      <form action={removeFollower}>
                        <input type="hidden" name="user_id" value={p.id} />
                        <button type="submit" className={btnGhost}>
                          Decline
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gymSuggestions.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
                From your gym
                {myProfile?.home_gym_name ? ` · ${myProfile.home_gym_name}` : ""}
              </p>
              <ul className="mt-3 space-y-2">
                {gymSuggestions.map((p) => (
                  <PersonRow
                    key={p.id}
                    profile={p}
                    state={stateFor(p.id)}
                    showPrivacy
                  />
                ))}
              </ul>
            </div>
          )}

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
                      state={stateFor(p.id)}
                      showPrivacy
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
                  <PersonRow key={p.id} profile={p} state="following" />
                ))
              )}
            </ul>
          </div>

          {followerProfiles.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                Followers · {followerProfiles.length}
              </p>
              <ul className="mt-3 space-y-2">
                {followerProfiles.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-sm bg-paper-raised border border-paper-line px-3 py-2"
                  >
                    <Link
                      href={`/u/${p.id}`}
                      className="flex items-center gap-3 min-w-0 group"
                    >
                      <Avatar url={p.avatar_url} name={displayName(p)} belt={p.belt} size="sm" />
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-ink truncate group-hover:text-accent transition">
                          {displayName(p)}
                        </span>
                        <BeltChip belt={p.belt} stripes={p.stripes} />
                      </span>
                    </Link>
                    <form action={removeFollower}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className={btnGhost}>
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
              {(mySessionCount ?? 0) === 0 && (
                <Link
                  href="/log"
                  className="mt-4 inline-block bg-accent text-paper px-5 py-2.5 rounded-sm font-medium hover:bg-accent-deep transition"
                >
                  Log your first session →
                </Link>
              )}
            </div>
          ) : (
            <ul className="mt-5 space-y-4">
              {feedSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  author={profileById.get(s.user_id) ?? null}
                  footer={
                    <SessionSocial
                      sessionId={s.id}
                      reactions={reactionsBySession.get(s.id) ?? []}
                      comments={commentsBySession.get(s.id) ?? []}
                    />
                  }
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

// Instagram-style account privacy. Public: anyone can follow instantly.
// Private: follows become requests you approve.
function PrivacyCard({ isPrivate }: { isPrivate: boolean }) {
  return (
    <div className="rounded-sm bg-paper-raised border border-paper-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
            Your account
          </p>
          <p className="mt-1 text-sm text-ink">
            {isPrivate ? "Private" : "Public"}
          </p>
        </div>
        <form action={setAccountPrivacy}>
          <input
            type="hidden"
            name="is_private"
            value={isPrivate ? "false" : "true"}
          />
          <button type="submit" className={btnGhost}>
            {isPrivate ? "Switch to public" : "Switch to private"}
          </button>
        </form>
      </div>
      <p className="mt-2 text-xs text-ink-mute leading-relaxed">
        {isPrivate
          ? "New followers must request to follow you and see your sessions. Existing followers keep access."
          : "Anyone can follow you and see your sessions in their feed."}
      </p>
    </div>
  );
}

function PersonRow({
  profile,
  state,
  showPrivacy = false,
}: {
  profile: Profile;
  state: FollowState;
  showPrivacy?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-sm bg-paper-raised border border-paper-line px-3 py-2">
      <Link
        href={`/u/${profile.id}`}
        className="flex items-center gap-2 min-w-0 group"
      >
        <Avatar url={profile.avatar_url} name={displayName(profile)} belt={profile.belt} size="sm" />
        <span className="text-sm text-ink truncate group-hover:text-accent transition">
          {displayName(profile)}
        </span>
        <BeltChip belt={profile.belt} stripes={profile.stripes} />
        {showPrivacy && profile.is_private && (
          <span className="font-mono text-[9px] uppercase tracking-dojo px-1.5 py-0.5 rounded-sm border border-paper-line text-ink-mute flex-shrink-0">
            private
          </span>
        )}
      </Link>
      {state === "following" ? (
        <form action={unfollow}>
          <input type="hidden" name="user_id" value={profile.id} />
          <button type="submit" className={btnGhost}>
            Unfollow
          </button>
        </form>
      ) : state === "requested" ? (
        // Clicking cancels the pending request (same delete as unfollow).
        <form action={unfollow}>
          <input type="hidden" name="user_id" value={profile.id} />
          <button type="submit" className={btnGhost}>
            Requested
          </button>
        </form>
      ) : (
        <form action={follow}>
          <input type="hidden" name="user_id" value={profile.id} />
          <button type="submit" className={btnPrimary}>
            Follow
          </button>
        </form>
      )}
    </li>
  );
}

const btnPrimary =
  "font-mono text-[10px] uppercase tracking-dojo px-2.5 py-1 rounded-sm bg-accent text-paper hover:bg-accent-deep transition";
const btnGhost =
  "font-mono text-[10px] uppercase tracking-dojo px-2.5 py-1 rounded-sm border border-paper-line text-ink-dim hover:border-accent hover:text-accent transition";

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
  footer,
}: {
  session: SessionRow & { user_id: string };
  author: Profile | null;
  footer?: React.ReactNode;
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
          {author ? (
            <Link
              href={`/u/${session.user_id}`}
              className="flex items-center gap-3 min-w-0 group"
            >
              <Avatar url={author.avatar_url} name={displayName(author)} belt={author.belt} size="sm" />
              <span className="font-display text-base tracking-tightish truncate group-hover:text-accent transition">
                {displayName(author)}
              </span>
            </Link>
          ) : (
            <span className="font-display text-base tracking-tightish truncate">
              Unknown
            </span>
          )}
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

      {(session.subs_hit?.length || session.subs_caught_in?.length || session.partners?.length) ? (
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
          {session.partners?.map((x, i) => (
            <span
              key={`p-${i}`}
              className="font-mono text-[10px] uppercase tracking-dojo px-2 py-0.5 rounded-sm bg-belt-blue/10 text-belt-blue border border-belt-blue/30"
            >
              w/ {x}
            </span>
          ))}
        </div>
      ) : null}

      <SessionMedia urls={session.media_urls} />

      {footer}
    </li>
  );
}
