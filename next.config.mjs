import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required on Next 14 for instrumentation.ts (Sentry server/edge init).
    instrumentationHook: true,
  },
};

// Sourcemap upload is skipped automatically when SENTRY_AUTH_TOKEN is unset;
// error capture itself only needs NEXT_PUBLIC_SENTRY_DSN at runtime.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: false,
  telemetry: false,
});
