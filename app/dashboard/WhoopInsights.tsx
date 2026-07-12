"use client";

// WHOOP × training correlations. Two questions answered visually:
//  1. Does morning recovery predict how a session feels? (scatter)
//  2. Is my day strain tracking my logged mat time, week to week? (composed)
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export type FeelRecoveryPoint = { recovery: number; feel: number };
export type StrainVolumePoint = {
  label: string;
  matMin: number;
  strain: number | null;
};

export function WhoopInsights({
  feelRecovery,
  strainVolume,
  avgFeelHighRecovery,
  avgFeelLowRecovery,
}: {
  feelRecovery: FeelRecoveryPoint[];
  strainVolume: StrainVolumePoint[];
  avgFeelHighRecovery: number | null;
  avgFeelLowRecovery: number | null;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
        <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
          Recovery → how it felt
        </p>
        {avgFeelLowRecovery != null && avgFeelHighRecovery != null && (
          <p className="mt-1 text-sm text-ink-dim">
            Below 50% recovery your sessions feel{" "}
            <span className="text-ink">{avgFeelLowRecovery.toFixed(1)}</span>;
            above 70%,{" "}
            <span className="text-accent">
              {avgFeelHighRecovery.toFixed(1)}
            </span>
            .
          </p>
        )}
        <div className="mt-4 h-56">
          {feelRecovery.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid stroke="var(--paper-line)" />
                <XAxis
                  type="number"
                  dataKey="recovery"
                  name="Recovery"
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  stroke="var(--ink-mute)"
                />
                <YAxis
                  type="number"
                  dataKey="feel"
                  name="Feel"
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 11 }}
                  stroke="var(--ink-mute)"
                />
                <ZAxis range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter
                  data={feelRecovery}
                  fill="var(--accent)"
                  fillOpacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-sm bg-paper-raised border border-paper-line p-5">
        <p className="font-mono text-[10px] uppercase tracking-dojo text-ink-mute">
          Strain vs. mat time · weekly
        </p>
        <p className="mt-1 text-sm text-ink-dim">
          Bars are logged minutes; the line is average WHOOP day strain.
        </p>
        <div className="mt-4 h-56">
          {strainVolume.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={strainVolume}
                margin={{ top: 8, right: 8, bottom: 4, left: -20 }}
              >
                <CartesianGrid stroke="var(--paper-line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--ink-mute)"
                />
                <YAxis
                  yAxisId="min"
                  tick={{ fontSize: 11 }}
                  stroke="var(--ink-mute)"
                />
                <YAxis
                  yAxisId="strain"
                  orientation="right"
                  domain={[0, 21]}
                  tick={{ fontSize: 11 }}
                  stroke="var(--ink-mute)"
                />
                <Tooltip />
                <Bar
                  yAxisId="min"
                  dataKey="matMin"
                  name="Mat min"
                  fill="var(--accent)"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="strain"
                  type="monotone"
                  dataKey="strain"
                  name="Avg strain"
                  stroke="var(--belt-blue)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-ink-mute font-mono text-center">
        Not enough WHOOP + session overlap yet.
      </p>
    </div>
  );
}
