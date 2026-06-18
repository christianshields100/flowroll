import "server-only";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/profile";
import { REACTIONS } from "@/lib/reactions";
import type { Belt } from "@/components/SessionCard";
import type { ReactionView, CommentView } from "@/components/SessionSocial";

type SupabaseServer = ReturnType<typeof createClient>;

type ProfileLite = {
  id: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  belt: Belt;
  avatar_url?: string | null;
};

// Fetch reactions + comments for a set of sessions and shape them into the
// per-session view models the SessionSocial footer expects. Used by the feed
// and profile pages so the social wiring lives in one place. `me` drives the
// "mine" reaction highlight and own-comment delete; the session owner can also
// delete any comment on their session. `knownProfiles` lets callers pass
// profiles they've already loaded so we only fetch the commenters we're missing.
export async function fetchSessionSocial(
  supabase: SupabaseServer,
  sessions: { id: string; user_id: string }[],
  me: string,
  knownProfiles?: Map<string, ProfileLite>,
): Promise<{
  reactionsBySession: Map<string, ReactionView[]>;
  commentsBySession: Map<string, CommentView[]>;
}> {
  const reactionsBySession = new Map<string, ReactionView[]>();
  const commentsBySession = new Map<string, CommentView[]>();
  const sessionIds = sessions.map((s) => s.id);
  if (!sessionIds.length) return { reactionsBySession, commentsBySession };

  const ownerBySession = new Map(sessions.map((s) => [s.id, s.user_id]));

  const [rx, cm] = await Promise.all([
    supabase
      .from("session_reactions")
      .select("session_id, user_id, emoji")
      .in("session_id", sessionIds),
    supabase
      .from("session_comments")
      .select("id, session_id, user_id, body, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true }),
  ]);
  const reactionRows = (rx.data ?? []) as {
    session_id: string;
    user_id: string;
    emoji: string;
  }[];
  const commentRows = (cm.data ?? []) as {
    id: string;
    session_id: string;
    user_id: string;
    body: string;
    created_at: string;
  }[];

  // Resolve commenter profiles we don't already have.
  const profileById = new Map(knownProfiles ?? []);
  const missing = Array.from(
    new Set(commentRows.map((c) => c.user_id)),
  ).filter((id) => !profileById.has(id));
  if (missing.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, first_name, last_name, belt, avatar_url")
      .in("id", missing);
    for (const p of (data ?? []) as ProfileLite[]) profileById.set(p.id, p);
  }

  for (const sid of sessionIds) {
    const rows = reactionRows.filter((r) => r.session_id === sid);
    reactionsBySession.set(
      sid,
      REACTIONS.map((emoji) => {
        const forEmoji = rows.filter((r) => r.emoji === emoji);
        return {
          emoji,
          count: forEmoji.length,
          mine: forEmoji.some((r) => r.user_id === me),
        };
      }),
    );
  }
  for (const c of commentRows) {
    const author = profileById.get(c.user_id);
    const list = commentsBySession.get(c.session_id) ?? [];
    list.push({
      id: c.id,
      body: c.body,
      authorName: author ? displayName(author) : "Someone",
      authorAvatar: author?.avatar_url ?? null,
      authorBelt: (author?.belt ?? "white") as Belt,
      createdAt: c.created_at,
      canDelete: c.user_id === me || ownerBySession.get(c.session_id) === me,
    });
    commentsBySession.set(c.session_id, list);
  }

  return { reactionsBySession, commentsBySession };
}
