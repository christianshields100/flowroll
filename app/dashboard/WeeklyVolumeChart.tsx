"use client";

import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PeriodBucket } from "@/lib/stats";

// Quarterly chart language: quiet #DEDCD5 bars with the current period in
// red, square corners, sitting on a 1px black baseline. No gridlines, no
// shadows — the tooltip is a hairline-bordered card.

const TOOLTIP_STYLE = {
  background: "#FDFCFA",
  border: "1px solid #E5E3DD",
  borderRadius: 0,
  fontSize: 12,
  color: "#0A0908",
} as const;

const TICK = { fontSize: 11, fill: "#8A857E" } as const;
const BASELINE = { stroke: "#0A0908", strokeWidth: 1 } as const;

export function MatTimeChart({ data }: { data: PeriodBucket[] }) {
  return (
    <ChartFrame
      data={data}
      dataKey="mat_min"
      tooltipLabel="Mat time"
      tooltipUnit="min"
    />
  );
}

export function RoundsChart({ data }: { data: PeriodBucket[] }) {
  return (
    <ChartFrame
      data={data}
      dataKey="rounds"
      tooltipLabel="Rounds"
      tooltipUnit=""
    />
  );
}

// Feel (1-5 line, right axis) over mat time (bars, left axis). Sliding feel
// against steady-or-rising volume is the cheap overtraining signal.
export function FeelTrendChart({ data }: { data: PeriodBucket[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 0, left: -16, bottom: 0 }}
        >
          <XAxis
            dataKey="label"
            stroke="#8A857E"
            tickLine={false}
            axisLine={BASELINE}
            tick={TICK}
          />
          <YAxis
            yAxisId="volume"
            stroke="#8A857E"
            tickLine={false}
            axisLine={false}
            tick={TICK}
            width={40}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="feel"
            orientation="right"
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            stroke="#B2342A"
            tickLine={false}
            axisLine={false}
            tick={TICK}
            width={24}
          />
          <Tooltip
            cursor={{ fill: "#F1EFEA" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#4A4642" }}
            formatter={(value, name) =>
              name === "feel_avg"
                ? [value === null ? "—" : `${value} / 5`, "Avg feel"]
                : [`${value} min`, "Mat time"]
            }
          />
          <Bar yAxisId="volume" dataKey="mat_min" fill="#DEDCD5" radius={0} />
          <Line
            yAxisId="feel"
            dataKey="feel_avg"
            type="monotone"
            stroke="#B2342A"
            strokeWidth={2}
            dot={{ r: 3, fill: "#B2342A" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartFrame({
  data,
  dataKey,
  tooltipLabel,
  tooltipUnit,
}: {
  data: PeriodBucket[];
  dataKey: "mat_min" | "rounds";
  tooltipLabel: string;
  tooltipUnit: string;
}) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <XAxis
            dataKey="label"
            stroke="#8A857E"
            tickLine={false}
            axisLine={BASELINE}
            tick={TICK}
          />
          <YAxis
            stroke="#8A857E"
            tickLine={false}
            axisLine={false}
            tick={TICK}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#F1EFEA" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#4A4642" }}
            formatter={(value) => [
              tooltipUnit ? `${value} ${tooltipUnit}` : `${value}`,
              tooltipLabel,
            ]}
          />
          <Bar dataKey={dataKey} radius={0}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === data.length - 1 ? "#B2342A" : "#DEDCD5"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
