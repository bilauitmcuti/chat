import { askWorkersAi } from "@/lib/ai";
import { detectUserLanguage } from "@/lib/chat-language";
import {
  clampWords,
  hasForbiddenStatusTerms,
  isValidProgressSummary,
  langBucket,
  resolveReasoningIntent,
  resolveReasoningSource,
  resolveReasoningTopic,
  type ReasoningStatus,
  type ReasoningStatusInput,
} from "@/lib/chat/reasoning-status";

export type ReasoningLlmPhase = "pre_answer" | "post_answer";

export interface GenerateReasoningLlmInput extends ReasoningStatusInput {
  phase: ReasoningLlmPhase;
  finalAnswer?: string;
  requestHost?: string | null;
  correlationId?: string;
  /** Override for tests. */
  askAi?: typeof askWorkersAi;
  /** Override timeout ms (default 3500). */
  timeoutMs?: number;
}

const REASONING_LLM_MAX_TOKENS = 220;
const REASONING_LLM_TEMPERATURE = 0.15;
const REASONING_LLM_TIMEOUT_MS = 3500;

/** Set CHAT_REASONING_LLM=1 or true to enable LLM reasoning status (off by default). */
export function isChatReasoningLlmEnabled(): boolean {
  const raw = process.env.CHAT_REASONING_LLM?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return false;
}

export function buildReasoningLlmPrompt(input: GenerateReasoningLlmInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const lang = langBucket(detectUserLanguage(input.message));
  const hintIntent = resolveReasoningIntent(input);
  const hintTopic = resolveReasoningTopic(hintIntent, input);
  const hintSource = resolveReasoningSource(hintIntent, input.topics);
  const activity =
    input.activityMatches?.[0]?.activity.name?.trim() || "(none)";

  const systemPrompt = [
    "You write a short user-facing progress status for a UiTM academic calendar chat assistant.",
    "Return ONE JSON object only — no markdown fences, no commentary.",
    "Schema:",
    '{"intent":"snake_case_label","topic":"short english topic","source":"short english source","progress_summary":"one paragraph"}',
    "Rules for progress_summary:",
    "- One short paragraph only (no bullets).",
    "- Between 18 and 64 words.",
    "- Must match the user question and stay on the same topic as the eventual answer.",
    "- Use varied wording; do not always start with Checking.",
    "- Do not mention APIs, tools, RAG, embeddings, function calls, databases, prompts, or internal reasoning.",
    "- Do not mention unrelated calendar events.",
    `- Write progress_summary in ${lang === "malay" ? "Bahasa Melayu (Malaysia)" : "English"}.`,
    "intent, topic, and source must be short English labels for internal validation.",
  ].join("\n");

  const userParts = [
    `Phase: ${input.phase}`,
    `User question: ${input.message}`,
    `Routed topics: ${input.topics.join(", ") || "none"}`,
    `Calendar context intent: ${input.contextIntent ?? "all"}`,
    `Programme: ${input.programLabel}`,
    `Selected sessions: ${input.sessionCount}`,
    `Matched activity: ${activity}`,
    `Hint intent: ${hintIntent}`,
    `Hint topic: ${hintTopic}`,
    `Hint source: ${hintSource}`,
  ];
  if (input.phase === "post_answer" && input.finalAnswer?.trim()) {
    userParts.push(`Final answer (for topic alignment):\n${input.finalAnswer.trim().slice(0, 1200)}`);
  }
  userParts.push("Respond with the JSON object now.");

  return { systemPrompt, userPrompt: userParts.join("\n") };
}

export function parseReasoningLlmJson(raw: string): Partial<ReasoningStatus> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidate = fence[1].trim();

  const braceStart = candidate.indexOf("{");
  const braceEnd = candidate.lastIndexOf("}");
  if (braceStart < 0 || braceEnd <= braceStart) return null;
  candidate = candidate.slice(braceStart, braceEnd + 1);

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      intent: typeof parsed.intent === "string" ? parsed.intent.trim() : undefined,
      topic: typeof parsed.topic === "string" ? parsed.topic.trim() : undefined,
      source: typeof parsed.source === "string" ? parsed.source.trim() : undefined,
      progress_summary:
        typeof parsed.progress_summary === "string"
          ? parsed.progress_summary.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

export function sanitizeLlmReasoningStatus(
  raw: Partial<ReasoningStatus> | null,
  input: ReasoningStatusInput
): ReasoningStatus | null {
  if (!raw?.progress_summary) return null;

  // Reject multi-paragraph / multi-line before collapsing whitespace.
  if (/[\r\n]/.test(raw.progress_summary)) return null;

  let summary = raw.progress_summary.replace(/\s+/g, " ").trim();
  if (!summary) return null;
  if (hasForbiddenStatusTerms(summary)) return null;

  summary = clampWords(summary);
  if (!isValidProgressSummary(summary)) return null;

  const fallbackIntent = resolveReasoningIntent(input);
  const intent = raw.intent?.trim() || fallbackIntent;
  const topic = raw.topic?.trim() || resolveReasoningTopic(fallbackIntent, input);
  const source = raw.source?.trim() || resolveReasoningSource(fallbackIntent, input.topics);

  return {
    intent,
    topic,
    source,
    progress_summary: summary,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Reasoning LLM timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Generate free-form ReasoningStatus via Workers AI.
 * Returns null on disable, timeout, parse failure, or guardrail rejection.
 */
export async function generateReasoningStatusLlm(
  input: GenerateReasoningLlmInput
): Promise<ReasoningStatus | null> {
  if (!isChatReasoningLlmEnabled()) return null;

  const { systemPrompt, userPrompt } = buildReasoningLlmPrompt(input);
  const askAi = input.askAi ?? askWorkersAi;
  const timeoutMs = input.timeoutMs ?? REASONING_LLM_TIMEOUT_MS;

  try {
    const raw = await withTimeout(
      askAi(userPrompt, systemPrompt, undefined, {
        maxTokens: REASONING_LLM_MAX_TOKENS,
        temperature: REASONING_LLM_TEMPERATURE,
        requestHost: input.requestHost,
        correlationId: input.correlationId,
      }),
      timeoutMs
    );
    return sanitizeLlmReasoningStatus(parseReasoningLlmJson(raw), input);
  } catch {
    return null;
  }
}
