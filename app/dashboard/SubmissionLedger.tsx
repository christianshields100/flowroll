"use client";

import { useMemo, useState } from "react";
import type { SessionRow } from "@/lib/stats";

type Row = {
  name: string;
  hit: number;
  caught: number;
};

// Tallies submissions across all sessions and shows the leaders.
// Toggle between "hit" (red) and "caught in" (black).
export function SubmissionLedger({ sessions }: { sessions: SessionRow[] }) {
  const [mode, setMode] = useState<"hit" | "caught">("hit");

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    const bump = (raw: string, key: "hit" | "caught") => {
      const name = raw.trim().toLowerCase();
      if (!name) return;
      const r = map.get(name) ?? { name, hit: 0, caught: 0 };
      r[key]++;
      map.set(name, r);
    };
    for (const s of sessions) {
      s.subs_hit?.forEach((x) => bump(x, "hit"));
      s.subs_caught_in?.forEach((x) => bump(x, "caught"));
    }
    return Array.from(map.values())
      .filter((r) => (mode === "hit" ? r.hit : r.caught) > 0)
      .sort((a, b) => {
        const av = mode === "hit" ? a.hit : a.caught;
        const bv = mode === "hit" ? b.hit : b.caught;
        return bv - av;
      });
  }, [sessions, mode]);

  const visible = rows.slice(0, 8);
  const max = visible.reduce(
    (m, r) => Math.max(m, mode === "hit" ? r.hit : r.caught),
    0,
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ToggleButton
          active={mode === "hit"}
          onClick={() => setMode("hit")}
          label="Hit"
        />
        <ToggleButton
          active={mode === "caught"}
          onClick={() => setMode("caught")}
          label="Caught in"
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-ink-mute font-mono">
          No submissions logged yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const val = mode === "hit" ? r.hit : r.caught;
            const pct = max === 0 ? 0 : (val / max) * 100;
            return (
              <li key={r.name} className="flex items-center gap-3">
                <span className="w-28 truncate text-sm text-ink">
                  {r.name}
                </span>
                <span className="flex-1 h-2 bg-paper-ink rounded-sm overflow-hidden">
                  <span
                    className={
                      mode === "hit"
                        ? "block h-full bg-accent"
                        : "block h-full bg-belt-black"
                    }
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="num w-8 text-right text-sm text-ink-dim">
                  {val}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm bg-accent text-paper"
          : "font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 rounded-sm bg-paper border border-paper-line text-ink-dim hover:border-accent hover:text-ink transition"
      }
    >
      {label}
    </button>
  );
}
