"use client";

import { useState, useTransition } from "react";
import { undoLastPromotion, updatePromotionDate } from "./belt-actions";
import { rankLabel, type BeltHistoryRow } from "@/lib/journey";

// Belt history in Settings: fix a date, or undo the most recent promotion.
// Rows come from the trigger; nothing here creates one by hand.
export function BeltHistoryList({ rows }: { rows: BeltHistoryRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [pending, startTransition] = useTransition();
  const sorted = [...rows].sort(
    (a, b) =>
      b.promoted_on.localeCompare(a.promoted_on) ||
      b.created_at.localeCompare(a.created_at),
  );
  const latest = sorted[0];

  function onDate(id: string, value: string) {
    setError(null);
    startTransition(async () => {
      const res = await updatePromotionDate(id, value);
      if (res.error) setError(res.error);
    });
  }

  function onUndo() {
    if (!confirmUndo) {
      setConfirmUndo(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await undoLastPromotion();
      if (res.error) setError(res.error);
      setConfirmUndo(false);
    });
  }

  return (
    <section className="mt-12 max-w-2xl">
      <p className="text-[11px] uppercase tracking-dojo text-accent">
        Belt history
      </p>
      <p className="mt-1 text-sm text-ink-mute">
        Captured automatically whenever you update your belt above. Fix a
        date here, or undo the latest promotion if it was a slip.
      </p>

      <div className="mt-4 border border-paper-line">
        {sorted.length === 0 ? (
          <p className="p-4 text-sm italic text-ink-mute">
            Nothing yet — set your belt above to start the record.
          </p>
        ) : (
          <ul className="divide-y divide-paper-line">
            {sorted.map((r) => (
              <li key={r.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-ink">
                    {rankLabel(r.belt, r.stripes)}
                    <span className="ml-2 text-[10px] uppercase tracking-dojo text-ink-mute">
                      {r.kind === "start" ? "tracking start" : "promotion"}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    defaultValue={r.promoted_on}
                    max={new Date().toISOString().slice(0, 10)}
                    onBlur={(e) => {
                      if (e.target.value && e.target.value !== r.promoted_on)
                        onDate(r.id, e.target.value);
                    }}
                    aria-label={`Date for ${rankLabel(r.belt, r.stripes)}`}
                    className="bg-transparent border-b border-paper-input px-0 py-1 text-[13px] text-ink focus:outline-none focus:border-b-accent transition-colors"
                  />
                  {r.id === latest?.id && r.kind === "promotion" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={onUndo}
                      className={`text-[12px] transition-colors ${
                        confirmUndo ? "text-accent" : "text-ink-mute hover:text-accent"
                      }`}
                    >
                      {pending ? "…" : confirmUndo ? "Really undo?" : "Undo"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-accent">{error}</p>}
    </section>
  );
}
