"use client";

// Coach's week-so-far recap. Fetches on mount; the API serves a cached recap
// unless new sessions landed, so this is cheap on every dashboard visit.
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
    <div className="rounded-sm bg-paper-raised border border-paper-line p-5 border-l-2 border-l-accent">
      <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
        Coach · this week
      </p>
      <div className="mt-2 text-sm text-ink leading-relaxed">
        {state.phase === "loading" && (
          <span className="font-mono text-xs text-ink-mute">
            Coach is reading your week…
          </span>
        )}
        {state.phase === "ready" && state.content}
        {state.phase === "empty" && (
          <span className="text-ink-dim">
            Nothing logged yet this week. Step on the mat and the recap fills
            in here.
          </span>
        )}
        {state.phase === "error" && (
          <span className="text-ink-dim">
            Recap unavailable right now — check back later.
          </span>
        )}
      </div>
    </div>
  );
}
