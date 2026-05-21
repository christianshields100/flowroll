"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
            formatter={(value: number) => [
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
