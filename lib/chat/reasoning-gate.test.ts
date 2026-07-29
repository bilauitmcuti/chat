import { describe, expect, it } from "vitest";
import {
  buildReasoningComplexityInput,
  captureThinkingMetadata,
  computeThinkingDurationSec,
  formatThoughtCompletedLabel,
  formatThinkingDurationLabel,
  isComplexReasoningTurn,
  REASONING_PARAGRAPH_DELAY_MS,
  shouldEmitReasoningParagraph,
  shouldEmitReasoningPhase,
  shouldRenderReasoningUi,
  shouldShowCompletedDurationLabel,
  shouldShowCompletedThinkingBlock,
  shouldShowThinkingDurationLabel,
  shouldShowThinkingIndicator,
  THINKING_INDICATOR_DELAY_MS,
} from "@/lib/chat/reasoning-gate";

describe("reasoning-gate", () => {
  it("treats agent, multi-topic, and non-simple turns as complex", () => {
    expect(
      isComplexReasoningTurn({
        isSimple: true,
        useAgentTools: true,
        wantsTableOutput: false,
        multipleSessionsSelected: false,
        asksDetail: false,
        needsList: false,
        topics: ["academic_calendar"],
      })
    ).toBe(true);

    expect(
      isComplexReasoningTurn({
        isSimple: true,
        useAgentTools: false,
        wantsTableOutput: false,
        multipleSessionsSelected: false,
        asksDetail: false,
        needsList: false,
        topics: ["academic_calendar", "uitm_general"],
      })
    ).toBe(true);

    expect(
      isComplexReasoningTurn({
        isSimple: false,
        useAgentTools: false,
        wantsTableOutput: false,
        multipleSessionsSelected: false,
        asksDetail: false,
        needsList: false,
        topics: ["academic_calendar"],
      })
    ).toBe(true);
  });

  it("delays thinking and reasoning by configured thresholds", () => {
    const start = 1_000;
    expect(shouldShowThinkingIndicator(start, start + THINKING_INDICATOR_DELAY_MS - 1)).toBe(
      false
    );
    expect(shouldShowThinkingIndicator(start, start + THINKING_INDICATOR_DELAY_MS)).toBe(true);
    expect(shouldEmitReasoningParagraph(start, start + REASONING_PARAGRAPH_DELAY_MS - 1)).toBe(
      false
    );
    expect(shouldEmitReasoningParagraph(start, start + REASONING_PARAGRAPH_DELAY_MS)).toBe(true);
  });

  it("builds pre-routing complexity input without agent tools", () => {
    expect(
      buildReasoningComplexityInput({
        isSimple: true,
        wantsTableOutput: false,
        multipleSessionsSelected: false,
        asksDetail: false,
        needsList: false,
        topics: ["academic_calendar"],
      })
    ).toEqual({
      isSimple: true,
      useAgentTools: false,
      wantsTableOutput: false,
      multipleSessionsSelected: false,
      asksDetail: false,
      needsList: false,
      topics: ["academic_calendar"],
    });
  });

  it("gates reasoning phases by complexity and elapsed time", () => {
    const start = 5_000;
    expect(shouldEmitReasoningPhase(start, true, "start", start)).toBe(true);
    expect(shouldEmitReasoningPhase(start, false, "start", start)).toBe(false);
    expect(
      shouldEmitReasoningPhase(start, false, "final", start + REASONING_PARAGRAPH_DELAY_MS - 1)
    ).toBe(false);
    expect(shouldEmitReasoningPhase(start, false, "final", start + REASONING_PARAGRAPH_DELAY_MS)).toBe(
      true
    );
    expect(shouldEmitReasoningPhase(start, true, "progress", start + 500)).toBe(true);
    expect(shouldEmitReasoningPhase(start, false, "retry", start)).toBe(true);
  });

  it("captures thinking metadata when indicator delay has elapsed", () => {
    const start = 10_000;
    if (THINKING_INDICATOR_DELAY_MS > 0) {
      expect(
        captureThinkingMetadata(start, { now: start + THINKING_INDICATOR_DELAY_MS - 1 })
      ).toEqual({
        hadThinking: false,
      });
    }
    expect(
      captureThinkingMetadata(start, { now: start + THINKING_INDICATOR_DELAY_MS })
    ).toEqual({
      hadThinking: true,
      thinkingDurationSec: computeThinkingDurationSec(THINKING_INDICATOR_DELAY_MS),
    });
    expect(
      captureThinkingMetadata(start, {
        now: start + 200,
        hasReasoning: true,
      })
    ).toEqual({
      hadThinking: true,
      thinkingDurationSec: 0,
    });
  });

  it("shows duration label only when thinking exceeds four seconds", () => {
    expect(shouldShowThinkingDurationLabel(4)).toBe(false);
    expect(shouldShowThinkingDurationLabel(5)).toBe(true);
  });

  it("shows duration label for reasoning turns even when under five seconds", () => {
    expect(
      shouldShowCompletedDurationLabel({
        thinkingDurationSec: 3,
        hasReasoningContent: true,
      })
    ).toBe(true);
    expect(
      shouldShowCompletedDurationLabel({
        thinkingDurationSec: 3,
        hasReasoningContent: false,
      })
    ).toBe(false);
    expect(
      shouldShowCompletedDurationLabel({
        thinkingDurationSec: 6,
        hasReasoningContent: false,
      })
    ).toBe(true);
  });

  it("formats completed thought labels for brief, seconds, and minutes", () => {
    expect(formatThoughtCompletedLabel(0)).toBe("Thought briefly");
    expect(formatThoughtCompletedLabel(1)).toBe("Thought briefly");
    expect(formatThoughtCompletedLabel(2)).toBe("Thought briefly");
    expect(formatThoughtCompletedLabel(3)).toBe("Thought for 3 seconds");
    expect(formatThoughtCompletedLabel(5)).toBe("Thought for 5 seconds");
    expect(formatThoughtCompletedLabel(60)).toBe("Thought for 1 min");
    expect(formatThoughtCompletedLabel(65)).toBe("Thought for 1 min 5 sec");
    expect(formatThoughtCompletedLabel(120)).toBe("Thought for 2 mins");
  });

  it("keeps legacy duration fragment helper for callers", () => {
    expect(formatThinkingDurationLabel(2)).toBe("briefly");
    expect(formatThinkingDurationLabel(5)).toBe("5 seconds");
  });

  it("computes thinking duration from elapsed ms with rounding", () => {
    expect(computeThinkingDurationSec(450)).toBe(0);
    expect(computeThinkingDurationSec(500)).toBe(1);
    expect(computeThinkingDurationSec(2_100)).toBe(2);
    expect(computeThinkingDurationSec(2_500)).toBe(3);
    expect(computeThinkingDurationSec(65_000)).toBe(65);
  });

  it("decides when to keep the completed thinking block visible", () => {
    expect(
      shouldShowCompletedThinkingBlock({
        thinkingDurationSec: 3,
        hasReasoningContent: false,
      })
    ).toBe(false);
    expect(
      shouldShowCompletedThinkingBlock({
        thinkingDurationSec: 3,
        hasReasoningContent: true,
      })
    ).toBe(true);
    expect(
      shouldShowCompletedThinkingBlock({
        thinkingDurationSec: 6,
        hasReasoningContent: false,
      })
    ).toBe(true);
  });

  it("gates reasoning UI by model support and turn state", () => {
    expect(
      shouldRenderReasoningUi({
        reasoningUiSupported: false,
        isThinkingPhase: true,
        showThinking: true,
        hasReasoningContent: true,
        isRegenerating: false,
        hasProgressLabel: false,
        answerStreaming: false,
        answerComplete: false,
      })
    ).toBe(false);

    expect(
      shouldRenderReasoningUi({
        reasoningUiSupported: true,
        isMinimalTurn: true,
        isThinkingPhase: true,
        showThinking: true,
        hasReasoningContent: true,
        isRegenerating: false,
        hasProgressLabel: false,
        answerStreaming: false,
        answerComplete: false,
      })
    ).toBe(false);

    expect(
      shouldRenderReasoningUi({
        reasoningUiSupported: true,
        isThinkingPhase: false,
        showThinking: false,
        hasReasoningContent: true,
        isRegenerating: false,
        hasProgressLabel: false,
        answerStreaming: false,
        answerComplete: true,
        thinkingDurationSec: 3,
      })
    ).toBe(true);

    expect(
      shouldRenderReasoningUi({
        reasoningUiSupported: true,
        isThinkingPhase: false,
        showThinking: false,
        hasReasoningContent: false,
        isRegenerating: false,
        hasProgressLabel: false,
        answerStreaming: false,
        answerComplete: true,
        thinkingDurationSec: 3,
      })
    ).toBe(false);
  });
});
