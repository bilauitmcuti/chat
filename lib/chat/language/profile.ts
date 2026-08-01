import type { ChatMessage } from "@/lib/ai";
import { classifyLanguageLlm } from "@/lib/chat/language/classify-llm";
import {
  detectHeuristicLanguage,
  HIGH_CONFIDENCE,
  inferStickyLanguageFromHistory,
  MED_CONFIDENCE,
} from "@/lib/chat/language/detect";
import type { LanguageProfile, ReplyLanguage } from "@/lib/chat/language/types";

export interface ResolveLanguageProfileOptions {
  message: string;
  history?: ChatMessage[];
  modelId?: string | null;
  correlationId?: string;
  /** Skip LLM classify (tests / offline). */
  skipLlm?: boolean;
  classifyLlm?: typeof classifyLanguageLlm;
}

function localeFor(lang: ReplyLanguage): "en" | "ms-MY" {
  return lang === "en" ? "en" : "ms-MY";
}

function needsLlmClassify(heuristic: ReturnType<typeof detectHeuristicLanguage>): boolean {
  if (heuristic.explicitOverride) return false;
  if (heuristic.confidence >= HIGH_CONFIDENCE && !heuristic.isAmbiguous) return false;
  if (heuristic.isShortFollowUp) return true;
  if (heuristic.confidence < MED_CONFIDENCE) return true;
  if (heuristic.isAmbiguous) return true;
  return false;
}

/**
 * Resolve turn language profile: latest message > explicit override > sticky
 * history for short/low-confidence turns > soft-JSON classify when needed.
 */
export async function resolveLanguageProfile(
  options: ResolveLanguageProfileOptions
): Promise<LanguageProfile> {
  const { message, history } = options;
  const heuristic = detectHeuristicLanguage(message.trim());
  const sticky = inferStickyLanguageFromHistory(history);

  if (heuristic.explicitOverride) {
    return {
      replyLanguage: heuristic.explicitOverride,
      locale: localeFor(heuristic.explicitOverride),
      codeSwitch: heuristic.explicitOverride === "mixed",
      confidence: heuristic.confidence,
      stickyFromHistory: false,
      explicitOverride: heuristic.explicitOverride,
      usedLlmClassify: false,
    };
  }

  // Short follow-up / empty: prefer sticky conversation language.
  if ((heuristic.isShortFollowUp || !message.trim()) && sticky) {
    return {
      replyLanguage: sticky,
      locale: localeFor(sticky),
      codeSwitch: sticky === "mixed",
      confidence: Math.max(heuristic.confidence, MED_CONFIDENCE),
      stickyFromHistory: true,
      explicitOverride: null,
      usedLlmClassify: false,
    };
  }

  if (!needsLlmClassify(heuristic) || options.skipLlm) {
    // Ambiguous with sticky available: stick rather than flip.
    if (heuristic.isAmbiguous && sticky && heuristic.confidence < HIGH_CONFIDENCE) {
      return {
        replyLanguage: sticky,
        locale: localeFor(sticky),
        codeSwitch: sticky === "mixed",
        confidence: heuristic.confidence,
        stickyFromHistory: true,
        explicitOverride: null,
        usedLlmClassify: false,
      };
    }
    return {
      replyLanguage: heuristic.replyLanguage,
      locale: localeFor(heuristic.replyLanguage),
      codeSwitch: heuristic.codeSwitch || heuristic.replyLanguage === "mixed",
      confidence: heuristic.confidence,
      stickyFromHistory: false,
      explicitOverride: null,
      usedLlmClassify: false,
    };
  }

  const classify = options.classifyLlm ?? classifyLanguageLlm;
  const llm = await classify({
    message: message.trim() || "(empty)",
    history,
    heuristic,
    modelId: options.modelId,
    correlationId: options.correlationId,
  });

  if (llm) {
    return {
      replyLanguage: llm.replyLanguage,
      locale: llm.locale === "en" && llm.replyLanguage === "en" ? "en" : "ms-MY",
      codeSwitch: llm.codeSwitch || llm.replyLanguage === "mixed",
      confidence: llm.confidence,
      stickyFromHistory: false,
      explicitOverride: null,
      usedLlmClassify: true,
    };
  }

  if (sticky && (heuristic.isShortFollowUp || heuristic.isAmbiguous)) {
    return {
      replyLanguage: sticky,
      locale: localeFor(sticky),
      codeSwitch: sticky === "mixed",
      confidence: heuristic.confidence,
      stickyFromHistory: true,
      explicitOverride: null,
      usedLlmClassify: false,
    };
  }

  return {
    replyLanguage: heuristic.replyLanguage,
    locale: localeFor(heuristic.replyLanguage),
    codeSwitch: heuristic.codeSwitch || heuristic.replyLanguage === "mixed",
    confidence: heuristic.confidence,
    stickyFromHistory: false,
    explicitOverride: null,
    usedLlmClassify: false,
  };
}
