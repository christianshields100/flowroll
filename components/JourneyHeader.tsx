import type { JourneyHeader as JourneyHeaderData } from "@/lib/journey";
import { parseDateOnly } from "@/lib/stats";

// "Where you are" in one line of facts: rank · time at rank · hours at rank.
export function JourneyHeader({ data }: { data: JourneyHeaderData }) {
  const since = parseDateOnly(data.since).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10">
      <Fact label="Rank" value={data.rank} sub={data.isStart ? `tracking since ${since}` : `since ${since}`} accent />
      <Fact label="At this rank" value={data.timeAtRank} sub="and counting" />
      <Fact label="Mat time at rank" value={data.hoursAtRank} sub="on the clock" />
      <Fact
        label="Sessions at rank"
        value={String(data.sessionsAtRank)}
        sub={data.sessionsAtRank === 1 ? "logged" : "logged"}
      />
    </div>
  );
}

function Fact({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "border-t-2 border-accent pt-3" : "border-t border-ink pt-[13px]"}>
      <p className="text-[11px] uppercase tracking-dojo text-ink-mute">{label}</p>
      <p className="mt-2 text-[26px] leading-none font-medium tracking-tightish text-ink">
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-ink-mute">{sub}</p>
    </div>
  );
}
