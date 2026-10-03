import { describe, expect, it } from "vitest";
import { resolveCalendarContextIntent } from "@/lib/chat/calendar-intent";
import { isClefUnderstandingEnabled } from "@/lib/chat/clef/model";
import { mergeClefUnderstanding } from "@/lib/chat/clef/merge";
import { parseClefResponse } from "@/lib/chat/clef/parse";
import { routeChatTopics } from "@/lib/chat/topic-router";

/** Live Cloudflare MCP probe: "Bila cuti umum Selangor bulan Mei?" */
const PUBLIC_HOLIDAY_PROBE = {
  model: "clef",
  answers: {
    primary_topic: {
      type: "choice",
      choice: "public_holiday",
      confidence: 0.8816,
      probabilities: {
        academic_calendar: 0.0419,
        lecture_weeks: 0.0021,
        public_holiday: 0.9536,
        uitm_general: 0.0024,
      },
    },
    calendar_intent: {
      type: "choice",
      choice: "festive",
      confidence: 0.3796,
    },
    also_public_holiday: { type: "noul", noul: 0.9071 },
  },
};

/** Live probe: "bila cuti semester?" */
const SEMESTER_BREAK_PROBE = {
  model: "clef",
  answers: {
    primary_topic: {
      type: "choice",
      choice: "academic_calendar",
      confidence: 0.7949,
    },
    calendar_intent: {
      type: "choice",
      choice: "break",
      confidence: 0.9345,
    },
    also_lecture_weeks: { type: "noul", noul: 0.0348 },
    also_public_holiday: { type: "noul", noul: 0.0432 },
    is_day_status: { type: "noul", noul: 0.0385 },
    reply_language: {
      type: "choice",
      choice: "ms",
      confidence: 0.1193,
    },
  },
};

describe("parseClefResponse", () => {
  it("reads choice confidence and noul from a live public-holiday probe", () => {
    const parsed = parseClefResponse(PUBLIC_HOLIDAY_PROBE);
    expect(parsed?.primaryTopic).toBe("public_holiday");
    expect(parsed?.primaryTopicConfidence).toBeCloseTo(0.8816);
    expect(parsed?.alsoPublicHoliday).toBe(true);
    expect(parsed?.calendarIntent).toBe("festive");
    expect(parsed?.calendarIntentConfidence).toBeCloseTo(0.3796);
  });

  it("maps reply language ms to ms-MY", () => {
    const parsed = parseClefResponse(SEMESTER_BREAK_PROBE);
    expect(parsed?.replyLanguage).toBe("ms-MY");
    expect(parsed?.replyLanguageConfidence).toBeCloseTo(0.1193);
    expect(parsed?.isDayStatus).toBe(false);
  });

  it("returns null when answers are missing", () => {
    expect(parseClefResponse({ model: "clef" })).toBeNull();
  });
});

describe("mergeClefUnderstanding", () => {
  it("overrides a default academic route when public holiday confidence is high", () => {
    const message = "Bila cuti umum Selangor bulan Mei?";
    const heuristicRoute = routeChatTopics(message, false);
    const merged = mergeClefUnderstanding({
      heuristicRoute,
      heuristicIntent: resolveCalendarContextIntent(message),
      clef: parseClefResponse(PUBLIC_HOLIDAY_PROBE),
      hasMatchedActivity: false,
    });
    expect(merged.topicRoute.topics).toContain("public_holiday");
    expect(merged.topicRoute.topics).not.toContain("academic_calendar");
    expect(merged.contextIntent).toBe("break");
  });

  it("keeps academic calendar and applies a confident break intent", () => {
    const message = "bila cuti semester?";
    const merged = mergeClefUnderstanding({
      heuristicRoute: routeChatTopics(message, false),
      heuristicIntent: resolveCalendarContextIntent(message),
      clef: parseClefResponse(SEMESTER_BREAK_PROBE),
      hasMatchedActivity: false,
    });
    expect(merged.topicRoute.topics).toContain("academic_calendar");
    expect(merged.contextIntent).toBe("break");
  });

  it("does not drop academic calendar when a named activity matched", () => {
    const merged = mergeClefUnderstanding({
      heuristicRoute: {
        topics: ["academic_calendar", "public_holiday"],
        hasNamedActivity: true,
      },
      heuristicIntent: "all",
      clef: parseClefResponse(PUBLIC_HOLIDAY_PROBE),
      hasMatchedActivity: true,
    });
    expect(merged.topicRoute.topics).toContain("academic_calendar");
    expect(merged.topicRoute.topics).toContain("public_holiday");
  });

  it("returns heuristics when Clef is null", () => {
    const route = routeChatTopics("hi", false, { isMinimalTurn: true });
    const merged = mergeClefUnderstanding({
      heuristicRoute: route,
      heuristicIntent: "all",
      clef: null,
      hasMatchedActivity: false,
    });
    expect(merged.topicRoute).toEqual(route);
    expect(merged.contextIntent).toBe("all");
  });
});

describe("isClefUnderstandingEnabled", () => {
  it("is on unless CHAT_USE_CLEF is disabled", () => {
    const prev = process.env.CHAT_USE_CLEF;
    delete process.env.CHAT_USE_CLEF;
    expect(isClefUnderstandingEnabled()).toBe(true);
    process.env.CHAT_USE_CLEF = "0";
    expect(isClefUnderstandingEnabled()).toBe(false);
    process.env.CHAT_USE_CLEF = "false";
    expect(isClefUnderstandingEnabled()).toBe(false);
    if (prev === undefined) delete process.env.CHAT_USE_CLEF;
    else process.env.CHAT_USE_CLEF = prev;
  });
});
