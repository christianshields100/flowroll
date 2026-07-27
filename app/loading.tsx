// Shown during route transitions while server components fetch.
// A Quarterly-styled skeleton: masthead, Fig stat row, content columns —
// shimmering quietly instead of a spinner.
export default function Loading() {
  return (
    <div className="min-h-screen bg-paper">
      {/* header ghost */}
      <div className="border-b border-ink">
        <div className="mx-auto max-w-5xl px-5 sm:px-10 py-5 flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-tightish">
            flowroll<span className="text-accent">.</span>
          </span>
          <span className="skel h-3 w-40" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 sm:px-10 py-9 sm:py-11">
        {/* masthead */}
        <div className="border-b border-ink pb-6 grid sm:grid-cols-[1fr,2fr] gap-6 items-end">
          <div className="space-y-2">
            <span className="skel block h-3 w-32" />
            <span className="skel block h-3 w-40" />
          </div>
          <div className="space-y-3">
            <span className="skel block h-8 w-3/4" />
            <span className="skel block h-8 w-1/2" />
          </div>
        </div>

        {/* fig stat row */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={i === 0 ? "border-t-2 border-accent pt-3" : "border-t border-ink pt-[13px]"}
            >
              <span className="skel block h-3 w-24" />
              <span className="skel mt-3 block h-8 w-16" />
            </div>
          ))}
        </div>

        {/* content columns */}
        <div className="mt-12 grid lg:grid-cols-2 gap-10">
          <div className="space-y-3">
            <span className="skel block h-3 w-28" />
            <span className="skel block h-40 w-full" />
          </div>
          <div className="space-y-3">
            <span className="skel block h-3 w-28" />
            <span className="skel block h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
