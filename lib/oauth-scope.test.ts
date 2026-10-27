import { describe, expect, it } from "vitest";
import { normalizeScope } from "./oauth-scope";

describe("normalizeScope", () => {
  it("defaults to read", () => {
    expect(normalizeScope(undefined)).toBe("read");
    expect(normalizeScope("")).toBe("read");
    expect(normalizeScope("read")).toBe("read");
  });
  it("grants write only as a whole word", () => {
    expect(normalizeScope("read write")).toBe("read write");
    expect(normalizeScope("write")).toBe("read write");
    expect(normalizeScope("WRITE read")).toBe("read write");
    // The consent-disclosure trick: 'readwrite' must not count as write.
    expect(normalizeScope("readwrite")).toBe("read");
    expect(normalizeScope("unreadable")).toBe("read");
  });
  it("drops unknown scopes", () => {
    expect(normalizeScope("read admin openid")).toBe("read");
    expect(normalizeScope("write admin")).toBe("read write");
  });
});
