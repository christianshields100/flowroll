"use client";

// "From the coach's desk" — the footer recap strip. Fetches on mount; the
// API serves a cached recap unless new sessions landed, so this is cheap on
// every dashboard visit. Quarterly: 3-col strip above a black top rule.
import Link from "next/link";
import { useEffect, useState } from "react";

type State =
  | { phase: "loading" }
  | { phase: "ready"; content: string }
  | { phase: "empty" }
  | { phase: "error" };

export function WeeklyRecap() {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recap", { method: "POST" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { content: string | null };
        if (cancelled) return;
        setState(
          data.content
            ? { phase: "ready", content: data.content }
            : { phase: "empty" },
        );
      } catch {
        if (!cancelled) setState({ phase: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border-t border-ink pt-5 grid sm:grid-cols-[auto,1fr,auto] gap-3 sm:gap-8 items-baseline">
      <p className="text-[11px] uppercase tracking-dojo text-ink-mute whitespace-nowrap">
        From the coach&apos;s desk
      </p>
      <p className="text-sm text-ink leading-relaxed">
        {state.phase === "loading" && (
          <span className="italic text-ink-mute">
            The coach is reading your week…
          </span>
        )}
        {state.phase === "ready" && state.content}
        {state.phase === "empty" && (
          <span className="text-ink-dim">
            Nothing logged yet this week. Step on the mat and this column
            fills in.
          </span>
        )}
        {state.phase === "error" && (
          <span className="text-ink-dim">
            Recap unavailable right now — check back later.
          </span>
        )}
      </p>
      <Link
        href="/chat"
        className="text-[13px] text-accent hover:text-accent-deep transition-colors whitespace-nowrap"
      >
        Continue reading →
      </Link>
    </div>
  );
}
