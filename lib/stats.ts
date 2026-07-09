// Pure stat helpers — no Supabase, no React. Tested implicitly by use.

export type SessionRow = {
  id: string;
  trained_on: string; // 'YYYY-MM-DD'
  duration_min: number;
  rounds: number;
  subs_hit: string[];
  subs_caught_in: string[];
  partners: string[];
  feel: number;
  gym: string | null;
  gym_place_id?: string | null;
  drilled: string | null;
  note: string | null;
  media_urls?: string[]; // public session-media URLs (photos/videos)
  created_at: string;
};

// Parse a YYYY-MM-DD string as a local-time date (avoids UTC shift).
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Days since 1970, in local time. Useful for streak math.
function dayIndex(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.floor(t / 86_400_000);
}

// Monday-anchored week start for any date.
export function weekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return ws;
}

// Dashboard time-series granularity. The user toggles between these.
export type Granularity = "day" | "week" | "month";

export type PeriodBucket = {
  key: string;   // ISO 'YYYY-MM-DD' of the period start
  label: string; // 'Mar 4' (day/week) or 'Mar' (month)
  mat_min: number;
  rounds: number;
  subs_hit: number;
  subs_caught_in: number;
  feel_avg: number | null; // avg 1-5 feel across the period's sessions
};

// How many periods each view shows by default.
export const DEFAULT_PERIOD_COUNT: Record<Granularity, number> = {
  day: 14,
  week: 8,
  month: 6,
};

// Start of the day/week/month containing `d`, in local time.
function periodStart(d: Date, g: Granularity): Date {
  if (g === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (g === "week") return weekStart(d);
  return new Date(d.getFullYear(), d.getMonth(), 1); // month
}

// The period start `n` periods before `start` (n >= 0 walks backwards).
// JS Date normalizes out-of-range day/month, so rollovers are handled.
function shiftPeriod(start: Date, g: Granularity, n: number): Date {
  if (g === "day")
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() - n);
  if (g === "week")
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() - n * 7);
  return new Date(start.getFullYear(), start.getMonth() - n, 1); // month
}

function periodLabel(d: Date, g: Granularity): string {
  if (g === "month") return d.toLocaleDateString(undefined, { month: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Last `count` buckets at the given granularity, ending with the period
// containing `today`. `today` is injectable so the bucketing is testable.
export function periodBuckets(
  sessions: SessionRow[],
  granularity: Granularity = "week",
  count = DEFAULT_PERIOD_COUNT[granularity],
  today: Date = new Date(),
): PeriodBucket[] {
  const thisStart = periodStart(today, granularity);

  const buckets: PeriodBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const ps = shiftPeriod(thisStart, granularity, i);
    buckets.push({
      key: isoDate(ps),
      label: periodLabel(ps, granularity),
      mat_min: 0,
      rounds: 0,
      subs_hit: 0,
      subs_caught_in: 0,
      feel_avg: null,
    });
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const feelTally = new Map<string, { sum: number; n: number }>();
  for (const s of sessions) {
    const key = isoDate(periodStart(parseDateOnly(s.trained_on), granularity));
    const b = byKey.get(key);
    if (!b) continue; // outside the window
    b.mat_min += s.duration_min;
    b.rounds += s.rounds;
    b.subs_hit += s.subs_hit?.length ?? 0;
    b.subs_caught_in += s.subs_caught_in?.length ?? 0;
    const t = feelTally.get(key) ?? { sum: 0, n: 0 };
    t.sum += s.feel;
    t.n += 1;
    feelTally.set(key, t);
  }
  feelTally.forEach((t, key) => {
    const b = byKey.get(key);
    if (b && t.n > 0) b.feel_avg = Math.round((t.sum / t.n) * 10) / 10;
  });
  return buckets;
}

// Back-compat alias: weekly buckets with the legacy `weekStart` field.
export type WeeklyBucket = PeriodBucket & { weekStart: string };
export function weeklyBuckets(
  sessions: SessionRow[],
  weeks = 8,
  today: Date = new Date(),
): WeeklyBucket[] {
  return periodBuckets(sessions, "week", weeks, today).map((b) => ({
    ...b,
    weekStart: b.key,
  }));
}

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Current streak = number of consecutive days ending today (or yesterday)
// where there's at least one session. If you didn't train today but did
// yesterday, the streak still counts; it only breaks if yesterday is missed.
export function currentStreak(
  sessions: SessionRow[],
  today: Date = new Date(),
): number {
  if (sessions.length === 0) return 0;
  const trainedDays = new Set(
    sessions.map((s) => dayIndex(parseDateOnly(s.trained_on))),
  );
  const todayIdx = dayIndex(today);

  // Allow grace: if today not trained but yesterday was, start from yesterday.
  let cursor = trainedDays.has(todayIdx) ? todayIdx : todayIdx - 1;
  let streak = 0;
  while (trainedDays.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

export type SessionTotals = {
  total_sessions: number;
  total_min: number;
  total_rounds: number;
  total_subs_hit: number;
  total_subs_caught_in: number;
};

export function sessionTotals(sessions: SessionRow[]): SessionTotals {
  return sessions.reduce<SessionTotals>(
    (acc, s) => ({
      total_sessions: acc.total_sessions + 1,
      total_min: acc.total_min + s.duration_min,
      total_rounds: acc.total_rounds + s.rounds,
      total_subs_hit: acc.total_subs_hit + (s.subs_hit?.length ?? 0),
      total_subs_caught_in:
        acc.total_subs_caught_in + (s.subs_caught_in?.length ?? 0),
    }),
    {
      total_sessions: 0,
      total_min: 0,
      total_rounds: 0,
      total_subs_hit: 0,
      total_subs_caught_in: 0,
    },
  );
}

export function formatHours(min: number): string {
  if (min === 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export type SubmissionStat = {
  name: string; // normalized lowercase
  hit: number; // times finished
  caught: number; // times caught in
  net: number; // hit - caught
  total: number; // hit + caught
  rate: number; // hit / total, 0..1
};

// Per-submission tally across sessions, normalized by lowercased name. `net` =
// times you finished it minus times you got caught in it; `rate` = finish rate.
// Sorted by total appearances desc, then net desc, then name.
export function submissionStats(sessions: SessionRow[]): SubmissionStat[] {
  const map = new Map<string, { hit: number; caught: number }>();
  const bump = (raw: string, key: "hit" | "caught") => {
    const name = raw.trim().toLowerCase();
    if (!name) return;
    const r = map.get(name) ?? { hit: 0, caught: 0 };
    r[key]++;
    map.set(name, r);
  };
  for (const s of sessions) {
    s.subs_hit?.forEach((x) => bump(x, "hit"));
    s.subs_caught_in?.forEach((x) => bump(x, "caught"));
  }
  return Array.from(map.entries())
    .map(([name, r]) => {
      const total = r.hit + r.caught;
      return {
        name,
        hit: r.hit,
        caught: r.caught,
        net: r.hit - r.caught,
        total,
        rate: total === 0 ? 0 : r.hit / total,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total || b.net - a.net || a.name.localeCompare(b.name),
    );
}

// Compact one-line scorecard for the Coach / recap prompt context, e.g.
// "armbar 5/0 (+5), triangle 1/4 (-3)". Empty string if nothing logged.
export function submissionScorecard(
  sessions: SessionRow[],
  limit = 12,
): string {
  return submissionStats(sessions)
    .slice(0, limit)
    .map(
      (s) => `${s.name} ${s.hit}/${s.caught} (${s.net >= 0 ? "+" : ""}${s.net})`,
    )
    .join(", ");
}
