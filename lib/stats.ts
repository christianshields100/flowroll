// Pure stat helpers — no Supabase, no React. Tested implicitly by use.

export type SessionRow = {
  id: string;
  trained_on: string; // 'YYYY-MM-DD'
  duration_min: number;
  rounds: number;
  subs_hit: string[];
  subs_caught_in: string[];
  feel: number;
  gym: string | null;
  drilled: string | null;
  note: string | null;
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
function weekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return ws;
}

export type WeeklyBucket = {
  weekStart: string; // ISO 'YYYY-MM-DD'
  label: string;     // 'Mar 4' style
  mat_min: number;
  rounds: number;
  subs_hit: number;
  subs_caught_in: number;
};

// Last `weeks` weekly buckets ending with the current week.
export function weeklyBuckets(
  sessions: SessionRow[],
  weeks = 8,
): WeeklyBucket[] {
  const today = new Date();
  const thisWeekStart = weekStart(today);

  const buckets: WeeklyBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(
      thisWeekStart.getFullYear(),
      thisWeekStart.getMonth(),
      thisWeekStart.getDate() - i * 7,
    );
    const wsKey = isoDate(ws);
    buckets.push({
      weekStart: wsKey,
      label: ws.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      mat_min: 0,
      rounds: 0,
      subs_hit: 0,
      subs_caught_in: 0,
    });
  }

  const byKey = new Map(buckets.map((b) => [b.weekStart, b]));
  for (const s of sessions) {
    const ws = weekStart(parseDateOnly(s.trained_on));
    const key = isoDate(ws);
    const b = byKey.get(key);
    if (!b) continue; // outside the window
    b.mat_min += s.duration_min;
    b.rounds += s.rounds;
    b.subs_hit += s.subs_hit?.length ?? 0;
    b.subs_caught_in += s.subs_caught_in?.length ?? 0;
  }
  return buckets;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Current streak = number of consecutive days ending today (or yesterday)
// where there's at least one session. If you didn't train today but did
// yesterday, the streak still counts; it only breaks if yesterday is missed.
export function currentStreak(sessions: SessionRow[]): number {
  if (sessions.length === 0) return 0;
  const trainedDays = new Set(
    sessions.map((s) => dayIndex(parseDateOnly(s.trained_on))),
  );
  const todayIdx = dayIndex(new Date());

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
