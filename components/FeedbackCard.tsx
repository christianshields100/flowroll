"use client";

import { useState, useTransition } from "react";
import { dismissFeedbackPrompt, submitFeedback } from "@/app/feedback-actions";

// Feedback prompt / form. Two modes:
//  - prompt (dashboard): shows "maybe later" dismiss, appears only for
//    returning users (gating happens server-side on the dashboard)
//  - always (settings): no dismiss, just the form
export function FeedbackCard({
  mode,
  context,
}: {
  mode: "prompt" | "always";
  context: string;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

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

  function onSubmit(formData: FormData) {
    setError(null);
    if (rating != null) formData.set("rating", String(rating));
    formData.set("context", context);
    startTransition(async () => {
      const res = await submitFeedback(formData);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  function onDismiss() {
    setHidden(true);
    startTransition(async () => {
      await dismissFeedbackPrompt();
    });
  }

  return (
    <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
            Feedback
          </p>
          <p className="mt-1 font-display text-lg tracking-tightish">
            {mode === "prompt"
              ? "You've been on the mat a few times — how's FlowRoll?"
              : "Tell us how FlowRoll is working for you"}
          </p>
        </div>
        {mode === "prompt" && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs text-ink-mute hover:text-ink transition"
          >
            Maybe later
          </button>
        )}
      </div>

      <form action={onSubmit} className="mt-4 space-y-3">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(rating === n ? null : n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              className={`text-xl leading-none transition ${
                (hover ?? rating ?? 0) >= n
                  ? "text-accent"
                  : "text-paper-line hover:text-ink-mute"
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 font-mono text-[10px] text-ink-mute">
            optional
          </span>
        </div>

        <textarea
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={2000}
          required
          placeholder="What's working? What's missing? What's annoying?"
          className="w-full bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition resize-y"
        />

        {error && (
          <p className="font-mono text-[11px] text-accent">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending || !message.trim()}
          className="bg-accent text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent-deep transition disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </div>
  );
}
