"use client";

// Root-level error boundary: reports the crash to Sentry, shows a minimal
// recovery screen. Only renders when the root layout itself throws.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
          Something broke off the mat.
        </h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          The error&apos;s been reported. Try again in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#b03a2e",
            color: "#fff",
            border: 0,
            padding: "0.6rem 1.2rem",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
