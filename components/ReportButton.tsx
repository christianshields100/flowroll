"use client";

import { useState, useTransition } from "react";
import { reportContent } from "@/app/feed/report-actions";

// Quiet "Report" link that expands into a one-line reason form. Sits in the
// session social row on feed/profile entries.
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "session" | "comment" | "profile";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <span className="text-[11px] italic text-ink-mute">
        Reported — thank you.
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-ink-mute hover:text-accent transition-colors"
      >
        Report
      </button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await reportContent(targetType, targetId, reason);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What's wrong with this?"
        maxLength={1000}
        className="bg-transparent border-b border-ink px-0 py-0.5 text-[12px] text-ink placeholder:italic placeholder:text-ink-mute focus:outline-none focus:border-b-accent transition-colors w-44"
      />
      <button
        type="button"
        disabled={pending || !reason.trim()}
        onClick={submit}
        className="text-[11px] text-accent hover:text-accent-deep transition-colors disabled:opacity-40"
      >
        {pending ? "Sending…" : "Send"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] text-ink-mute hover:text-ink transition-colors"
      >
        Cancel
      </button>
      {error && <span className="text-[11px] text-accent">{error}</span>}
    </span>
  );
}
