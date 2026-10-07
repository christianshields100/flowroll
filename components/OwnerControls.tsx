"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSession } from "@/app/log/actions";

// Edit / delete for a session the viewer owns. Inline two-step confirm —
// never window.confirm (native dialogs wedge the browser extension).
export function OwnerControls({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    setConfirming(false);
    startTransition(async () => {
      await deleteSession(sessionId);
      router.refresh();
    });
  }

  const cls =
    "text-[10px] uppercase tracking-dojo transition-colors disabled:opacity-50";
  return (
    <span className={`flex items-baseline gap-3 ${pending ? "opacity-40" : ""}`}>
      <Link href={`/log?edit=${sessionId}`} className={`${cls} text-ink-mute hover:text-accent`}>
        Edit
      </Link>
      {confirming ? (
        <>
          <button type="button" onClick={onDelete} disabled={pending} className={`${cls} text-accent hover:text-accent-deep`}>
            Confirm
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={`${cls} text-ink-mute hover:text-ink`}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={`${cls} text-ink-mute hover:text-accent`}>
          Delete
        </button>
      )}
    </span>
  );
}
