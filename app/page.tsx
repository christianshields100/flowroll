import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* top bar */}
      <header className="border-b border-paper-line">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display text-lg tracking-tightish">flowroll</span>
          </div>
          <nav className="text-sm text-ink-dim">
            <Link href="/login" className="hover:text-accent transition-colors">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="flex-1 flex items-center">
        <div className="mx-auto max-w-3xl px-6 py-24 w-full text-center">
          <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute mb-6">
            A training log for jiu-jitsu
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tightish text-balance">
            Roll. Note. <span className="text-accent">Repeat.</span>
          </h1>
          <div className="belt-rule mt-8 max-w-md mx-auto" />
          <p className="mt-8 text-ink-dim text-lg max-w-md mx-auto leading-relaxed">
            A disciplined log for your mat time — rounds, submissions, the stuff that worked
            and the stuff that didn&apos;t. Share with training partners. No frills.
          </p>
          <div className="mt-10 flex items-center justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-accent text-paper px-5 py-3 rounded-sm font-medium hover:bg-accent-deep transition"
            >
              Step on the mat
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-paper-line">
        <div className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between text-xs text-ink-mute font-mono">
          <span>flowroll · v0</span>
          <span>built for the mat</span>
        </div>
      </footer>
    </main>
  );
}

// FlowRoll mark — red bar with a black stripe. The brand in five pixels.
function BrandMark() {
  return (
    <span aria-hidden className="inline-flex items-center">
      <span className="block h-5 w-9 bg-accent rounded-[1px] relative overflow-hidden">
        <span className="absolute right-1.5 top-0 bottom-0 w-1 bg-belt-black" />
        <span className="absolute right-2.5 top-0 bottom-0 w-px bg-paper/70" />
      </span>
    </span>
  );
}
