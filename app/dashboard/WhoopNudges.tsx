"use client";

// "WHOOP saw a jiu-jitsu workout you haven't logged" banners. Each links to a
// prefilled log form; the ✕ dismisses it (persisted so it won't nag).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WhoopNudge } from "@/lib/whoop";
import { dismissWhoopNudge } from "./whoop-nudge-actions";

export function WhoopNudges({ nudges }: { nudges: WhoopNudge[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!nudges.length) return null;

  return (
    <div className="space-y-2">
      {nudges.map((n) => {
        const date = n.local_date
          ? new Date(n.local_date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          : "recently";
        const href = `/log?d=${n.local_date ?? ""}&min=${n.minutes || ""}`;
        return (
          <div
            key={n.id}
            className="flex items-center justify-between gap-3 rounded-sm bg-belt-blue/10 border border-belt-blue/30 px-4 py-3"
          >
            <p className="text-sm text-ink">
              <span className="font-mono text-[9px] uppercase tracking-dojo text-belt-blue mr-2">
                WHOOP
              </span>
              Saw a jiu-jitsu workout on {date}
              {n.minutes ? ` (${n.minutes} min` : ""}
              {n.strain != null ? `${n.minutes ? ", " : " ("}strain ${n.strain.toFixed(1)})` : n.minutes ? ")" : ""}
              {" — log it?"}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={href}
                className="font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm bg-accent text-paper hover:bg-accent-deep transition"
              >
                Log
              </a>
              <button
                type="button"
                aria-label="Dismiss"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await dismissWhoopNudge(n.id);
                    router.refresh();
                  })
                }
                className="font-mono text-xs text-ink-mute hover:text-accent transition disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
