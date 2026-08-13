import Link from "next/link";

// Quiet site footer — hairline rule, policy + API links. Rendered on the
// signed-in shell and the public pages.
export function SiteFooter() {
  return (
    <footer className="border-t border-paper-line">
      <div className="mx-auto max-w-5xl px-5 sm:px-10 py-5 flex items-center justify-between gap-4 text-[11px] text-ink-mute">
        <span>© 2026 FlowRoll</span>
        <span className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-ink transition-colors">
            Privacy
          </Link>
          <Link href="/developers" className="hover:text-ink transition-colors">
            API
          </Link>
        </span>
      </div>
    </footer>
  );
}
