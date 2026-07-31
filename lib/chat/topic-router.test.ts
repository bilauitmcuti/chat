import { describe, expect, it } from "vitest";
import {
  messageAsksDayStatus,
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

  it("routes day-status questions to academic_calendar", () => {
    const route = routeChatTopics("ada kelas hari ini?", false);
    expect(route.topics).toContain("academic_calendar");
  });

  it("routes greetings and test phrases away from academic calendar", () => {
    expect(routeChatTopics("hi", false, { isMinimalTurn: true }).topics).toEqual(
      []
    );
    expect(routeChatTopics("hey", false, { isMinimalTurn: true }).topics).toEqual(
      []
    );
    expect(routeChatTopics("test", false, { isMinimalTurn: true }).topics).toEqual(
      []
    );
  });

  it("still defaults non-minimal ambiguous chat to academic calendar", () => {
    const route = routeChatTopics("hello world this is longer", false, {
      isMinimalTurn: false,
    });
    expect(route.topics).toContain("academic_calendar");
  });
});

describe("messageAsksDayStatus", () => {
  it("detects ada kelas / class today", () => {
    expect(messageAsksDayStatus("ada kelas hari ini?")).toBe(true);
    expect(messageAsksDayStatus("is there class today?")).toBe(true);
    expect(messageAsksDayStatus("status hari ini")).toBe(true);
  });

  it("does not treat named academic break as day-status alone", () => {
    expect(messageAsksDayStatus("bila cuti semester")).toBe(false);
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
