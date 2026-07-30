import { describe, expect, it } from "vitest";
import { matchesActivityDate, type Activity } from "./data";

const dec31Activity: Activity = {
  name: "End of semester",
  startDate: "2026-12-31",
  endDate: "2026-12-31",
  type: "lecture",
  group: "B",
};

describe("matchesActivityDate", () => {
  it("matches activities on the last day of the month (UTC date strings)", () => {
    expect(matchesActivityDate(dec31Activity, "2026-12-31", false)).toBe(true);
    expect(matchesActivityDate(dec31Activity, "2026-12-30", false)).toBe(false);
  });
});
