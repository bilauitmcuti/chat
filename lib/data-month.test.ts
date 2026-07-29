import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getActivitiesForList,
  getActivitiesForMonth,
  getActivityListGroupMonthKey,
  groupActivitiesByListStartMonth,
  matchesActivityDate,
} from "./data";
import type { Activity } from "./data";

const dec31Activity: Activity = {
  name: "End of semester",
  startDate: "2026-12-31",
  endDate: "2026-12-31",
  type: "lecture",
  group: "B",
};

const spanningActivity: Activity = {
  name: "Kuliah",
  startDate: "2026-11-03",
  endDate: "2026-12-31",
  type: "lecture",
  group: "B",
};

const allFilters = {
  selectedProgram: "All" as const,
  showRegistration: true,
  showLecture: true,
  showExamination: true,
  showOthersExams: true,
  showBreak: true,
  showSemesterPendek: true,
  showKuliahIntersesi: true,
};

vi.mock("./calendar-store", () => ({
  getSnapshot: () => ({
    version: 1,
    sessionOptions: [{ id: "B-20264", label: "Test", group: "B" as const }],
    programOptions: [],
    sessions: {
      "B-20264": { activities: [dec31Activity, spanningActivity] },
    },
  }),
  subscribe: () => () => {},
}));

describe("getActivitiesForMonth", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "Intl",
      Object.assign(Intl, {
        DateTimeFormat: class {
          resolvedOptions() {
            return { timeZone: "Asia/Kuala_Lumpur" };
          }
        },
      })
    );
  });

  it("includes activities on the last day of the month (UTC date strings)", () => {
    expect(matchesActivityDate(dec31Activity, "2026-12-31", false)).toBe(true);
    const monthActivities = getActivitiesForMonth(2026, 12, "B-20264", false);
    expect(monthActivities.map((a) => a.name)).toContain("End of semester");
  });
});

describe("getActivitiesForList", () => {
  it("returns every API activity for the session after filters", () => {
    const list = getActivitiesForList(["B-20264"], allFilters);
    expect(list.map((a) => a.name).sort()).toEqual(["End of semester", "Kuliah"]);
  });

  it("groups by startDate month only (spanning activity under November)", () => {
    const list = getActivitiesForList(["B-20264"], allFilters);
    const grouped = groupActivitiesByListStartMonth(list);
    expect(getActivityListGroupMonthKey(spanningActivity)).toBe("November 2026");
    expect(grouped["November 2026"]?.map((a) => a.name)).toContain("Kuliah");
    expect(grouped["December 2026"]?.map((a) => a.name)).toContain("End of semester");
    expect(grouped["December 2026"]?.map((a) => a.name)).not.toContain("Kuliah");
  });
});
