import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMalaysiaNowFormatted,
  getTodayISO,
  normalizeDateString,
  toComparableDateValue,
  toPromptDate,
} from "./dates";

describe("getTodayISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses Malaysia timezone, not UTC midnight rollover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T20:00:00.000Z"));
    expect(getTodayISO()).toBe("2026-05-25");
  });

  it("returns YYYY-MM-DD format", () => {
    expect(getTodayISO(new Date("2026-03-01T12:00:00.000Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getMalaysiaNowFormatted", () => {
  it("includes MYT suffix", () => {
    const formatted = getMalaysiaNowFormatted(new Date("2026-05-25T06:30:00.000Z"));
    expect(formatted).toContain("MYT");
  });
});

describe("normalizeDateString", () => {
  it("keeps ISO dates", () => {
    expect(normalizeDateString("2026-05-25")).toBe("2026-05-25");
  });

  it("converts DD-MM-YYYY to ISO", () => {
    expect(normalizeDateString("25-05-2026")).toBe("2026-05-25");
  });
});

describe("toComparableDateValue", () => {
  it("orders dates chronologically", () => {
    expect(toComparableDateValue("2026-05-24")).toBeLessThan(
      toComparableDateValue("2026-05-25")
    );
  });
});

describe("toPromptDate", () => {
  it("uses 3-letter English month", () => {
    expect(toPromptDate("2026-03-15")).toBe("15 Mar 2026");
    expect(toPromptDate("2026-08-01")).toBe("01 Aug 2026");
  });

  it("accepts DD-MM-YYYY input", () => {
    expect(toPromptDate("15-03-2026")).toBe("15 Mar 2026");
  });
});
