import { describe, expect, it } from "vitest";
import {
  addDatesFromContextText,
  collectAllowedDateTokens,
} from "@/lib/chat/allowed-dates";
import type { Activity } from "@/lib/data";

describe("collectAllowedDateTokens", () => {
  it("includes regional dates", () => {
    const acts: Activity[] = [
      {
        name: "Kuliah",
        startDate: "2026-02-01",
        endDate: "2026-06-01",
        type: "lecture",
        regionalStartDate: "2026-02-08",
        regionalEndDate: "2026-02-15",
      },
    ];
    const allowed = collectAllowedDateTokens(acts);
    expect(allowed.has("01-02-2026")).toBe(true);
    expect(allowed.has("08-02-2026")).toBe(true);
  });
});

describe("addDatesFromContextText", () => {
  it("pulls DD-MM-YYYY from lecture week lines", () => {
    const allowed = new Set<string>();
    addDatesFromContextText(
      allowed,
      "Week 3: 15-02-2026 to 21-02-2026\nCURRENT LECTURE WEEK"
    );
    expect(allowed.has("15-02-2026")).toBe(true);
    expect(allowed.has("21-02-2026")).toBe(true);
  });
});
