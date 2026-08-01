import { askWorkersAi } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai";
import type { HeuristicDetectResult, ReplyLanguage } from "@/lib/chat/language/types";

const CLASSIFY_MAX_TOKENS = 120;
const CLASSIFY_TEMPERATURE = 0.1;
const CLASSIFY_TIMEOUT_MS = 2500;

/** Set CHAT_LANGUAGE_LLM=1 to enable soft-JSON classify when heuristic confidence is low. */
export function isChatLanguageLlmEnabled(): boolean {
  const raw = process.env.CHAT_LANGUAGE_LLM?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return false;
}

export interface LanguageClassifyResult {
  replyLanguage: ReplyLanguage;
  locale: "en" | "ms-MY";
  codeSwitch: boolean;
  confidence: number;
}

export interface ClassifyLanguageInput {
  message: string;
  history?: ChatMessage[];
  heuristic: HeuristicDetectResult;
  modelId?: string | null;
  correlationId?: string;
  askAi?: typeof askWorkersAi;
  timeoutMs?: number;
}

export function buildLanguageClassifyPrompt(input: ClassifyLanguageInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const recent = (input.history ?? [])
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");

  const systemPrompt = [
    "You classify the reply language for a UiTM student calendar chatbot.",
    "Return ONE JSON object only — no markdown fences, no commentary.",
    "Schema:",
    '{"reply_language":"en"|"ms-MY"|"mixed","locale":"en"|"ms-MY","code_switch":boolean,"confidence":number}',
    "Rules:",
    "- Prioritize the latest user message.",
    "- English questions with Malay loanwords (cuti, sesi, semester) → en.",
    "- Malaysian Malay → ms-MY. Never choose Indonesian as locale; use ms-MY.",
    "- Natural Malay-English blend → mixed with code_switch true.",
    "- Short follow-ups (Next, Why, Okay) may inherit prior conversation language.",
    "- confidence is 0 to 1.",
  ].join("\n");

  const userPrompt = [
    `Latest user message: ${input.message}`,
    `Heuristic guess: ${input.heuristic.replyLanguage} (confidence ${input.heuristic.confidence})`,
    `Short follow-up: ${input.heuristic.isShortFollowUp}`,
    recent ? `Recent turns:\n${recent}` : "Recent turns: (none)",
    "Respond with the JSON object now.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export function parseLanguageClassifyJson(raw: string): LanguageClassifyResult | null {
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
    const langRaw = String(parsed.reply_language ?? "").trim();
    let replyLanguage: ReplyLanguage | null = null;
    if (langRaw === "en" || langRaw === "english") replyLanguage = "en";
    else if (langRaw === "ms-MY" || langRaw === "ms" || langRaw === "malay" || langRaw === "bm")
      replyLanguage = "ms-MY";
    else if (langRaw === "mixed") replyLanguage = "mixed";
    if (!replyLanguage) return null;

    const localeRaw = String(parsed.locale ?? "").trim();
    const locale: "en" | "ms-MY" =
      localeRaw === "en" || replyLanguage === "en" ? "en" : "ms-MY";
    if (replyLanguage === "ms-MY" || replyLanguage === "mixed") {
      // Force Malaysian locale even if model said something else.
    }

    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.7;

    return {
      replyLanguage,
      locale: replyLanguage === "en" ? "en" : "ms-MY",
      codeSwitch:
        typeof parsed.code_switch === "boolean"
          ? parsed.code_switch
          : replyLanguage === "mixed",
      confidence,
    };
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Language classify timeout")), ms);
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
 * Soft-JSON language classify (Workers AI prompting — not streaming JSON Mode).
 * Returns null on disable, timeout, or parse failure.
 */
export async function classifyLanguageLlm(
  input: ClassifyLanguageInput
): Promise<LanguageClassifyResult | null> {
  if (!isChatLanguageLlmEnabled()) return null;

  const { systemPrompt, userPrompt } = buildLanguageClassifyPrompt(input);
  const askAi = input.askAi ?? askWorkersAi;
  const timeoutMs = input.timeoutMs ?? CLASSIFY_TIMEOUT_MS;

  try {
    const raw = await withTimeout(
      askAi(userPrompt, systemPrompt, undefined, {
        maxTokens: CLASSIFY_MAX_TOKENS,
        temperature: CLASSIFY_TEMPERATURE,
        modelId: input.modelId,
        correlationId: input.correlationId,
      }),
      timeoutMs
    );
    return parseLanguageClassifyJson(raw);
  } catch {
    return null;
  }
}
