import { describe, expect, it } from "vitest";
import {
  formatLectureWeekLineFromWeeks,
  formatLectureWeeksTable,
  needsLectureWeekContext,
  needsLectureWeekTable,
} from "./lecture-week-context";
import type { LectureWeek } from "@/lib/calendar-api";

const sampleWeeks: LectureWeek[] = [
  {
    weekNumber: 3,
    weekStart: "2026-02-15",
    weekEnd: "2026-02-21",
    rangeLabel: "15-02-2026 to 21-02-2026",
    days: [
      { date: "2026-02-15", weekday: "Sun", label: "15" },
      { date: "2026-02-16", weekday: "Mon", label: "16" },
      { date: "2026-02-17", weekday: "Tue", label: "17" },
      { date: "2026-02-18", weekday: "Wed", label: "18" },
      { date: "2026-02-19", weekday: "Thu", label: "19" },
      { date: "2026-02-20", weekday: "Fri", label: "20" },
      { date: "2026-02-21", weekday: "Sat", label: "21" },
    ],
  },
];

describe("formatLectureWeekLineFromWeeks", () => {
  it("returns current lecture week when date falls in range", () => {
    const line = formatLectureWeekLineFromWeeks("202602", "2026-02-18", sampleWeeks);
    expect(line).toContain("Minggu Kuliah 3");
    expect(line).toContain("15-02-2026 to 21-02-2026");
  });

  it("returns not in lecture period when date is outside weeks", () => {
    const line = formatLectureWeekLineFromWeeks("202602", "2026-01-01", sampleWeeks);
    expect(line).toContain("Not in lecture period");
  });
});

describe("needsLectureWeekContext", () => {
  it("detects lecture intent from message hints", () => {
    expect(needsLectureWeekContext("all", "minggu kuliah sekarang?")).toBe(true);
    expect(needsLectureWeekContext("break", "when is cuti?")).toBe(false);
  });
});

describe("needsLectureWeekTable", () => {
  it("triggers for full-list requests", () => {
    expect(needsLectureWeekTable("Senarai minggu kuliah 1-14")).toBe(true);
    expect(needsLectureWeekTable("List of weeks for the semester")).toBe(true);
    expect(needsLectureWeekTable("Berapa minggu kuliah semester ini?")).toBe(true);
  });

  it("does not trigger for current-week question", () => {
    expect(needsLectureWeekTable("Minggu kuliah sekarang?")).toBe(false);
  });
});

describe("formatLectureWeeksTable", () => {
  it("renders all weeks with count header", () => {
    const block = formatLectureWeeksTable("B-20263", sampleWeeks);
    expect(block).toContain("WEEK_COUNT: 1");
    expect(block).toContain("Week 3: 15-02-2026 to 21-02-2026");
  });
});
