"use client";

import { useMemo, useState } from "react";
import { submissionStats, type SessionRow } from "@/lib/stats";

type Mode = "hit" | "caught" | "net";

// Fig. 6 — the ledger. A hairline-ruled table (name / hit / caught / net);
// the Hit / Caught / Net text-links change the ranking. Positive net reads
// red; the nemesis row carries an italic aside.
export function SubmissionLedger({ sessions }: { sessions: SessionRow[] }) {
  const [mode, setMode] = useState<Mode>("hit");
  const stats = useMemo(() => submissionStats(sessions), [sessions]);

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

  return (
    <div>
      <div className="flex items-center gap-5 mb-3">
        <ToggleLink active={mode === "hit"} onClick={() => setMode("hit")} label="Hit" />
        <ToggleLink active={mode === "caught"} onClick={() => setMode("caught")} label="Caught in" />
        <ToggleLink active={mode === "net"} onClick={() => setMode("net")} label="Net" />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm italic text-ink-mute">
          No submissions on record yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-dojo text-ink-mute">
              <th className="text-left font-normal pb-2">Submission</th>
              <th className="text-right font-normal pb-2 w-12">For</th>
              <th className="text-right font-normal pb-2 w-14">Against</th>
              <th className="text-right font-normal pb-2 w-12">Net</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.name} className="border-t border-paper-line">
                <td className="py-2 text-ink">
                  {s.name}
                  {nemesis?.name === s.name && (
                    <span className="italic text-ink-mute">
                      {" "}
                      — a recurring correspondent
                    </span>
                  )}
                </td>
                <td className="py-2 text-right num text-ink-dim">{s.hit}</td>
                <td className="py-2 text-right num text-ink-dim">{s.caught}</td>
                <td
                  className={`py-2 text-right num ${
                    s.net > 0
                      ? "text-accent"
                      : s.net < 0
                        ? "text-ink"
                        : "text-ink-mute"
                  }`}
                >
                  {s.net > 0 ? "+" : ""}
                  {s.net}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ToggleLink({
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
          ? "text-[13px] text-ink font-semibold border-b-2 border-accent pb-0.5"
          : "text-[13px] text-ink-mute hover:text-ink transition-colors pb-0.5 border-b-2 border-transparent"
      }
    >
      {label}
    </button>
  );
}
