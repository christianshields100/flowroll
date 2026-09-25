// Journey math — belt history, time-in-grade, milestones, pace. Everything
// here is derived at read time from sessions + belt_history rows, which is
// what makes promotions safely undoable: nothing is ever stored twice.
import {
  currentStreak,
  formatHours,
  isoDate,
  parseDateOnly,
  type SessionRow,
} from "./stats";

export type Belt = "white" | "blue" | "purple" | "brown" | "black";

export type BeltHistoryRow = {
  id: string;
  kind: "start" | "promotion";
  belt: Belt;
  stripes: number;
  promoted_on: string; // YYYY-MM-DD
  created_at: string;
};

const BELTS: Belt[] = ["white", "blue", "purple", "brown", "black"];
const ROMAN = ["", "I", "II", "III", "IV"];

export function beltRank(belt: Belt, stripes: number): number {
  return BELTS.indexOf(belt) * 5 + stripes;
}

export function rankLabel(belt: Belt, stripes: number): string {
  const b = belt.charAt(0).toUpperCase() + belt.slice(1);
  return stripes > 0 ? `${b} belt ${ROMAN[stripes]}` : `${b} belt`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/** "14 months", "3 weeks", "2 years" — coarse, human. */
export function humanSpan(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30.4)} months`;
  const y = days / 365;
  return `${y.toFixed(y >= 3 ? 0 : 1)} years`;
}

export type JourneyHeader = {
  rank: string;
  timeAtRank: string;
  hoursAtRank: string;
  sessionsAtRank: number;
  since: string; // YYYY-MM-DD the current rank began
  isStart: boolean; // current rank is the tracking start, not a promotion
};

/** Where the athlete is right now, in one line's worth of facts. */
export function journeyHeader(
  history: BeltHistoryRow[],
  sessions: SessionRow[],
  today: Date = new Date(),
): JourneyHeader | null {
  const sorted = [...history].sort(
    (a, b) =>
      a.promoted_on.localeCompare(b.promoted_on) ||
      a.created_at.localeCompare(b.created_at),
  );
  const cur = sorted[sorted.length - 1];
  if (!cur) return null;
  const since = parseDateOnly(cur.promoted_on);
  const atRank = sessions.filter((s) => parseDateOnly(s.trained_on) >= since);
  return {
    rank: rankLabel(cur.belt, cur.stripes),
    timeAtRank: humanSpan(daysBetween(since, today)),
    hoursAtRank: formatHours(atRank.reduce((n, s) => n + s.duration_min, 0)),
    sessionsAtRank: atRank.length,
    since: cur.promoted_on,
    isStart: cur.kind === "start",
  };
}

export type Milestone = {
  date: string; // YYYY-MM-DD
  title: string;
  detail?: string;
  kind: "promotion" | "start" | "volume" | "streak" | "competition" | "first";
};

const SESSION_MARKS = [1, 10, 25, 50, 100, 250, 500, 1000];
const HOUR_MARKS = [10, 25, 50, 100, 250, 500, 1000];

/** Every notable moment on the timeline, newest first. */
export function milestones(
  history: BeltHistoryRow[],
  sessions: SessionRow[],
): Milestone[] {
  const out: Milestone[] = [];
  const asc = [...sessions].sort(
    (a, b) =>
      a.trained_on.localeCompare(b.trained_on) ||
      a.created_at.localeCompare(b.created_at),
  );

  for (const h of history) {
    out.push(
      h.kind === "start"
        ? {
            date: h.promoted_on,
            title: `Started tracking at ${rankLabel(h.belt, h.stripes).toLowerCase()}`,
            kind: "start",
          }
        : {
            date: h.promoted_on,
            title: `Promoted to ${rankLabel(h.belt, h.stripes).toLowerCase()}`,
            kind: "promotion",
          },
    );
  }

  // Session-count and hour marks: the session on which each was crossed.
  let hours = 0;
  let nextS = 0;
  let nextH = 0;
  asc.forEach((s, i) => {
    const n = i + 1;
    hours += s.duration_min / 60;
    while (nextS < SESSION_MARKS.length && n >= SESSION_MARKS[nextS]) {
      const m = SESSION_MARKS[nextS++];
      out.push({
        date: s.trained_on,
        title: m === 1 ? "First session logged" : `${m}th session`,
        kind: m === 1 ? "first" : "volume",
      });
    }
    while (nextH < HOUR_MARKS.length && hours >= HOUR_MARKS[nextH]) {
      const m = HOUR_MARKS[nextH++];
      out.push({ date: s.trained_on, title: `${m} hours on the mat`, kind: "volume" });
    }
    if ((s as SessionRow & { session_type?: string }).session_type === "competition") {
      const r = (s as SessionRow & { comp_result?: string | null }).comp_result;
      out.push({
        date: s.trained_on,
        title: "Competed",
        detail: r ?? undefined,
        kind: "competition",
      });
    }
  });

  // Longest streak (consecutive training days).
  const days = Array.from(new Set(asc.map((s) => s.trained_on))).sort();
  let best = 0;
  let bestEnd = "";
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    const prev = i > 0 ? parseDateOnly(days[i - 1]) : null;
    const cur = parseDateOnly(days[i]);
    run = prev && daysBetween(prev, cur) === 1 ? run + 1 : 1;
    if (run > best) {
      best = run;
      bestEnd = days[i];
    }
  }
  if (best >= 5) {
    out.push({
      date: bestEnd,
      title: `Longest streak: ${best} days in a row`,
      kind: "streak",
    });
  }

  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export type Pace = {
  sessionsPerWeek: number;
  hoursPerWeek: number;
  nextHourMark: number | null;
  nextHourMarkDate: string | null; // YYYY-MM-DD projection
  nextSessionMark: number | null;
  nextSessionMarkDate: string | null;
};

/** Trailing-12-week pace and when the next round-number marks land. */
export function pace(sessions: SessionRow[], today: Date = new Date()): Pace {
  const cutoff = new Date(today.getTime() - 84 * 86400000);
  const recent = sessions.filter((s) => parseDateOnly(s.trained_on) >= cutoff);
  const weeks = 12;
  const sessionsPerWeek = recent.length / weeks;
  const hoursPerWeek = recent.reduce((n, s) => n + s.duration_min, 0) / 60 / weeks;

  const totalHours = sessions.reduce((n, s) => n + s.duration_min, 0) / 60;
  const totalSessions = sessions.length;
  const nextHourMark = HOUR_MARKS.find((m) => m > totalHours) ?? null;
  const nextSessionMark = SESSION_MARKS.find((m) => m > totalSessions) ?? null;

  const project = (remaining: number, perWeek: number) =>
    perWeek > 0
      ? isoDate(new Date(today.getTime() + (remaining / perWeek) * 7 * 86400000))
      : null;

  return {
    sessionsPerWeek,
    hoursPerWeek,
    nextHourMark,
    nextHourMarkDate:
      nextHourMark != null ? project(nextHourMark - totalHours, hoursPerWeek) : null,
    nextSessionMark,
    nextSessionMarkDate:
      nextSessionMark != null
        ? project(nextSessionMark - totalSessions, sessionsPerWeek)
        : null,
  };
}

/** Days since the most recent session, or null if none. */
export function daysSinceLast(sessions: SessionRow[], today: Date = new Date()): number | null {
  if (!sessions.length) return null;
  const last = sessions.reduce((m, s) => (s.trained_on > m ? s.trained_on : m), sessions[0].trained_on);
  return daysBetween(parseDateOnly(last), today);
}

export { currentStreak };
