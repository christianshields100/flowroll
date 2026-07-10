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
        <div className="mx-auto max-w-5xl px-6 py-24 grid md:grid-cols-12 gap-12 items-center w-full">
          <div className="md:col-span-7">
            <p className="font-mono text-xs uppercase tracking-dojo text-ink-mute mb-6">
              A training log for jiu-jitsu
            </p>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tightish text-balance">
              Roll. Note. <span className="text-accent">Repeat.</span>
            </h1>
            <div className="belt-rule mt-8 max-w-md" />
            <p className="mt-8 text-ink-dim text-lg max-w-md leading-relaxed">
              A disciplined log for your mat time — rounds, submissions, the stuff that worked
              and the stuff that didn&apos;t. Share with training partners. No frills.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-accent text-paper px-5 py-3 rounded-sm font-medium hover:bg-accent-deep transition"
              >
                Step on the mat
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {/* stat card preview */}
          <div className="md:col-span-5">
            <div className="rounded-sm bg-paper-raised border border-paper-line p-6 shadow-paper">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
                  This week
                </span>
                <BeltChip belt="blue" stripes={4} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-4">
                <Stat label="Mat time" value="6h 40m" />
                <Stat label="Rounds" value="38" />
                <Stat label="Subs hit" value="11" />
              </div>
              <div className="mt-6 belt-rule" />
              <ul className="mt-6 space-y-3 text-sm">
                <LedgerRow when="Mon" what="Triangle from guard" tag="hit" />
                <LedgerRow when="Wed" what="Kimura from side" tag="caught" />
                <LedgerRow when="Fri" what="RNC from back" tag="hit" />
              </ul>
            </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-2xl text-ink">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute mt-1">
        {label}
      </div>
    </div>
  );
}

function LedgerRow({ when, what, tag }: { when: string; what: string; tag: "hit" | "caught" }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink-mute w-8">{when}</span>
        <span className="text-ink">{what}</span>
      </span>
      <span
        className={
          tag === "hit"
            ? "font-mono text-[10px] uppercase tracking-dojo text-accent"
            : "font-mono text-[10px] uppercase tracking-dojo text-ink-mute"
        }
      >
        {tag}
      </span>
    </li>
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

function BeltChip({
  belt,
  stripes,
}: {
  belt: "white" | "blue" | "purple" | "brown" | "black";
  stripes: number;
}) {
  const bg =
    belt === "white"
      ? "bg-belt-white"
      : belt === "blue"
      ? "bg-belt-blue"
      : belt === "purple"
      ? "bg-belt-purple"
      : belt === "brown"
      ? "bg-belt-brown"
      : "bg-belt-black";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`block h-3 w-6 ${bg} rounded-[1px] relative overflow-hidden`}>
        <span className="absolute right-1 top-0 bottom-0 w-[3px] bg-belt-stripe/95" />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
        {belt} · {stripes}
      </span>
    </span>
  );
}
