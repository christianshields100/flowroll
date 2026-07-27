import type { SessionTotals } from "@/lib/stats";
import { CountUp } from "@/components/CountUp";

// Fig. 1–4 stat row. Each stat sits under a top rule — the featured one
// (streak) gets the 2px red rule, siblings 1px black. Fig numbers are part
// of the Quarterly's editorial register.
export function StreakTile({
  streak,
  totals,
}: {
  streak: number;
  totals: SessionTotals;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10">
      <Stat
        fig={1}
        label="Streak"
        value={streak}
        unit={streak === 1 ? "day" : "days"}
        accent
      />
      <Stat
        fig={2}
        label="Mat time"
        value={totals.total_min}
        format="hours"
        unit="total"
      />
      <Stat
        fig={3}
        label="Sessions"
        value={totals.total_sessions}
        unit="logged"
      />
      <Stat fig={4} label="Rounds" value={totals.total_rounds} unit="rolled" />
    </div>
  );
}

function Stat({
  fig,
  label,
  value,
  format,
  unit,
  accent,
}: {
  fig: number;
  label: string;
  value: number;
  format?: "plain" | "hours";
  unit: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "border-t-2 border-accent pt-3"
          : "border-t border-ink pt-[13px]"
      }
    >
      <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
        Fig. {fig} — {label}
      </p>
      <p className="mt-2 text-[32px] leading-none font-medium tracking-tightish num text-ink">
        <CountUp value={value} format={format} />{" "}
        <span className="text-[13px] font-normal tracking-normal text-ink-mute">
          {unit}
        </span>
      </p>
    </div>
  );
}
