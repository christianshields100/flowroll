import { isoDate, parseDateOnly, type SessionRow } from "@/lib/stats";

// GitHub-style training calendar: one cell per day for the trailing year,
// shaded by mat minutes. The most legible "am I consistent?" view there is.
export function TrainingCalendar({
  sessions,
  today = new Date(),
}: {
  sessions: SessionRow[];
  today?: Date;
}) {
  const minutesByDay = new Map<string, number>();
  for (const s of sessions) {
    minutesByDay.set(s.trained_on, (minutesByDay.get(s.trained_on) ?? 0) + s.duration_min);
  }

  // 53 columns of weeks ending this week; rows Sun→Sat.
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  const endOffset = end.getDay();
  const start = new Date(end.getTime() - (52 * 7 + endOffset) * 86400000);
  const weeks: { date: Date; minutes: number; iso: string }[][] = [];
  for (let w = 0; w < 53; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 86400000);
      if (date > end) break;
      const iso = isoDate(date);
      col.push({ date, minutes: minutesByDay.get(iso) ?? 0, iso });
    }
    weeks.push(col);
  }

  const shade = (m: number) =>
    m === 0
      ? "bg-paper-ink"
      : m < 45
        ? "bg-accent/30"
        : m < 90
          ? "bg-accent/60"
          : "bg-accent";

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((col, i) => {
    const m = col[0]?.date.getMonth();
    if (m != null && m !== lastMonth) {
      monthLabels.push({
        col: i,
        label: col[0].date.toLocaleDateString(undefined, { month: "short" }),
      });
      lastMonth = m;
    }
  });

  const trainedDays = minutesByDay.size;
  const yearAgo = new Date(today.getTime() - 365 * 86400000);
  const daysThisYear = sessions.filter((s) => parseDateOnly(s.trained_on) >= yearAgo).length;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="relative h-4 mb-1 text-[10px] text-ink-mute">
            {monthLabels.map((m) => (
              <span
                key={m.col}
                className="absolute"
                style={{ left: `${m.col * 13}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]" role="img" aria-label={`Training calendar: ${daysThisYear} sessions in the last year`}>
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((cell) => (
                  <span
                    key={cell.iso}
                    title={
                      cell.minutes
                        ? `${cell.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${cell.minutes} min`
                        : cell.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    }
                    className={`block h-[10px] w-[10px] ${shade(cell.minutes)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-mute">
        <span>
          {daysThisYear} session{daysThisYear === 1 ? "" : "s"} in the last year ·{" "}
          {trainedDays} training day{trainedDays === 1 ? "" : "s"} all-time
        </span>
        <span className="flex items-center gap-1">
          less
          <span className="block h-[10px] w-[10px] bg-paper-ink" />
          <span className="block h-[10px] w-[10px] bg-accent/30" />
          <span className="block h-[10px] w-[10px] bg-accent/60" />
          <span className="block h-[10px] w-[10px] bg-accent" />
          more
        </span>
      </div>
    </div>
  );
}
