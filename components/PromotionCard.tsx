"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoLastPromotion } from "@/app/settings/belt-actions";

// Shown on the dashboard for a few days after a promotion lands in
// belt_history. Celebrates it — and offers the one-tap undo for mistakes.
export function PromotionCard({
  rank,
  previousRank,
  timeAtPrevious,
  hoursAtPrevious,
}: {
  rank: string;
  previousRank: string;
  timeAtPrevious: string;
  hoursAtPrevious: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (hidden) return null;

  function onUndo() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    startTransition(async () => {
      const res = await undoLastPromotion();
      if (res.error) setError(res.error);
      else {
        setHidden(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="rise border-t-2 border-accent pt-4 pb-5">
      <p className="text-[11px] uppercase tracking-dojo text-accent">Promotion</p>
      <p className="mt-1 text-2xl font-medium tracking-tightish">
        {rank}. Congratulations.
      </p>
      <p className="mt-1 text-sm text-ink-dim">
        {timeAtPrevious} and {hoursAtPrevious} on the mat at {previousRank.toLowerCase()}. Earned.
      </p>
      <p className="mt-3 text-[11px] text-ink-mute">
        Not right?{" "}
        <button
          type="button"
          onClick={onUndo}
          disabled={pending}
          className={confirm ? "text-accent" : "underline hover:text-ink transition-colors"}
        >
          {pending ? "Undoing…" : confirm ? "Yes, undo this promotion" : "Undo"}
        </button>
        {confirm && !pending && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="underline hover:text-ink transition-colors"
            >
              keep it
            </button>
          </>
        )}
        {error && <span className="ml-2 text-accent">{error}</span>}
      </p>
    </div>
  );
}
