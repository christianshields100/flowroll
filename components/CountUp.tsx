"use client";

import { useEffect, useRef, useState } from "react";
import { formatHours } from "@/lib/stats";

// Number ticker for the big Fig stats — counts up from 0 on first view.
// Jumps straight to the value for reduced-motion users.
export function CountUp({
  value,
  format = "plain",
  durationMs = 800,
}: {
  value: number;
  format?: "plain" | "hours";
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{format === "hours" ? formatHours(display) : display}</>;
}
