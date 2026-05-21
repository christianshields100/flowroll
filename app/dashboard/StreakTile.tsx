import { formatHours, type SessionTotals } from "@/lib/stats";

// Top-line stats — streak + lifetime totals. Server-renderable.
export function StreakTile({
  streak,
  totals,
}: {
  streak: number;
  totals: SessionTotals;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Stat
        label="Streak"
        value={`${streak}`}
        unit={streak === 1 ? "day" : "days"}
        accent
      />
      <Stat
        label="Mat time"
        value={formatHours(totals.total_min)}
        unit="total"
      />
      <Stat
        label="Sessions"
        value={`${totals.total_sessions}`}
        unit={totals.total_sessions === 1 ? "logged" : "logged"}
      />
      <Stat
        label="Rounds"
        value={`${totals.total_rounds}`}
        unit="rolled"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-sm bg-paper-raised border border-paper-line p-4">
      <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
        {label}
      </p>
      <p
        className={
          accent
            ? "mt-2 font-mono text-3xl num text-accent"
            : "mt-2 font-mono text-3xl num text-ink"
        }
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
        {unit}
      </p>
    </div>
  );
}
