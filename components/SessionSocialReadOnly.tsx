// Reactions + comments as a static footer (demo pages, no account).
import { Avatar } from "@/components/Avatar";
import type { ReactionView, CommentView } from "@/components/SessionSocial";

export function SessionSocialReadOnly({
  reactions,
  comments,
}: {
  reactions: ReactionView[];
  comments: CommentView[];
}) {
  const shown = reactions.filter((r) => r.count > 0);
  if (shown.length === 0 && comments.length === 0) return null;
  return (
    <div className="mt-4 pt-3">
      {shown.length > 0 && (
        <div className="flex items-center gap-1.5">
          {shown.map((r) => (
            <span
              key={r.emoji}
              className="flex items-center gap-1 border border-paper-line px-2 py-0.5 text-sm"
            >
              <span aria-hidden>{r.emoji}</span>
              <span className="font-mono text-[11px] num text-ink-mute">{r.count}</span>
            </span>
          ))}
        </div>
      )}
      {comments.length > 0 && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar url={c.authorAvatar} name={c.authorName} belt={c.authorBelt} size="sm" />
              <div className="min-w-0">
                <p className="text-[13px]">
                  <span className="font-semibold text-ink">{c.authorName}</span>
                  <span className="ml-2 text-[11px] text-ink-mute">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </p>
                <p className="text-sm text-ink leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
