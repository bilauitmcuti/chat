import { describe, expect, it } from "vitest";
import {
  resolveChatExecutionMode,
  shouldPreferSingleStream,
} from "@/lib/chat/handler";
import { MAX_AGENT_TOOL_STEPS } from "@/lib/chat/agent/types";

describe("resolveChatExecutionMode", () => {
  it("uses single_stream when agent tools path is disabled (dev Llama)", () => {
    expect(resolveChatExecutionMode({ isAgentToolsPath: false })).toBe("single_stream");
  });

  it("uses agent on Gemma tools path for complex turns", () => {
    expect(resolveChatExecutionMode({ isAgentToolsPath: true })).toBe("agent");
  });

  it("short-circuits matched or simple turns to single_stream on tools path", () => {
    expect(
      resolveChatExecutionMode({
        isAgentToolsPath: true,
        preferSingleStream: true,
      })
    ).toBe("single_stream");
  });

  it("is deterministic — same inputs always yield the same mode", () => {
    const input = { isAgentToolsPath: true, preferSingleStream: false };
    expect(resolveChatExecutionMode(input)).toBe(resolveChatExecutionMode(input));
    expect(resolveChatExecutionMode(input)).toBe("agent");
  });
});

describe("shouldPreferSingleStream", () => {
  it("prefers single_stream for matched activities", () => {
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: true,
        isSimple: false,
        topics: ["academic_calendar"],
        isComplexTurn: true,
      })
    ).toBe(true);
  });

  it("prefers single_stream for simple date questions", () => {
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: true,
        topics: ["academic_calendar"],
        isComplexTurn: false,
      })
    ).toBe(true);
  });

  it("prefers single_stream for calendar-only topics including complex questions", () => {
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["academic_calendar"],
        isComplexTurn: true,
      })
    ).toBe(true);
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["lecture_weeks"],
        isComplexTurn: true,
      })
    ).toBe(true);
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["public_holiday"],
        isComplexTurn: true,
      })
    ).toBe(true);
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["lecture_weeks", "public_holiday"],
        isComplexTurn: true,
      })
    ).toBe(true);
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["academic_calendar", "lecture_weeks"],
        isComplexTurn: true,
      })
    ).toBe(true);
  });

  it("uses agent for complex uitm_general turns", () => {
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["uitm_general"],
        isComplexTurn: true,
      })
    ).toBe(false);
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["academic_calendar", "uitm_general"],
        isComplexTurn: true,
      })
    ).toBe(false);
  });

  it("prefers single_stream for simple uitm_general turns", () => {
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: true,
        topics: ["uitm_general"],
        isComplexTurn: false,
      })
    ).toBe(true);
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: ["uitm_general"],
        isComplexTurn: false,
      })
    ).toBe(true);
  });

  it("uses agent when no topics are routed and the turn is complex", () => {
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: [],
        isComplexTurn: true,
      })
    ).toBe(false);
    expect(
      shouldPreferSingleStream({
        hasMatchedActivity: false,
        isSimple: false,
        topics: [],
        isComplexTurn: false,
      })
    ).toBe(true);
  });
});

describe("appendReasoningLine", () => {
  it("replaces reasoning paragraphs without duplicating", async () => {
    const { replaceReasoningParagraph } = await import("@/lib/chat/handler");
    const first =
      "I'm checking the official UiTM academic calendar for all programmes to find the correct semester and confirm the dates before preparing your answer.";
    const second =
      "The relevant semester has been identified. I'm verifying the dates to ensure the information matches the latest official academic calendar.";
    expect(replaceReasoningParagraph("", first)).toBe(first);
    expect(replaceReasoningParagraph(first, second)).toBe(second);
    expect(replaceReasoningParagraph(second, second)).toBe(second);
  });
});

describe("MAX_AGENT_TOOL_STEPS", () => {
  it("caps tool steps at 2 for agent fallback turns", () => {
    expect(MAX_AGENT_TOOL_STEPS).toBe(2);
  });
});
