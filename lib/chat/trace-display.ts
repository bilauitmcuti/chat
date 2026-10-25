import { classifyTopicFromText, hasForbiddenStatusTerms } from "@/lib/chat/reasoning-status";
import { stripInternalContextLeakage } from "@/lib/chat/sanitize";

export type ChatTraceStepKind = "reasoning" | "tool" | "retry";
export type ChatTraceStepStatus = "running" | "pending" | "error" | "done";

export interface ChatTraceStep {
  id: string;
  kind: ChatTraceStepKind;
  title: string;
  detail?: string;
  status: ChatTraceStepStatus;
}

export type ChatTraceStepPatch = Partial<ChatTraceStep> & { id: string };

export const REASONING_TRACE_STEP_ID = "reasoning";
export const THINKING_TRACE_TITLE = "Thinking…";

const MAX_RAW_REASONING_CHARS = 700;
const MIN_RAW_REASONING_WORDS = 6;

/** Internal wiring a model may narrate in its reasoning that users must never see. */
const RAW_REASONING_PRIVATE_TERMS =
  /\b(system (message|instructions?)|instructions?|guidelines?|rules?|tool|function|json|context|block|schema|rows?|this turn|we have data|(given|provided) data|data provided)\b/i;

const JSON_LIKE_LINE = /^\s*[[{].*"\w+"\s*:/;

function isPrivateSentence(sentence: string): boolean {
  return hasForbiddenStatusTerms(sentence) || RAW_REASONING_PRIVATE_TERMS.test(sentence);
}

function capAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

/**
 * Raw model reasoning reduced to sentences safe to show: internal labels, tool ids,
 * JSON and any sentence mentioning prompts/tools/APIs are dropped. Null when too
 * little survives.
 */
export function sanitizeRawReasoningForDisplay(raw: string): string | null {
  const withoutJson = raw
    .split("\n")
    .filter((line) => !JSON_LIKE_LINE.test(line))
    .join("\n");
  const flattened = stripInternalContextLeakage(withoutJson).replace(/\s+/g, " ").trim();
  if (!flattened) return null;

  const kept = flattened
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() && !isPrivateSentence(sentence))
    .join(" ")
    .trim();

  if (kept.split(/\s+/).filter(Boolean).length < MIN_RAW_REASONING_WORDS) return null;
  return capAtWordBoundary(kept, MAX_RAW_REASONING_CHARS);
}

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 3)
  );
}

const GENERIC_CALENDAR_TOPIC = "academic calendar information";

/**
 * Stricter than `topicsMatch` (which accepts any shared word such as "dates"):
 * same topic category, or one side is the generic calendar bucket.
 */
export function isSameTraceTopic(a: string, b: string): boolean {
  if (a === GENERIC_CALENDAR_TOPIC || b === GENERIC_CALENDAR_TOPIC) return true;
  return a === b;
}

/** Reasoning must stay on the user's question: same calendar topic, or shared keywords. */
export function isRawReasoningAlignedWithQuestion(text: string, userMessage: string): boolean {
  const questionTopic = classifyTopicFromText(userMessage);
  const reasoningTopic = classifyTopicFromText(text);
  if (questionTopic && reasoningTopic) return isSameTraceTopic(reasoningTopic, questionTopic);

  const reasoningWords = significantWords(text);
  return [...significantWords(userMessage)].some((word) => reasoningWords.has(word));
}

/** Hybrid display: sanitized raw reasoning when safe and on-topic, otherwise the template. */
export function coalesceReasoningDisplay(
  template: string,
  rawAccumulated: string,
  userMessage: string
): string {
  const cleaned = sanitizeRawReasoningForDisplay(rawAccumulated);
  if (cleaned && isRawReasoningAlignedWithQuestion(cleaned, userMessage)) return cleaned;
  return template;
}

export function upsertTraceStep(
  steps: readonly ChatTraceStep[],
  patch: ChatTraceStepPatch
): ChatTraceStep[] {
  const index = steps.findIndex((step) => step.id === patch.id);
  if (index === -1) {
    if (!patch.kind || patch.title === undefined) return [...steps];
    return [...steps, { status: "running", ...patch } as ChatTraceStep];
  }
  return steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
}

/** Drop the trailing ellipsis from in-progress labels ("Reading public holidays…"). */
export function completedTraceTitle(title: string): string {
  return title.replace(/…$/, "");
}

/** Settle every unfinished step (stream done or failed). */
export function finishTraceSteps(
  steps: readonly ChatTraceStep[],
  status: "done" | "error" = "done"
): ChatTraceStep[] {
  return steps.map((step) =>
    step.status === "running" || step.status === "pending"
      ? {
          ...step,
          status,
          title: status === "done" ? completedTraceTitle(step.title) : step.title,
        }
      : step
  );
}
