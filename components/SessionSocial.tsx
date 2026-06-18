"use client";

// Interactive footer for a session card: reaction palette + comment thread.
// Reads its initial data from the server; writes go through server actions and
// then router.refresh() pulls the fresh server-rendered state back.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { REACTIONS, type Reaction } from "@/lib/reactions";
import {
  addComment,
  deleteComment,
  toggleReaction,
} from "@/app/feed/social-actions";
import type { Belt } from "@/components/SessionCard";

export type ReactionView = { emoji: Reaction; count: number; mine: boolean };
export type CommentView = {
  id: string;
  body: string;
  authorName: string;
  authorAvatar: string | null;
  authorBelt: Belt;
  createdAt: string;
  canDelete: boolean;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

export function SessionSocial({
  sessionId,
  reactions,
  comments,
}: {
  sessionId: string;
  reactions: ReactionView[];
  comments: CommentView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const reactionTotal = reactions.reduce((n, r) => n + r.count, 0);

  function react(emoji: Reaction) {
    startTransition(async () => {
      await toggleReaction(sessionId, emoji);
      router.refresh();
    });
  }

  function submitComment() {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      await addComment(sessionId, body);
      setDraft("");
      router.refresh();
    });
  }

  function removeComment(id: string) {
    startTransition(async () => {
      await deleteComment(id);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 pt-3 border-t border-paper-line">
      {/* reaction palette + comment toggle */}
      <div className="flex items-center gap-1.5">
        {REACTIONS.map((emoji) => {
          const r = reactions.find((x) => x.emoji === emoji);
          const count = r?.count ?? 0;
          const mine = r?.mine ?? false;
          return (
            <button
              key={emoji}
              type="button"
              disabled={pending}
              onClick={() => react(emoji)}
              aria-pressed={mine}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition disabled:opacity-50 ${
                mine
                  ? "border-accent bg-accent/10"
                  : "border-paper-line hover:border-ink-mute"
              }`}
            >
              <span aria-hidden>{emoji}</span>
              {count > 0 && (
                <span
                  className={`font-mono text-[11px] num ${
                    mine ? "text-accent" : "text-ink-mute"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto font-mono text-[11px] uppercase tracking-dojo text-ink-mute hover:text-accent transition"
        >
          {comments.length > 0
            ? `${comments.length} comment${comments.length > 1 ? "s" : ""}`
            : "Comment"}
        </button>
      </div>

      {reactionTotal === 0 && comments.length === 0 && !open && (
        <p className="mt-2 font-mono text-[10px] text-ink-mute">
          Be the first to react.
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar
                url={c.authorAvatar}
                name={c.authorName}
                belt={c.authorBelt}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium text-ink">{c.authorName}</span>{" "}
                  <span className="font-mono text-[10px] text-ink-mute">
                    {timeAgo(c.createdAt)}
                  </span>
                </p>
                <p className="text-sm text-ink-dim whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </div>
              {c.canDelete && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeComment(c.id)}
                  className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute hover:text-accent transition disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          ))}

          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  submitComment();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Add a comment…"
              className="flex-1 resize-y bg-paper border border-paper-line rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition"
            />
            <button
              type="button"
              disabled={pending || !draft.trim()}
              onClick={submitComment}
              className="bg-accent text-paper px-3 py-2 rounded-sm font-mono text-[10px] uppercase tracking-dojo hover:bg-accent-deep transition disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
