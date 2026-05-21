import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-paper-weave">
      <div className="max-w-md w-full">
        <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tightish">
          Off the mat.
        </h1>
        <div className="belt-rule mt-5 max-w-xs" />
        <p className="mt-5 text-ink-dim">
          Nothing trains here. The page you&apos;re looking for doesn&apos;t
          exist.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="bg-accent text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent-deep transition inline-block"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
