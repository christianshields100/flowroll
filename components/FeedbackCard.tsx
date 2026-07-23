"use client";

import { useState } from "react";
import { FeedbackForm } from "./FeedbackForm";

// Always-available inline feedback card (settings page). The dashboard
// prompt is the floating FeedbackWidget instead.
export function FeedbackCard({ context }: { context: string }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
        <p className="font-display text-lg tracking-tightish">
          Thanks — oss. 🙏
        </p>
        <p className="mt-1 text-sm text-ink-mute">
          Every bit of feedback shapes what gets built next.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
      <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
        Feedback
      </p>
      <p className="mt-1 font-display text-lg tracking-tightish">
        Tell us how FlowRoll is working for you
      </p>
      <div className="mt-4">
        <FeedbackForm context={context} onDone={() => setDone(true)} />
      </div>
    </div>
  );
}
