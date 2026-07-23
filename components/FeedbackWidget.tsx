"use client";

import { useState, useTransition } from "react";
import { dismissFeedbackPrompt } from "@/app/feedback-actions";
import { FeedbackForm } from "./FeedbackForm";

// Floating feedback prompt for returning users (gated server-side on the
// dashboard). Collapsed: a pill in the bottom-right corner on desktop, a
// full-width bottom bar on mobile. Click to expand into the form; ✕
// dismisses it for good. After a successful submit, a brief thanks and
// then it hides itself.
export function FeedbackWidget({ context }: { context: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function onDismiss() {
    setHidden(true);
    startTransition(async () => {
      await dismissFeedbackPrompt();
    });
  }

  function onDone() {
    setDone(true);
    // Let the thanks note land, then get out of the way.
    setTimeout(() => setHidden(true), 2500);
  }

  return (
    <div className="fixed z-40 inset-x-0 bottom-0 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 sm:max-w-[calc(100vw-3rem)]">
      <div className="bg-paper-raised border-t sm:border border-paper-line sm:rounded-sm shadow-lg p-4 sm:p-5">
        {done ? (
          <p className="font-display text-lg tracking-tightish">
            Thanks — oss. 🙏
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="text-left flex-1 min-w-0"
              >
                <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
                  Feedback
                </p>
                <p className="mt-0.5 font-display text-base sm:text-lg tracking-tightish leading-snug">
                  You&apos;ve been on the mat a few times — how&apos;s
                  FlowRoll?
                </p>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss feedback prompt"
                className="shrink-0 -mt-1 -mr-1 p-2 text-ink-mute hover:text-ink transition text-base leading-none"
              >
                ✕
              </button>
            </div>

            {open && (
              <div className="mt-4">
                <FeedbackForm context={context} onDone={onDone} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
