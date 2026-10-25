import { detectUserLanguage } from "@/lib/chat-language";
import { toolStatusLabel } from "@/lib/chat/agent/embedded-tools";
import {
  computeThinkingDurationSec,
  formatThoughtCompletedLabel,
} from "@/lib/chat/reasoning-gate";
import { inferAnswerTopic, langBucket, VALIDATION_FALLBACK } from "@/lib/chat/reasoning-status";
import {
  coalesceReasoningDisplay,
  completedTraceTitle,
  isSameTraceTopic,
  REASONING_TRACE_STEP_ID,
  THINKING_TRACE_TITLE,
  type ChatTraceStepPatch,
} from "@/lib/chat/trace-display";

const RAW_REASONING_EMIT_THROTTLE_MS = 250;

export interface TurnTraceEmitterOptions {
  userMessage: string;
  /** When false, no reasoning step is emitted (models without reasoning UI, chitchat). */
  showReasoning: boolean;
  /** Question-aligned template shown up front on complex turns; empty to wait for raw reasoning. */
  template: string;
  emitStep: (patch: ChatTraceStepPatch) => void;
  emitReasoning: (text: string) => void;
  now?: () => number;
}

export type TurnTraceEmitter = ReturnType<typeof createTurnTraceEmitter>;

/** Server-side trace state for one streamed chat turn. */
export function createTurnTraceEmitter(options: TurnTraceEmitterOptions) {
  const now = options.now ?? Date.now;
  const startedAt = now();
  let rawReasoning = "";
  let shownDetail = "";
  let lastReasoningEmitAt = 0;
  let reasoningSettled = false;
  let toolCount = 0;
  const runningTools = new Map<string, string>();

  const showDetail = (text: string) => {
    if (!text || text === shownDetail) return;
    shownDetail = text;
    options.emitReasoning(text);
  };

  const finishTools = () => {
    for (const [id, title] of runningTools) {
      options.emitStep({ id, status: "done", title: completedTraceTitle(title) });
    }
    runningTools.clear();
  };

  const settleReasoning = () => {
    if (!options.showReasoning || reasoningSettled) return;
    reasoningSettled = true;
    showDetail(coalesceReasoningDisplay(options.template, rawReasoning, options.userMessage));
    options.emitStep({
      id: REASONING_TRACE_STEP_ID,
      status: "done",
      title: formatThoughtCompletedLabel(computeThinkingDurationSec(now() - startedAt)),
    });
  };

  return {
    start() {
      if (!options.showReasoning) return;
      options.emitStep({
        id: REASONING_TRACE_STEP_ID,
        kind: "reasoning",
        title: THINKING_TRACE_TITLE,
        status: "running",
      });
      showDetail(options.template);
    },
    onReasoningToken(token: string) {
      if (!options.showReasoning || reasoningSettled) return;
      rawReasoning += token;
      const t = now();
      if (t - lastReasoningEmitAt < RAW_REASONING_EMIT_THROTTLE_MS) return;
      lastReasoningEmitAt = t;
      showDetail(coalesceReasoningDisplay(options.template, rawReasoning, options.userMessage));
    },
    onToolCall(toolName: string) {
      const id = `tool-${++toolCount}`;
      const title = toolStatusLabel(toolName);
      runningTools.set(id, title);
      options.emitStep({ id, kind: "tool", title, status: "running" });
    },
    onSynthesis: finishTools,
    onAnswerToken() {
      finishTools();
      settleReasoning();
    },
    /** Settle steps and swap shown reasoning for a neutral line if it drifted from the reply. */
    finish(reply: string) {
      finishTools();
      settleReasoning();
      if (!shownDetail) return;
      const replyTopic = inferAnswerTopic(reply, options.userMessage);
      const shownTopic = inferAnswerTopic(shownDetail, options.userMessage);
      if (!isSameTraceTopic(shownTopic, replyTopic)) {
        showDetail(VALIDATION_FALLBACK[langBucket(detectUserLanguage(options.userMessage))]);
      }
    },
  };
}
