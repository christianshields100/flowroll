// Shared read-only session card + belt chip, used by the feed and profile pages.
import { parseDateOnly, type SessionRow } from "@/lib/stats";
import { SessionMedia } from "@/components/SessionMedia";

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
  const dims = size === "lg" ? "h-5 w-10" : "h-3 w-6";
  return (
    <span
      aria-hidden
      className={`block ${dims} ${BELT_BG[belt]} rounded-[1px] relative overflow-hidden flex-shrink-0`}
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
}: {
  session: SessionRow;
  author?: { display_name: string; belt: Belt; stripes: number } | null;
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
          {author && <BeltChip belt={author.belt} stripes={author.stripes} />}
          {author && (
            <span className="font-display text-base tracking-tightish truncate">
              {author.display_name}
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

      {(session.subs_hit?.length ||
        session.subs_caught_in?.length ||
        session.partners?.length) ? (
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
