import { describe, expect, it } from "vitest";
import {
  messageAsksLectureWeeks,
  messageAsksPublicHoliday,
  routeChatTopics,
} from "@/lib/chat/topic-router";

describe("routeChatTopics", () => {
  it("routes lecture weeks without bare kuliah in activity title", () => {
    const route = routeChatTopics("minggu kuliah sekarang?", false);
    expect(route.topics).toContain("lecture_weeks");
  });

  it("routes public holiday separately from academic", () => {
    const route = routeChatTopics("cuti umum Selangor bulan Mei", false);
    expect(route.topics).toContain("public_holiday");
  });

  it("forces academic when activity name matched", () => {
    const route = routeChatTopics("bila?", true);
    expect(route.topics).toContain("academic_calendar");
    expect(route.hasNamedActivity).toBe(true);
  });

  it("can return mixed topics", () => {
    const route = routeChatTopics(
      "bila peperiksaan akhir and cuti umum KL",
      false
    );
    expect(route.topics).toContain("academic_calendar");
    expect(route.topics).toContain("public_holiday");
  });
});

describe("messageAsksLectureWeeks", () => {
  it("does not trigger on kuliah alone", () => {
    expect(messageAsksLectureWeeks("bila mula kuliah")).toBe(false);
  });
});

describe("messageAsksPublicHoliday", () => {
  it("detects cuti umum", () => {
    expect(messageAsksPublicHoliday("senarai cuti umum Johor")).toBe(true);
  });

  it("does not treat uiTM academic break as public holiday", () => {
    expect(messageAsksPublicHoliday("bila cuti semester uitm")).toBe(false);
  });
});
