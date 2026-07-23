"use client";

import { useState, useTransition } from "react";
import { submitFeedback } from "@/app/feedback-actions";

// The feedback form itself (stars + message + submit), shared between the
// inline settings card and the floating widget. Calls onDone after a
// successful save so the host can show its own thanks state.
export function FeedbackForm({
  context,
  onDone,
}: {
  context: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    if (rating != null) formData.set("rating", String(rating));
    formData.set("context", context);
    startTransition(async () => {
      const res = await submitFeedback(formData);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Rating"
      >
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

      {error && <p className="font-mono text-[11px] text-accent">{error}</p>}

      <button
        type="submit"
        disabled={pending || !message.trim()}
        className="bg-accent text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent-deep transition disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
