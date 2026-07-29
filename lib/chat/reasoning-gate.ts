import type { ChatTopic } from "@/lib/chat/topic-router";

/** Show the thinking shimmer only after this brief delay (ms). */
export const THINKING_INDICATOR_DELAY_MS = 0;

/** Emit / show reasoning paragraphs only after this delay (ms). Unused when thinking-only. */
export const REASONING_PARAGRAPH_DELAY_MS = 700;

/** Show "Thought for X …" only when duration exceeds this many whole seconds. */
export const THINKING_LABEL_MIN_DURATION_SEC = 4;

/** Durations at or below this many seconds use "Thought briefly". */
export const THINKING_BRIEFLY_MAX_SEC = 2;

/** Whole seconds from elapsed milliseconds (rounded, not inflated). */
export function computeThinkingDurationSec(elapsedMs: number): number {
  return Math.max(0, Math.round(Math.max(0, elapsedMs) / 1000));
}

export function thinkingDurationSecFromTimestamp(
  timestamp: number | undefined,
  now: number = Date.now()
): number | undefined {
  if (timestamp === undefined) return undefined;
  return computeThinkingDurationSec(now - timestamp);
}

export interface ReasoningComplexityInput {
  isSimple: boolean;
  useAgentTools: boolean;
  wantsTableOutput: boolean;
  multipleSessionsSelected: boolean;
  asksDetail: boolean;
  needsList: boolean;
  topics: ChatTopic[];
}

export type ReasoningPhaseKind = "start" | "progress" | "final" | "retry";

export function buildReasoningComplexityInput(
  input: Omit<ReasoningComplexityInput, "useAgentTools">
): ReasoningComplexityInput {
  return { ...input, useAgentTools: false };
}

/** Heuristic for multi-step turns that benefit from a reasoning paragraph once slow enough. */
export function isComplexReasoningTurn(input: ReasoningComplexityInput): boolean {
  if (input.useAgentTools) return true;
  if (input.wantsTableOutput) return true;
  if (input.multipleSessionsSelected) return true;
  if (input.asksDetail) return true;
  if (input.needsList) return true;
  if (input.topics.length > 1) return true;
  if (!input.isSimple) return true;
  return false;
}

export function shouldEmitReasoningPhase(
  turnStartMs: number,
  isComplexTurn: boolean,
  phase: ReasoningPhaseKind,
  now: number = Date.now()
): boolean {
  if (phase === "retry") return true;
  if (phase === "start") return isComplexTurn;
  if (isComplexTurn) return true;
  return now - turnStartMs >= REASONING_PARAGRAPH_DELAY_MS;
}

export function shouldEmitReasoningParagraph(
  turnStartMs: number,
  now: number = Date.now()
): boolean {
  return now - turnStartMs >= REASONING_PARAGRAPH_DELAY_MS;
}

export function shouldShowThinkingIndicator(
  turnStartMs: number,
  now: number = Date.now()
): boolean {
  return now - turnStartMs >= THINKING_INDICATOR_DELAY_MS;
}

export function shouldShowThinkingDurationLabel(durationSec?: number): boolean {
  return (durationSec ?? 0) > THINKING_LABEL_MIN_DURATION_SEC;
}

/** Duration label on the thinking row (not the collapsible reasoning body). */
export function shouldShowCompletedDurationLabel(input: {
  thinkingDurationSec?: number;
  hasReasoningContent: boolean;
}): boolean {
  if (input.hasReasoningContent) return true;
  return shouldShowThinkingDurationLabel(input.thinkingDurationSec);
}

/** Completed thinking row label, e.g. "Thought briefly" or "Thought for 5 seconds". */
export function formatThoughtCompletedLabel(durationSec: number): string {
  if (durationSec <= THINKING_BRIEFLY_MAX_SEC) {
    return "Thought briefly";
  }
  if (durationSec < 60) {
    return durationSec === 1
      ? "Thought for 1 second"
      : `Thought for ${durationSec} seconds`;
  }
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  if (secs === 0) {
    return mins === 1 ? "Thought for 1 min" : `Thought for ${mins} mins`;
  }
  const minPart = mins === 1 ? "1 min" : `${mins} mins`;
  const secPart = secs === 1 ? "1 sec" : `${secs} sec`;
  return `Thought for ${minPart} ${secPart}`;
}

/** @deprecated Use formatThoughtCompletedLabel */
export function formatThinkingDurationLabel(durationSec: number): string {
  const full = formatThoughtCompletedLabel(durationSec);
  if (full === "Thought briefly") return "briefly";
  return full.replace(/^Thought for /, "");
}

export function shouldShowCompletedThinkingBlock(input: {
  thinkingDurationSec?: number;
  hasReasoningContent: boolean;
}): boolean {
  if (input.hasReasoningContent) return true;
  return shouldShowThinkingDurationLabel(input.thinkingDurationSec);
}

export function captureThinkingMetadata(
  messageTimestamp: number | undefined,
  options?: { now?: number; hasReasoning?: boolean }
): { hadThinking: boolean; thinkingDurationSec?: number } {
  const now = options?.now ?? Date.now();
  const started = messageTimestamp ?? now;
  const elapsed = now - started;
  const durationSec = computeThinkingDurationSec(elapsed);

  if (options?.hasReasoning) {
    return { hadThinking: true, thinkingDurationSec: durationSec };
  }

  const hadVisibleThinking = elapsed >= THINKING_INDICATOR_DELAY_MS;
  if (!hadVisibleThinking) {
    return { hadThinking: false };
  }

  return {
    hadThinking: true,
    thinkingDurationSec: durationSec,
  };
}

export interface RenderReasoningUiInput {
  reasoningUiSupported?: boolean;
  isMinimalTurn?: boolean;
  isThinkingPhase: boolean;
  showThinking: boolean;
  hasReasoningContent: boolean;
  isRegenerating: boolean;
  hasProgressLabel: boolean;
  answerStreaming: boolean;
  answerComplete: boolean;
  thinkingDurationSec?: number;
}

export function shouldRenderReasoningUi(input: RenderReasoningUiInput): boolean {
  if (input.reasoningUiSupported === false) return false;
  if (input.isMinimalTurn) return false;

  const showThinkingUi =
    input.isThinkingPhase && (input.showThinking || input.hasReasoningContent);
  const showLiveRegenerating = input.isRegenerating && input.hasProgressLabel;
  const showDurationLabel = shouldShowCompletedDurationLabel({
    thinkingDurationSec: input.thinkingDurationSec,
    hasReasoningContent: input.hasReasoningContent,
  });
  const showDuringAnswerStream =
    input.answerStreaming && (input.hasReasoningContent || showDurationLabel);
  const showCompletedBlock =
    input.answerComplete &&
    shouldShowCompletedThinkingBlock({
      thinkingDurationSec: input.thinkingDurationSec,
      hasReasoningContent: input.hasReasoningContent,
    });

  return (
    showThinkingUi ||
    showLiveRegenerating ||
    showDuringAnswerStream ||
    showCompletedBlock
  );
}
