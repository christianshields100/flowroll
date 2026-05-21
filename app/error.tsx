"use client";

// Global error boundary. Catches any uncaught render/server error and
// shows a styled fallback instead of the white-screen-of-death.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-paper-weave">
      <div className="max-w-md w-full">
        <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
          Tapped out
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tightish">
          Something went sideways.
        </h1>
        <div className="belt-rule mt-5 max-w-xs" />
        <p className="mt-5 text-ink-dim">
          The page hit an error we didn&apos;t expect. Try again, or head back to
          the dashboard.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-ink-mute">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-accent text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent-deep transition"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="font-mono text-[10px] uppercase tracking-dojo text-ink-dim hover:text-accent transition"
          >
            ← Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
