import { describe, expect, it } from "vitest";
import { generateInsights, submissionTrends } from "./insights";
import { classifyText, categoryCoverage } from "./taxonomy";
import { journeyHeader, milestones, pace, humanSpan } from "./journey";
import type { SessionRow } from "./stats";

const TODAY = new Date("2026-09-24T12:00:00");

function daysAgo(n: number): string {
  const d = new Date(TODAY.getTime() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function session(over: Partial<SessionRow> & { trained_on: string }): SessionRow {
  return {
    id: over.trained_on + Math.random(),
    duration_min: 60,
    rounds: 5,
    subs_hit: [],
    subs_caught_in: [],
    partners: [],
    feel: 3,
    gym: "Clockwork",
    drilled: null,
    note: null,
    created_at: over.trained_on + "T20:00:00Z",
    ...over,
  };
}

describe("generateInsights", () => {
  it("stays silent below the data threshold", () => {
    const few = [1, 3, 5].map((n) => session({ trained_on: daysAgo(n) }));
    expect(generateInsights(few, TODAY)).toEqual([]);
  });

  it("flags a persistent leak and a sharpest weapon from the last 8 weeks", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      session({
        trained_on: daysAgo(i * 4),
        subs_caught_in: ["triangle"],
        subs_hit: ["armbar"],
      }),
    );
    const out = generateInsights(rows, TODAY);
    expect(out.some((i) => i.topic === "leak" && /triangle/.test(i.text))).toBe(true);
    expect(out.some((i) => i.topic === "weapon" && /armbar/.test(i.text))).toBe(true);
  });

  it("warns after a long gap", () => {
    const rows = Array.from({ length: 6 }, (_, i) => session({ trained_on: daysAgo(30 + i * 3) }));
    const out = generateInsights(rows, TODAY);
    expect(out.some((i) => i.topic === "gap")).toBe(true);
  });

  it("detects improving submission trends across 90-day windows", () => {
    const prior = Array.from({ length: 4 }, (_, i) =>
      session({ trained_on: daysAgo(100 + i * 5), subs_caught_in: ["kimura"] }),
    );
    const recent = Array.from({ length: 4 }, (_, i) =>
      session({ trained_on: daysAgo(10 + i * 5), subs_hit: ["kimura"] }),
    );
    const trends = submissionTrends([...prior, ...recent], TODAY);
    expect(trends.get("kimura")).toBe("improving");
    const out = generateInsights([...prior, ...recent], TODAY);
    expect(out.some((i) => i.topic === "sub:kimura" && i.kind === "good")).toBe(true);
  });

  it("spots coverage gaps from drilled text", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      session({ trained_on: daysAgo(i * 3), drilled: "knee cut pass and toreando passing" }),
    );
    const out = generateInsights(rows, TODAY);
    expect(out.some((i) => i.topic === "coverage:escapes")).toBe(true);
  });

  it("puts good news before warnings", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      session({ trained_on: daysAgo(i * 4), subs_caught_in: ["triangle"], subs_hit: ["armbar"] }),
    );
    const out = generateInsights(rows, TODAY);
    const kinds = out.map((i) => i.kind);
    expect(kinds.indexOf("good")).toBeLessThan(kinds.indexOf("watch"));
  });
});

describe("taxonomy", () => {
  it("classifies drilled text into categories", () => {
    expect(classifyText("knee cut pass from headquarters")).toContain("passing");
    expect(classifyText("hip escape and framing from side control")).toContain("escapes");
    expect(classifyText("heel hook entries from saddle")).toContain("leg_locks");
    expect(classifyText("")).toEqual([]);
  });
  it("counts sessions per category", () => {
    const cov = categoryCoverage(["knee cut pass", "passing drills", "shrimp escapes"]);
    expect(cov.passing).toBe(2);
    expect(cov.escapes).toBe(1);
  });
});

describe("journey", () => {
  const history = [
    { id: "a", kind: "start" as const, belt: "white" as const, stripes: 2, promoted_on: daysAgo(400), created_at: "x" },
    { id: "b", kind: "promotion" as const, belt: "blue" as const, stripes: 0, promoted_on: daysAgo(200), created_at: "y" },
  ];
  const rows = Array.from({ length: 30 }, (_, i) => session({ trained_on: daysAgo(i * 10) }));

  it("describes the current rank with time and hours at rank", () => {
    const h = journeyHeader(history, rows, TODAY)!;
    expect(h.rank).toBe("Blue belt");
    expect(h.timeAtRank).toMatch(/months/);
    expect(h.sessionsAtRank).toBe(21); // sessions within the last 200 days, promotion day inclusive
    expect(h.isStart).toBe(false);
  });

  it("builds milestones newest first, including promotions and volume marks", () => {
    const ms = milestones(history, rows);
    expect(ms[0].date >= ms[ms.length - 1].date).toBe(true);
    expect(ms.some((m) => m.kind === "promotion")).toBe(true);
    expect(ms.some((m) => m.title === "25th session")).toBe(true);
    expect(ms.some((m) => m.title === "First session logged")).toBe(true);
  });

  it("projects the next round-number marks from trailing pace", () => {
    const p = pace(rows, TODAY);
    expect(p.sessionsPerWeek).toBeGreaterThan(0);
    expect(p.nextSessionMark).toBe(50);
    expect(p.nextSessionMarkDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats spans for humans", () => {
    expect(humanSpan(3)).toBe("3 days");
    expect(humanSpan(21)).toBe("3 weeks");
    expect(humanSpan(400)).toBe("13 months");
    expect(humanSpan(1000)).toBe("2.7 years");
  });
});
