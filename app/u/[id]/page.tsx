import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { BeltChip, SessionCard, type Belt } from "@/components/SessionCard";
import { formatHours, sessionTotals, type SessionRow } from "@/lib/stats";
import { follow, unfollow } from "@/app/feed/actions";
import { AvatarUploader } from "./AvatarUploader";
import { HomeGymEditor } from "./HomeGymEditor";

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!.id;

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, display_name, belt, stripes, avatar_url")
    .eq("id", me)
    .single();

  const { data: target } = await supabase
    .from("profiles")
    .select(
      "id, display_name, belt, stripes, is_private, avatar_url, home_gym_name, home_gym_place_id",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!target) notFound();

  const isMe = target.id === me;

  let followState: "following" | "requested" | "none" = "none";
  if (!isMe) {
    const { data: rel } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", me)
      .eq("followee_id", target.id)
      .maybeSingle();
    followState = rel
      ? rel.status === "accepted"
        ? "following"
        : "requested"
      : "none";
  }

  // Follower / following counts (definer RPC — works for any profile).
  const { data: countRows } = await supabase.rpc("profile_follow_counts", {
    target: target.id,
  });
  const counts = (countRows?.[0] ?? { followers: 0, following: 0 }) as {
    followers: number;
    following: number;
  };

  const canView = isMe || !target.is_private || followState === "following";

  let rows: SessionRow[] = [];
  if (canView) {
    const { data } = await supabase
      .from("sessions")
      .select(
        "id, trained_on, duration_min, rounds, subs_hit, subs_caught_in, partners, feel, gym, drilled, note, created_at",
      )
      .eq("user_id", target.id)
      .order("trained_on", { ascending: false })
      .limit(30);
    rows = (data ?? []) as SessionRow[];
  }
  const totals = canView ? sessionTotals(rows) : null;

  return (
    <AppShell profile={myProfile} active={null}>
      <Link
        href="/feed"
        className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
      >
        ← Feed
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5">
          <Avatar
            url={target.avatar_url}
            name={target.display_name}
            belt={target.belt as Belt}
            size="lg"
          />
          <div>
            <h1 className="font-display text-3xl tracking-tightish">
              {target.display_name}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <BeltChip belt={target.belt as Belt} stripes={target.stripes} />
              <span className="font-mono text-[11px] uppercase tracking-dojo text-ink-mute">
                {target.belt} belt
                {target.stripes
                  ? ` · ${target.stripes} stripe${target.stripes > 1 ? "s" : ""}`
                  : ""}
                {target.is_private ? " · private" : ""}
              </span>
            </div>

            {target.home_gym_name && (
              <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
                <span className="uppercase tracking-dojo text-ink-mute">
                  Home gym
                </span>{" "}
                · {target.home_gym_name}
              </p>
            )}

            {/* Follower / following counts — clickable, Instagram-style */}
            <div className="mt-3 flex items-center gap-5">
              <Link
                href={`/u/${target.id}/followers`}
                className="group flex items-baseline gap-1.5"
              >
                <span className="font-mono text-base num text-ink group-hover:text-accent transition">
                  {counts.followers}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                  {counts.followers === 1 ? "follower" : "followers"}
                </span>
              </Link>
              <Link
                href={`/u/${target.id}/following`}
                className="group flex items-baseline gap-1.5"
              >
                <span className="font-mono text-base num text-ink group-hover:text-accent transition">
                  {counts.following}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                  following
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="self-center flex flex-col items-end gap-2">
          {isMe ? (
            <>
              <AvatarUploader uid={me} />
              <Link
                href="/dashboard"
                className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
              >
                Your dashboard →
              </Link>
            </>
          ) : followState === "following" ? (
            <form action={unfollow}>
              <input type="hidden" name="user_id" value={target.id} />
              <button type="submit" className={btnGhost}>
                Unfollow
              </button>
            </form>
          ) : followState === "requested" ? (
            <form action={unfollow}>
              <input type="hidden" name="user_id" value={target.id} />
              <button type="submit" className={btnGhost}>
                Requested
              </button>
            </form>
          ) : (
            <form action={follow}>
              <input type="hidden" name="user_id" value={target.id} />
              <button type="submit" className={btnPrimary}>
                Follow
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="belt-rule mt-6 max-w-sm" />

      {isMe && (
        <div className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
            Home gym
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            Pick from the list so it&apos;s standardized across the app.
          </p>
          <div className="mt-3">
            <HomeGymEditor
              name={target.home_gym_name}
              placeId={target.home_gym_place_id}
            />
          </div>
        </div>
      )}

      {canView && totals && (
        <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
          <Stat label="Sessions" value={`${totals.total_sessions}`} />
          <Stat label="Mat time" value={formatHours(totals.total_min)} />
          <Stat label="Rounds" value={`${totals.total_rounds}`} />
        </div>
      )}

      <div className="mt-8">
        {!canView ? (
          <div className="rounded-sm bg-paper-raised border border-paper-line p-8 max-w-xl text-center">
            <p className="font-display text-xl tracking-tightish">
              This account is private
            </p>
            <p className="mt-2 text-ink-dim">
              {followState === "requested"
                ? "Your follow request is pending. Once they accept, their sessions show up here."
                : "Follow this account to see their sessions."}
            </p>
          </div>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
              Recent sessions
            </p>
            {rows.length === 0 ? (
              <div className="mt-4 rounded-sm bg-paper-raised border border-paper-line p-6">
                <p className="text-ink-dim">
                  {isMe
                    ? "You haven't logged any sessions yet."
                    : "No sessions logged yet."}
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {rows.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-paper-raised border border-paper-line p-4">
      <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl num text-ink">{value}</p>
    </div>
  );
}

const btnPrimary =
  "font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm bg-accent text-paper hover:bg-accent-deep transition";
const btnGhost =
  "font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm border border-paper-line text-ink-dim hover:border-accent hover:text-accent transition";
