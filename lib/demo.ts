import "server-only";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/profile";
import { REACTIONS } from "@/lib/reactions";
import type { Belt } from "@/components/SessionCard";
import type { ReactionView, CommentView } from "@/components/SessionSocial";
import type { SessionRow } from "@/lib/stats";
import type { BeltHistoryRow } from "@/lib/journey";

// The public, read-only demo (/demo) is backed by a synthetic athlete whose
// data comes through the demo_snapshot() definer RPC — readable without an
// account, scoped to that one user, nothing writable.
export const DEMO_USER_ID = "00000000-0000-4000-a000-000000000001";

export type DemoProfile = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  belt: Belt;
  stripes: number;
  avatar_url: string | null;
  home_gym_name: string | null;
  is_private: boolean;
};

export type DemoData = {
  profile: DemoProfile;
  sessions: SessionRow[];
  belts: BeltHistoryRow[];
  reactionsBySession: Map<string, ReactionView[]>;
  commentsBySession: Map<string, CommentView[]>;
  followers: number;
  following: number;
};

export async function loadDemo(): Promise<DemoData | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("demo_snapshot");
  if (error || !data || !data.profile) return null;
  const snap = data as {
    profile: DemoProfile;
    sessions: SessionRow[];
    belt_history: BeltHistoryRow[];
    reactions: { session_id: string; emoji: string; count: number }[];
    comments: {
      id: string;
      session_id: string;
      body: string;
      created_at: string;
      author: { display_name: string; first_name: string | null; last_name: string | null; belt: Belt; avatar_url: string | null };
    }[];
    followers: number;
    following: number;
  };

  const reactionsBySession = new Map<string, ReactionView[]>();
  const commentsBySession = new Map<string, CommentView[]>();
  for (const s of snap.sessions) {
    reactionsBySession.set(
      s.id,
      REACTIONS.map((emoji) => ({
        emoji,
        count: snap.reactions.find((r) => r.session_id === s.id && r.emoji === emoji)?.count ?? 0,
        mine: false,
      })),
    );
  }
  for (const c of snap.comments) {
    const list = commentsBySession.get(c.session_id) ?? [];
    list.push({
      id: c.id,
      body: c.body,
      authorName: displayName(c.author),
      authorAvatar: c.author.avatar_url,
      authorBelt: c.author.belt,
      createdAt: c.created_at,
      canDelete: false,
    });
    commentsBySession.set(c.session_id, list);
  }

  return {
    profile: snap.profile,
    sessions: snap.sessions,
    belts: snap.belt_history,
    reactionsBySession,
    commentsBySession,
    followers: Number(snap.followers) || 0,
    following: Number(snap.following) || 0,
  };
}

// A real-shaped Coach conversation for the demo — no model call, no quota.
export const DEMO_TRANSCRIPT: { role: "user" | "assistant"; content: string }[] = [
  { role: "user", content: "What keeps catching me?" },
  {
    role: "assistant",
    content:
      "Pulled your full log. Three things stand out:\n\n- **Armbar — 40 times caught, all-time.** It's been your nemesis since January and it's still your most common catch this quarter. Almost all of them come from the top position when you leave an arm across while passing.\n- **Heel hook — 25 catches, nearly all since July.** That lines up exactly with when Saturdays went no-gi. Your leg-entanglement defense hasn't caught up with how often you're in it.\n- **Kimura — 25**, but trending down: 9 in the spring, 4 since July. Whatever you changed is working.\n\nThe armbar is the one to fix first. It's the same mistake on repeat, and it cost you the semi in August.",
  },
  {
    role: "user",
    content:
      "Log yesterday: 90 min open mat at Ironwood, 7 rounds, no-gi, hit two triangles and a bow and arrow, got caught in a heel hook by Jordan, felt like a 4",
  },
  {
    role: "assistant",
    content:
      "Saved. **Sat Oct 3 — 90 min, 7 rounds, no-gi, feel 4/5.** Triangle ×2, bow and arrow ×1; caught in a heel hook (Jordan).\n\nThat's your 36th triangle finish — it's officially your best weapon, up from 3 finishes in the first quarter. It's on your dashboard.",
  },
  { role: "user", content: "What should I focus on this month?" },
  {
    role: "assistant",
    content:
      "Two things, both straight from the log:\n\n1. **Arm position while passing.** 40 armbars is not a technique gap, it's a habit. Drill the knee cut with the cross-face and keep the near elbow tight — you logged exactly that drill on Sept 1 and had your best passing week of the year right after.\n2. **Heel hook defense, specifically clearing the knee line.** Twenty-five catches in three months. Spend ten minutes before every Saturday open mat on the escape until it's reflexive, not a decision.\n\nLeave the triangle alone for now. It's working. Come back in four weeks and we'll check whether the armbar count moved.",
  },
];
