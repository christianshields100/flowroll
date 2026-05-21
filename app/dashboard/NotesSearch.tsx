"use client";

import { useMemo, useState } from "react";
import { parseDateOnly, type SessionRow } from "@/lib/stats";

// Client-side fuzzy filter across drilled + notes + subs.
// Cheap for one user's history — no need to push to the server.
export function NotesSearch({ sessions }: { sessions: SessionRow[] }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query
      ? sessions.filter((s) => {
          const hay = [
            s.drilled ?? "",
            s.note ?? "",
            s.gym ?? "",
            ...(s.subs_hit ?? []),
            ...(s.subs_caught_in ?? []),
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(query);
        })
      : sessions;
    return list.slice(0, 20);
  }, [sessions, q]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search notes, drilled, subs…"
        className="w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition"
      />

      <ul className="mt-5 space-y-4">
        {results.length === 0 && (
          <li className="text-sm text-ink-mute font-mono">
            {q ? "Nothing matches." : "No sessions yet — log one to start."}
          </li>
        )}
        {results.map((s) => (
          <li
            key={s.id}
            className="rounded-sm bg-paper-raised border border-paper-line p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[11px] uppercase tracking-dojo text-ink-mute">
                {parseDateOnly(s.trained_on).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {s.gym ? ` · ${s.gym}` : ""}
              </span>
              <span className="font-mono text-[11px] num text-ink-dim">
                {s.duration_min}m · {s.rounds}r
              </span>
            </div>
            {s.drilled && (
              <p className="mt-2 text-sm text-ink">{s.drilled}</p>
            )}
            {s.note && (
              <p className="mt-1 text-sm text-ink-dim italic">{s.note}</p>
            )}
            {(s.subs_hit?.length || s.subs_caught_in?.length) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.subs_hit?.map((x, i) => (
                  <span
                    key={`h-${i}`}
                    className="font-mono text-[10px] uppercase tracking-dojo px-2 py-0.5 rounded-sm bg-accent/10 text-accent border border-accent/30"
                  >
                    {x}
                  </span>
                ))}
                {s.subs_caught_in?.map((x, i) => (
                  <span
                    key={`c-${i}`}
                    className="font-mono text-[10px] uppercase tracking-dojo px-2 py-0.5 rounded-sm bg-belt-black/10 text-belt-black border border-belt-black/30"
                  >
                    ✗ {x}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
