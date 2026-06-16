"use client";

// Daily / Weekly / Monthly toggle over the volume + feel charts. The three
// bucket sets are computed server-side and passed in, so switching is instant
// with no refetch.
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
            Volume
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tightish">
            {view.title}
          </h2>
          <p className="mt-1 text-sm text-ink-mute">{view.hint}</p>
        </div>

        <div
          role="group"
          aria-label="Chart time range"
          className="flex rounded-sm border border-paper-line overflow-hidden self-center"
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
                    ? "font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 bg-accent text-paper"
                    : "font-mono text-[10px] uppercase tracking-dojo px-3 py-1.5 text-ink-dim hover:text-ink transition"
                }
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid lg:grid-cols-2 gap-6">
        <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
          <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
            Mat time (min)
          </p>
          <div className="mt-3">
            <MatTimeChart data={data} />
          </div>
        </div>
        <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
          <p className="font-mono text-[10px] uppercase tracking-dojo text-ink">
            Rounds rolled
          </p>
          <div className="mt-3">
            <RoundsChart data={data} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-sm bg-paper-raised border border-paper-line p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-dojo text-accent">
            Feel vs volume
          </p>
          <p className="font-mono text-[10px] text-ink-mute">
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
