"use client";

// Daily / Weekly / Monthly toggle over the volume + feel charts. The three
// bucket sets are computed server-side and passed in, so switching is instant
// with no refetch. Quarterly styling: text-link toggles (active = black with
// a 2px red underline), hairline-bordered panels.
import { useState } from "react";
import type { Granularity, PeriodBucket } from "@/lib/stats";
import { FeelTrendChart, MatTimeChart, RoundsChart } from "./WeeklyVolumeChart";

const VIEWS: {
  g: Granularity;
  label: string;
  title: string;
  hint: string;
}[] = [
  {
    g: "day",
    label: "Daily",
    title: "The last 14 days",
    hint: "Time on the mat and rounds rolled, day by day",
  },
  {
    g: "week",
    label: "Weekly",
    title: "The last 8 weeks",
    hint: "Time on the mat and rounds rolled, week by week",
  },
  {
    g: "month",
    label: "Monthly",
    title: "The last 6 months",
    hint: "Time on the mat and rounds rolled, month by month",
  },
];

export function VolumeViews({
  daily,
  weekly,
  monthly,
}: {
  daily: PeriodBucket[];
  weekly: PeriodBucket[];
  monthly: PeriodBucket[];
}) {
  const [g, setG] = useState<Granularity>("week");
  const data = g === "day" ? daily : g === "month" ? monthly : weekly;
  const view = VIEWS.find((v) => v.g === g)!;

  return (
    <section>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
            Fig. 5 — Mat time
          </p>
          <h2 className="mt-1 text-2xl font-medium tracking-tightish">
            {view.title}
          </h2>
          <p className="mt-1 text-sm text-ink-mute">{view.hint}</p>
        </div>

        <div
          role="group"
          aria-label="Chart time range"
          className="flex gap-5 self-end pb-1"
        >
          {VIEWS.map((v) => {
            const active = v.g === g;
            return (
              <button
                key={v.g}
                type="button"
                onClick={() => setG(v.g)}
                aria-pressed={active}
                className={
                  active
                    ? "text-[13px] text-ink font-semibold border-b-2 border-accent pb-0.5"
                    : "text-[13px] text-ink-mute hover:text-ink transition-colors pb-0.5 border-b-2 border-transparent"
                }
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid lg:grid-cols-2 gap-10">
        <div>
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
            Mat time (min)
          </p>
          <div className="mt-3">
            <MatTimeChart data={data} />
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
            Rounds rolled
          </p>
          <div className="mt-3">
            <RoundsChart data={data} />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[11px] uppercase tracking-dojo text-ink-mute">
            Feel vs volume
          </p>
          <p className="text-[11px] italic text-ink-mute">
            feel sliding while volume holds = ease off
          </p>
        </div>
        <div className="mt-3">
          <FeelTrendChart data={data} />
        </div>
      </div>
    </section>
  );
}
