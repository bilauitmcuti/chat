/**
 * Compatibility re-exports for the language-control pipeline.
 * Prefer `@/lib/chat/language` for new code.
 */
import type { ChatMessage } from "@/lib/ai";
import {
  detectHeuristicLanguage,
  detectUserLanguage,
  getLastUserMessage,
  inferStickyLanguageFromHistory,
} from "@/lib/chat/language/detect";
import { getLanguageTurnDirectiveFromProfile } from "@/lib/chat/language/lock";
import type { LanguageProfile, UserLanguageMode } from "@/lib/chat/language/types";

export type { UserLanguageMode } from "@/lib/chat/language/types";
export { detectUserLanguage } from "@/lib/chat/language/detect";

/**
 * Legacy sync helper: heuristic + sticky LANGUAGE LOCK text.
 * Prefer `applyLanguageToTurn` (async, trailing user message) on the chat path.
 */
export function getLanguageTurnDirective(
  message: string,
  history?: ChatMessage[]
): string {
  const primary = message.trim() || getLastUserMessage(history);
  if (!primary && !history?.length) return "";

  const heuristic = detectHeuristicLanguage(primary || "");
  const sticky = inferStickyLanguageFromHistory(history);

  let replyLanguage = heuristic.replyLanguage;
  let stickyFromHistory = false;
  if (heuristic.explicitOverride) {
    replyLanguage = heuristic.explicitOverride;
  } else if ((heuristic.isShortFollowUp || !primary) && sticky) {
    replyLanguage = sticky;
    stickyFromHistory = true;
  } else if (heuristic.isAmbiguous && sticky && heuristic.confidence < 0.85) {
    replyLanguage = sticky;
    stickyFromHistory = true;
  }

  const profile: LanguageProfile = {
    replyLanguage,
    locale: replyLanguage === "en" ? "en" : "ms-MY",
    codeSwitch: replyLanguage === "mixed",
    confidence: heuristic.confidence,
    stickyFromHistory,
    explicitOverride: heuristic.explicitOverride,
    usedLlmClassify: false,
  };

  return getLanguageTurnDirectiveFromProfile(profile);
}
