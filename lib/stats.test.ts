import { describe, expect, it } from "vitest";
import {
  currentStreak,
  formatHours,
  parseDateOnly,
  sessionTotals,
  weekStart,
  weeklyBuckets,
  type SessionRow,
} from "./stats";

// Minimal session factory — only the fields the stats helpers read.
function session(overrides: Partial<SessionRow>): SessionRow {
  return {
    id: "x",
    trained_on: "2026-06-01",
    duration_min: 60,
    rounds: 5,
    subs_hit: [],
    subs_caught_in: [],
    partners: [],
    feel: 3,
    gym: null,
    drilled: null,
    note: null,
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("parseDateOnly", () => {
  it("parses YYYY-MM-DD as local time, not UTC", () => {
    const d = parseDateOnly("2026-06-10");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(0);
  });
});

describe("weekStart", () => {
  it("anchors to Monday", () => {
    // 2026-06-10 is a Wednesday → week starts Monday 2026-06-08.
    expect(weekStart(parseDateOnly("2026-06-10")).getDate()).toBe(8);
  });
  it("is identity on a Monday", () => {
    expect(weekStart(parseDateOnly("2026-06-08")).getDate()).toBe(8);
  });
  it("maps Sunday back to the previous Monday", () => {
    // 2026-06-14 is a Sunday → still the Jun 8 week.
    expect(weekStart(parseDateOnly("2026-06-14")).getDate()).toBe(8);
  });
});

describe("weeklyBuckets", () => {
  const today = parseDateOnly("2026-06-10"); // Wednesday

  it("returns the requested number of buckets ending with the current week", () => {
    const buckets = weeklyBuckets([], 8, today);
    expect(buckets).toHaveLength(8);
    expect(buckets[7].weekStart).toBe("2026-06-08");
    expect(buckets[0].weekStart).toBe("2026-04-20");
  });

  it("sums minutes, rounds, and sub counts into the right week", () => {
    const buckets = weeklyBuckets(
      [
        session({ trained_on: "2026-06-08", duration_min: 60, rounds: 5, subs_hit: ["rnc"] }),
        session({ trained_on: "2026-06-09", duration_min: 30, rounds: 3, subs_caught_in: ["armbar", "kimura"] }),
        session({ trained_on: "2026-06-01", duration_min: 90, rounds: 8 }),
      ],
      8,
      today,
    );
    const thisWeek = buckets[7];
    const lastWeek = buckets[6];
    expect(thisWeek.mat_min).toBe(90);
    expect(thisWeek.rounds).toBe(8);
    expect(thisWeek.subs_hit).toBe(1);
    expect(thisWeek.subs_caught_in).toBe(2);
    expect(lastWeek.mat_min).toBe(90);
  });

  it("ignores sessions outside the window", () => {
    const buckets = weeklyBuckets(
      [session({ trained_on: "2025-01-01", duration_min: 999 })],
      8,
      today,
    );
    expect(buckets.every((b) => b.mat_min === 0)).toBe(true);
  });

  it("averages feel per week, rounded to one decimal, null when empty", () => {
    const buckets = weeklyBuckets(
      [
        session({ trained_on: "2026-06-08", feel: 2 }),
        session({ trained_on: "2026-06-09", feel: 5 }),
      ],
      8,
      today,
    );
    expect(buckets[7].feel_avg).toBe(3.5);
    expect(buckets[6].feel_avg).toBeNull();
  });

  it("spans a month boundary without losing sessions", () => {
    const buckets = weeklyBuckets(
      // 2026-05-31 (Sunday) belongs to the week starting Monday 2026-05-25.
      [session({ trained_on: "2026-05-31", duration_min: 45 })],
      8,
      today,
    );
    const bucket = buckets.find((b) => b.weekStart === "2026-05-25");
    expect(bucket?.mat_min).toBe(45);
  });
});

describe("currentStreak", () => {
  const today = parseDateOnly("2026-06-10");

  it("is 0 with no sessions", () => {
    expect(currentStreak([], today)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const s = ["2026-06-08", "2026-06-09", "2026-06-10"].map((d) =>
      session({ trained_on: d }),
    );
    expect(currentStreak(s, today)).toBe(3);
  });

  it("grants one-day grace when today is not yet trained", () => {
    const s = ["2026-06-08", "2026-06-09"].map((d) => session({ trained_on: d }));
    expect(currentStreak(s, today)).toBe(2);
  });

  it("breaks when yesterday and today are both missed", () => {
    const s = [session({ trained_on: "2026-06-08" })];
    expect(currentStreak(s, today)).toBe(0);
  });

  it("handles duplicate same-day sessions", () => {
    const s = [
      session({ trained_on: "2026-06-10" }),
      session({ trained_on: "2026-06-10" }),
      session({ trained_on: "2026-06-09" }),
    ];
    expect(currentStreak(s, today)).toBe(2);
  });
});

describe("sessionTotals", () => {
  it("sums everything", () => {
    const totals = sessionTotals([
      session({ duration_min: 60, rounds: 5, subs_hit: ["a", "b"], subs_caught_in: ["c"] }),
      session({ duration_min: 30, rounds: 2 }),
    ]);
    expect(totals).toEqual({
      total_sessions: 2,
      total_min: 90,
      total_rounds: 7,
      total_subs_hit: 2,
      total_subs_caught_in: 1,
    });
  });
});

describe("formatHours", () => {
  it("formats zero, minutes-only, hours-only, and mixed", () => {
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(45)).toBe("45m");
    expect(formatHours(120)).toBe("2h");
    expect(formatHours(135)).toBe("2h 15m");
  });
});
