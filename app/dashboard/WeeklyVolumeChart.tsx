"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyBucket } from "@/lib/stats";

// Two separate charts — one for mat minutes (red), one for rounds rolled (black).

export function MatTimeChart({ data }: { data: WeeklyBucket[] }) {
  return (
    <ChartFrame
      data={data}
      dataKey="mat_min"
      color="#B2342A"
      tooltipLabel="Mat time"
      tooltipUnit="min"
    />
  );
}

export function RoundsChart({ data }: { data: WeeklyBucket[] }) {
  return (
    <ChartFrame
      data={data}
      dataKey="rounds"
      color="#0A0908"
      tooltipLabel="Rounds"
      tooltipUnit=""
    />
  );
}

// Feel (1-5 line, right axis) over mat time (bars, left axis). Sliding feel
// against steady-or-rising volume is the cheap overtraining signal.
export function FeelTrendChart({ data }: { data: WeeklyBucket[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 0, left: -16, bottom: 0 }}
        >
          <CartesianGrid stroke="#E5E3DD" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#8A857E"
            tickLine={false}
            axisLine={false}
            tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
          <YAxis
            yAxisId="volume"
            stroke="#8A857E"
            tickLine={false}
            axisLine={false}
            tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
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
            tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
            width={24}
          />
          <Tooltip
            cursor={{ fill: "#F1EFEA" }}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E5E3DD",
              borderRadius: 2,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "#0A0908",
            }}
            labelStyle={{ color: "#4A4642" }}
            formatter={(value, name) =>
              name === "feel_avg"
                ? [value === null ? "—" : `${value} / 5`, "Avg feel"]
                : [`${value} min`, "Mat time"]
            }
          />
          <Bar
            yAxisId="volume"
            dataKey="mat_min"
            fill="#0A0908"
            fillOpacity={0.15}
            radius={[2, 2, 0, 0]}
          />
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
  color,
  tooltipLabel,
  tooltipUnit,
}: {
  data: WeeklyBucket[];
  dataKey: "mat_min" | "rounds";
  color: string;
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
          <CartesianGrid stroke="#E5E3DD" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#8A857E"
            tickLine={false}
            axisLine={false}
            tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
          <YAxis
            stroke="#8A857E"
            tickLine={false}
            axisLine={false}
            tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#F1EFEA" }}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E5E3DD",
              borderRadius: 2,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "#0A0908",
            }}
            labelStyle={{ color: "#4A4642" }}
            formatter={(value) => [
              tooltipUnit ? `${value} ${tooltipUnit}` : `${value}`,
              tooltipLabel,
            ]}
          />
          <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
