// The insights engine — deterministic rules over the athlete's own log that
// produce plain-language sentences: what's going well, what to watch, and
// context. No LLM involved; Coach can elaborate on any of them. Every rule
// has a data threshold so the app never speaks with false confidence.
import {
  currentStreak,
  parseDateOnly,
  submissionStats,
  type SessionRow,
} from "./stats";
import { categoryCoverage, CATEGORY_LABEL, type Category } from "./taxonomy";
import { daysBetween, daysSinceLast, humanSpan } from "./journey";

export type Insight = {
  kind: "good" | "watch" | "info";
  text: string;
  topic: string; // stable key for "explain this" / dedupe
};

export const INSIGHTS_MIN_SESSIONS = 5;

const DAY = 86400000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function inWindow(s: SessionRow, from: Date, to: Date): boolean {
  const d = parseDateOnly(s.trained_on);
  return d >= from && d < to;
}

function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round(((a - b) / b) * 100);
}

export type SubmissionTrend = "improving" | "declining" | "steady";

/** Per-submission trajectory: last 90 days vs the 90 before, by finish rate. */
export function submissionTrends(
  sessions: SessionRow[],
  today: Date = new Date(),
): Map<string, SubmissionTrend> {
  const t90 = new Date(today.getTime() - 90 * DAY);
  const t180 = new Date(today.getTime() - 180 * DAY);
  const recent = submissionStats(sessions.filter((s) => inWindow(s, t90, new Date(today.getTime() + DAY))));
  const prior = submissionStats(sessions.filter((s) => inWindow(s, t180, t90)));
  const priorBy = new Map(prior.map((p) => [p.name, p]));
  const out = new Map<string, SubmissionTrend>();
  for (const r of recent) {
    const p = priorBy.get(r.name);
    if (!p || r.total < 3 || p.total < 3) continue;
    const delta = r.rate - p.rate;
    out.set(r.name, delta >= 0.2 ? "improving" : delta <= -0.2 ? "declining" : "steady");
  }
  return out;
}

export function generateInsights(
  sessions: SessionRow[],
  today: Date = new Date(),
): Insight[] {
  if (sessions.length < INSIGHTS_MIN_SESSIONS) return [];
  const out: Insight[] = [];
  const tomorrow = new Date(today.getTime() + DAY);
  const d30 = new Date(today.getTime() - 30 * DAY);
  const d60 = new Date(today.getTime() - 60 * DAY);
  const d56 = new Date(today.getTime() - 56 * DAY);

  // --- Volume, month over month ---
  const last30 = sessions.filter((s) => inWindow(s, d30, tomorrow));
  const prior30 = sessions.filter((s) => inWindow(s, d60, d30));
  if (last30.length >= 2 && prior30.length >= 2) {
    const mins = (a: SessionRow[]) => a.reduce((n, s) => n + s.duration_min, 0);
    const change = pct(mins(last30), mins(prior30));
    if (Math.abs(change) >= 15) {
      out.push({
        kind: change > 0 ? "good" : "watch",
        topic: "volume",
        text:
          change > 0
            ? `You trained ${change}% more in the last 30 days than the 30 before — ${last30.length} sessions, ${Math.round(mins(last30) / 60)} hours on the mat.`
            : `Mat time is down ${Math.abs(change)}% versus the previous 30 days (${last30.length} sessions vs ${prior30.length}). Life happens — just don't let it become a habit.`,
      });
    }
  }

  // --- Gaps and comebacks ---
  const gap = daysSinceLast(sessions, today);
  if (gap != null && gap >= 14) {
    out.push({
      kind: "watch",
      topic: "gap",
      text: `It's been ${humanSpan(gap)} since your last session. The mat is patient, but timing is everything — even one short roll resets the rhythm.`,
    });
  } else {
    const sorted = [...sessions].sort((a, b) => a.trained_on.localeCompare(b.trained_on));
    if (sorted.length >= 2) {
      const last = parseDateOnly(sorted[sorted.length - 1].trained_on);
      const before = parseDateOnly(sorted[sorted.length - 2].trained_on);
      const layoff = daysBetween(before, last);
      if (layoff >= 21 && gap != null && gap <= 14) {
        out.push({
          kind: "info",
          topic: "comeback",
          text: `Back after ${humanSpan(layoff)} off. Expect your feel scores to lag for a couple of weeks — that's cardio, not skill.`,
        });
      }
    }
  }

  // --- Streak ---
  const streak = currentStreak(sessions, today);
  if (streak >= 3) {
    out.push({
      kind: "good",
      topic: "streak",
      text: `${streak} days in a row. Consistency is the whole game at every belt.`,
    });
  }

  // --- Rhythm ---
  if (sessions.length >= 8) {
    const counts = new Array(7).fill(0);
    for (const s of sessions) counts[parseDateOnly(s.trained_on).getDay()]++;
    const ranked = counts
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c >= Math.max(2, sessions.length * 0.15))
      .sort((a, b) => b.c - a.c)
      .slice(0, 3)
      .sort((a, b) => a.i - b.i);
    if (ranked.length) {
      out.push({
        kind: "info",
        topic: "rhythm",
        text: `You usually train on ${ranked.map((x) => WEEKDAYS[x.i]).join(", ")}.`,
      });
    }
  }

  // --- Submissions: trends, weapon, leak ---
  const trends = submissionTrends(sessions, today);
  const t90 = new Date(today.getTime() - 90 * DAY);
  const t180 = new Date(today.getTime() - 180 * DAY);
  const recentStats = submissionStats(sessions.filter((s) => inWindow(s, t90, tomorrow)));
  const priorStats = new Map(
    submissionStats(sessions.filter((s) => inWindow(s, t180, t90))).map((p) => [p.name, p]),
  );
  trends.forEach((trend, name) => {
    if (trend === "steady") return;
    const r = recentStats.find((x) => x.name === name)!;
    const p = priorStats.get(name)!;
    out.push({
      kind: trend === "improving" ? "good" : "watch",
      topic: `sub:${name}`,
      text:
        trend === "improving"
          ? `Your ${name} finish rate climbed from ${Math.round(p.rate * 100)}% to ${Math.round(r.rate * 100)}% over the last three months.`
          : `Your ${name} finish rate slipped from ${Math.round(p.rate * 100)}% to ${Math.round(r.rate * 100)}% over the last three months — worth a drilling block.`,
    });
  });

  const last8w = submissionStats(sessions.filter((s) => inWindow(s, d56, tomorrow)));
  const leak = last8w.filter((s) => s.caught >= 3).sort((a, b) => b.caught - a.caught)[0];
  if (leak) {
    out.push({
      kind: "watch",
      topic: "leak",
      text: `The ${leak.name} has caught you ${leak.caught} times in the last 8 weeks — your most persistent leak. Escapes first, then prevention.`,
    });
  }
  const weapon = last8w.filter((s) => s.hit >= 3 && s.name !== leak?.name).sort((a, b) => b.hit - a.hit)[0];
  if (weapon) {
    out.push({
      kind: "good",
      topic: "weapon",
      text: `The ${weapon.name} is your sharpest weapon right now — ${weapon.hit} finishes in 8 weeks${weapon.caught ? ` against ${weapon.caught} caught` : ", never caught in it"}.`,
    });
  }

  // --- Overtraining signal: feel on heavy weeks vs lighter ones ---
  const byWeek = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const d = parseDateOnly(s.trained_on);
    const monday = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY);
    const key = monday.toISOString().slice(0, 10);
    byWeek.set(key, [...(byWeek.get(key) ?? []), s]);
  }
  const heavy: number[] = [];
  const light: number[] = [];
  byWeek.forEach((wk) => {
    const avg = wk.reduce((n, s) => n + s.feel, 0) / wk.length;
    (wk.length >= 4 ? heavy : light).push(avg);
  });
  if (heavy.length >= 3 && light.length >= 3) {
    const m = (a: number[]) => a.reduce((n, x) => n + x, 0) / a.length;
    if (m(light) - m(heavy) >= 0.6) {
      out.push({
        kind: "watch",
        topic: "overtraining",
        text: `Your feel scores drop on weeks with 4+ sessions (${m(heavy).toFixed(1)} vs ${m(light).toFixed(1)}). You may be training past recovery — a lighter week isn't lost progress.`,
      });
    }
  }

  // --- Feel trend ---
  if (last30.length >= 3 && prior30.length >= 3) {
    const avg = (a: SessionRow[]) => a.reduce((n, s) => n + s.feel, 0) / a.length;
    const diff = avg(last30) - avg(prior30);
    if (Math.abs(diff) >= 0.5) {
      out.push({
        kind: diff > 0 ? "good" : "watch",
        topic: "feel",
        text:
          diff > 0
            ? `Sessions are feeling better — average feel ${avg(last30).toFixed(1)} this month, up from ${avg(prior30).toFixed(1)}.`
            : `Sessions have felt rougher lately — average feel ${avg(last30).toFixed(1)}, down from ${avg(prior30).toFixed(1)}. Check sleep and recovery before technique.`,
      });
    }
  }

  // --- Coverage gaps from what's drilled ---
  const drilled = sessions.map((s) => s.drilled).filter((d): d is string => !!d && d.trim().length > 0);
  if (drilled.length >= 10) {
    const cov = categoryCoverage(drilled);
    const entries = (Object.entries(cov) as [Category, number][]).sort((a, b) => b[1] - a[1]);
    const [topCat, topN] = entries[0];
    const gapPairs: [Category, Category][] = [
      ["passing", "escapes"],
      ["guard", "passing"],
      ["submissions", "escapes"],
    ];
    for (const [a, b] of gapPairs) {
      if (cov[a] >= 5 && cov[b] <= 1) {
        out.push({
          kind: "watch",
          topic: `coverage:${b}`,
          text: `You've drilled ${CATEGORY_LABEL[a].toLowerCase()} ${cov[a]} times but ${CATEGORY_LABEL[b].toLowerCase()} only ${cov[b] === 0 ? "never" : "once"}. That side of your game is under-trained.`,
        });
        break;
      }
    }
    if (topN >= 5 && cov.takedowns === 0) {
      out.push({
        kind: "info",
        topic: "coverage:takedowns",
        text: `No takedown or wrestling work logged yet. Every roll starts standing in competition.`,
      });
    }
    if (out.every((i) => !i.topic.startsWith("coverage"))) {
      out.push({
        kind: "info",
        topic: "coverage:top",
        text: `Most of your drilling is ${CATEGORY_LABEL[topCat].toLowerCase()} (${topN} sessions).`,
      });
    }
  }

  // --- Partners ---
  const partnerAgg = new Map<string, { n: number; caught: number; hit: number; name: string }>();
  for (const s of sessions) {
    for (const p of s.partners ?? []) {
      const key = p.trim().toLowerCase();
      if (!key) continue;
      const cur = partnerAgg.get(key) ?? { n: 0, caught: 0, hit: 0, name: p.trim() };
      cur.n++;
      cur.caught += s.subs_caught_in?.length ?? 0;
      cur.hit += s.subs_hit?.length ?? 0;
      partnerAgg.set(key, cur);
    }
  }
  const partners = Array.from(partnerAgg.values()).filter((p) => p.n >= 3);
  if (partners.length >= 2) {
    const toughest = [...partners].sort((a, b) => b.caught / b.n - a.caught / a.n)[0];
    if (toughest.caught / toughest.n >= 1) {
      out.push({
        kind: "info",
        topic: "partner:toughest",
        text: `${toughest.name} is your toughest training partner — you get caught about ${(toughest.caught / toughest.n).toFixed(1)}× per session together. That's the partner making you better.`,
      });
    }
  }

  // Good news first, then things to watch, then context. Cap the list.
  const order = { good: 0, watch: 1, info: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 8);
}
