import type { Milestone } from "@/lib/journey";
import { parseDateOnly } from "@/lib/stats";

// The journey as a vertical timeline — promotions, competitions, volume
// marks, streak records. Newest first, capped so it stays a glance.
export function MilestoneTimeline({
  items,
  limit = 8,
}: {
  items: Milestone[];
  limit?: number;
}) {
  if (!items.length) return null;
  const shown = items.slice(0, limit);
  const dot = {
    promotion: "bg-accent",
    start: "bg-ink",
    competition: "bg-accent",
    volume: "bg-ink-mute",
    streak: "bg-ink-mute",
    first: "bg-ink",
  } as const;

  return (
    <ol className="relative border-l border-paper-line ml-1.5">
      {shown.map((m, i) => (
        <li key={`${m.date}-${m.title}-${i}`} className="pl-5 pb-4 last:pb-0 relative">
          <span
            aria-hidden
            className={`absolute -left-[5px] top-[6px] h-[9px] w-[9px] rounded-full ${dot[m.kind]}`}
          />
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
            {parseDateOnly(m.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p
            className={`text-sm ${
              m.kind === "promotion" || m.kind === "competition"
                ? "font-semibold text-ink"
                : "text-ink"
            }`}
          >
            {m.title}
            {m.detail && <span className="text-ink-mute"> — {m.detail}</span>}
          </p>
        </li>
      ))}
      {items.length > limit && (
        <li className="pl-5 text-[11px] italic text-ink-mute">
          + {items.length - limit} earlier
        </li>
      )}
    </ol>
  );
}
