// Compact WHOOP metrics line for a session card. Owner-only — callers must not
// pass this for other people's sessions (health data stays private).
import type { WhoopWorkout } from "@/lib/whoop";

export function WhoopChip({ w }: { w: WhoopWorkout | undefined | null }) {
  if (!w) return null;
  const bits: string[] = [];
  if (w.strain != null) bits.push(`strain ${w.strain.toFixed(1)}`);
  if (w.avg_hr != null) bits.push(`${Math.round(w.avg_hr)} bpm avg`);
  if (w.max_hr != null) bits.push(`${Math.round(w.max_hr)} max`);
  if (w.kilojoules != null)
    bits.push(`${Math.round(w.kilojoules * 0.239)} cal`);
  if (!bits.length) return null;
  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-sm bg-belt-blue/10 border border-belt-blue/30 px-2 py-1">
      <span className="font-mono text-[9px] uppercase tracking-dojo text-belt-blue">
        Whoop
      </span>
      <span className="font-mono text-[11px] text-ink-dim">
        {bits.join(" · ")}
      </span>
    </div>
  );
}
