// Shown during route transitions while server components fetch.
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="flex items-center gap-3">
        <span className="block h-3 w-6 bg-accent rounded-[1px] relative overflow-hidden animate-pulse">
          <span className="absolute right-1 top-0 bottom-0 w-[3px] bg-belt-black" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
          Stepping on the mat…
        </span>
      </div>
    </div>
  );
}
