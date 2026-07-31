import { describe, expect, it } from "vitest";
import {
  buildPublicHolidaySearchParams,
  parsePublicHolidayMetaResponse,
  parseTodayResponse,
} from "@/lib/calendar-api";

describe("buildPublicHolidaySearchParams", () => {
  it("uses state+year without coverage=all", () => {
    const q = buildPublicHolidaySearchParams({ year: 2026, state: "selangor" });
    expect(q.get("year")).toBe("2026");
    expect(q.get("state")).toBe("selangor");
    expect(q.get("coverage")).toBeNull();
  });

  it("defaults to coverage=all when no state", () => {
    const q = buildPublicHolidaySearchParams({ year: 2026 });
    expect(q.get("year")).toBe("2026");
    expect(q.get("coverage")).toBe("all");
    expect(q.get("state")).toBeNull();
  });
});

describe("parsePublicHolidayMetaResponse", () => {
  it("parses year and state options", () => {
    const meta = parsePublicHolidayMetaResponse({
      defaultYear: 2026,
      yearOptions: [{ value: 2026, label: "2026" }],
      coverageOptions: [{ value: "all", label: "All" }],
      stateOptions: [{ value: "selangor", label: "Selangor" }],
    });
    expect(meta.defaultYear).toBe(2026);
    expect(meta.yearOptions[0]?.value).toBe(2026);
    expect(meta.stateOptions[0]?.value).toBe("selangor");
  });
});

describe("parseTodayResponse", () => {
  it("parses primaryStatus and matched activities", () => {
    const today = parseTodayResponse({
      date: "2026-03-09",
      primaryStatus: "exam_week",
      statuses: ["exam_week"],
      sessionResolved: { id: "B-20263", label: "Sesi", group: "B" },
      matchedActivities: [
        {
          name: "Peperiksaan Akhir",
          startDate: "2026-03-01",
          endDate: "2026-03-14",
          type: "examination",
          group: "B",
        },
      ],
    });
    expect(today.primaryStatus).toBe("exam_week");
    expect(today.matchedActivities[0]?.name).toBe("Peperiksaan Akhir");
  });
});
