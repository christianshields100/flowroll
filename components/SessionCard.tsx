// Shared read-only session entry + belt chip, used by the feed and profile
// pages. Quarterly treatment: entries are not cards — each opens with a 1px
// black top rule, hairline chips, editorial labels.
import { parseDateOnly, type SessionRow } from "@/lib/stats";
import { SessionMedia } from "@/components/SessionMedia";
import { WhoopChip } from "@/components/WhoopChip";
import type { WhoopWorkout } from "@/lib/whoop";

export type Belt = "white" | "blue" | "purple" | "brown" | "black";

const BELT_BG: Record<Belt, string> = {
  white: "bg-belt-white",
  blue: "bg-belt-blue",
  purple: "bg-belt-purple",
  brown: "bg-belt-brown",
  black: "bg-belt-black",
};

export function BeltChip({
  belt,
  stripes,
  size = "sm",
}: {
  belt: Belt;
  stripes: number;
  size?: "sm" | "lg";
}) {
  const dims = size === "lg" ? "h-[18px] w-10" : "h-3 w-6";
  return (
    <span
      aria-hidden
      className={`block ${dims} ${BELT_BG[belt]} relative overflow-hidden flex-shrink-0`}
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

export function SessionCard({
  session,
  author,
  footer,
  whoop,
}: {
  session: SessionRow;
  author?: { display_name: string; belt: Belt; stripes: number } | null;
  footer?: React.ReactNode;
  // Owner-only: matched WHOOP workout. Never pass for other users' sessions.
  whoop?: WhoopWorkout | null;
}) {
  const date = parseDateOnly(session.trained_on).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <li className="border-t border-ink pt-4 pb-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {author && <BeltChip belt={author.belt} stripes={author.stripes} />}
          {author && (
            <span className="text-[15px] font-semibold tracking-tightish truncate">
              {author.display_name}
            </span>
          )}
          <span className="text-[11px] uppercase tracking-dojo text-ink-mute">
            {date}
            {session.gym ? ` · ${session.gym}` : ""}
          </span>
        </div>
        <span className="text-[13px] num text-ink-dim whitespace-nowrap">
          {session.duration_min} min · {session.rounds}{" "}
          {session.rounds === 1 ? "round" : "rounds"}
        </span>
      </div>

      {session.drilled && (
        <p className="mt-3 text-sm text-ink leading-relaxed">
          {session.drilled}
        </p>
      )}
      {session.note && (
        <p className="mt-1 text-sm text-ink-dim italic leading-relaxed">
          {session.note}
        </p>
      )}

      {(session.subs_hit?.length ||
        session.subs_caught_in?.length ||
        session.partners?.length) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {session.subs_hit?.map((x, i) => (
            <span
              key={`h-${i}`}
              className="text-[11px] px-2.5 py-0.5 border border-accent text-accent"
            >
              {x}
            </span>
          ))}
          {session.subs_caught_in?.map((x, i) => (
            <span
              key={`c-${i}`}
              className="text-[11px] px-2.5 py-0.5 border border-ink text-ink"
            >
              ✗ {x}
            </span>
          ))}
          {session.partners?.map((x, i) => (
            <span
              key={`p-${i}`}
              className="text-[11px] px-2.5 py-0.5 border border-paper-input text-ink-dim"
            >
              w/ {x}
            </span>
          ))}
        </div>
      ) : null}

      <SessionMedia urls={session.media_urls} />

      <WhoopChip w={whoop} />

      {footer}
    </li>
  );
}
