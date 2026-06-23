"use client";

import { useMemo, useState } from "react";
import { submissionStats, type SessionRow } from "@/lib/stats";

type Mode = "hit" | "caught" | "net";

// Submission report. "Hit" / "Caught in" rank by raw count; "Net" ranks by
// hit − caught (your sharpest finishes vs. what keeps catching you), shown as a
// diverging bar — caught to the left, finished to the right.
export function SubmissionLedger({ sessions }: { sessions: SessionRow[] }) {
  const [mode, setMode] = useState<Mode>("hit");
  const stats = useMemo(() => submissionStats(sessions), [sessions]);

  // Sharpest finish (best net > 0) and nemesis (worst net < 0) for the caption.
  const sharpest = stats.reduce<(typeof stats)[number] | null>(
    (best, s) => (s.net > 0 && (!best || s.net > best.net) ? s : best),
    null,
  );
  const nemesis = stats.reduce<(typeof stats)[number] | null>(
    (worst, s) => (s.net < 0 && (!worst || s.net < worst.net) ? s : worst),
    null,
  );

  const visible = useMemo(() => {
    const val = (s: (typeof stats)[number]) =>
      mode === "hit" ? s.hit : mode === "caught" ? s.caught : s.net;
    return stats
      .filter((s) =>
        mode === "hit" ? s.hit > 0 : mode === "caught" ? s.caught > 0 : s.total > 0,
      )
      .slice()
      .sort((a, b) => val(b) - val(a) || b.total - a.total)
      .slice(0, 8);
  }, [stats, mode]);

  // Diverging net bars scale both sides by the largest single tally on screen.
  const maxSide = useMemo(
    () => visible.reduce((m, s) => Math.max(m, s.hit, s.caught), 0),
    [visible],
  );
  // Hit/caught bars scale by the largest value for the active mode.
  const maxCount = useMemo(
    () =>
      visible.reduce(
        (m, s) => Math.max(m, mode === "hit" ? s.hit : s.caught),
        0,
      ),
    [visible, mode],
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ToggleButton active={mode === "hit"} onClick={() => setMode("hit")} label="Hit" />
        <ToggleButton active={mode === "caught"} onClick={() => setMode("caught")} label="Caught in" />
        <ToggleButton active={mode === "net"} onClick={() => setMode("net")} label="Net" />
      </div>

      {(sharpest || nemesis) && (
        <p className="mb-4 font-mono text-[11px] text-ink-mute">
          {sharpest && (
            <>
              Sharpest <span className="text-accent">{sharpest.name}</span> (+
              {sharpest.net})
            </>
          )}
          {sharpest && nemesis && " · "}
          {nemesis && (
            <>
              Nemesis <span className="text-belt-black">{nemesis.name}</span> (
              {nemesis.net})
            </>
          )}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-ink-mute font-mono">
          No submissions logged yet.
        </p>
      ) : mode === "net" ? (
        <ul className="space-y-2">
          {visible.map((s) => (
            <li key={s.name} className="flex items-center gap-3">
              <span className="w-24 truncate text-sm text-ink">{s.name}</span>
              {/* diverging bar: caught left (black), hit right (accent) */}
              <span className="flex-1 flex items-center">
                <span className="flex-1 flex justify-end">
                  <span
                    className="block h-2 bg-belt-black rounded-l-sm"
                    style={{
                      width: maxSide ? `${(s.caught / maxSide) * 100}%` : "0%",
                    }}
                  />
                </span>
                <span className="w-px h-3 bg-paper-line" />
                <span className="flex-1">
                  <span
                    className="block h-2 bg-accent rounded-r-sm"
                    style={{
                      width: maxSide ? `${(s.hit / maxSide) * 100}%` : "0%",
                    }}
                  />
                </span>
              </span>
              <span
                className={`num w-10 text-right text-sm ${
                  s.net > 0
                    ? "text-accent"
                    : s.net < 0
                      ? "text-belt-black"
                      : "text-ink-mute"
                }`}
              >
                {s.net > 0 ? "+" : ""}
                {s.net}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => {
            const val = mode === "hit" ? s.hit : s.caught;
            const pct = maxCount === 0 ? 0 : (val / maxCount) * 100;
            return (
              <li key={s.name} className="flex items-center gap-3">
                <span className="w-28 truncate text-sm text-ink">{s.name}</span>
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
