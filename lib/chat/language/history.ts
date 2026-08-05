import type { ChatMessage } from "@/lib/ai";
import { detectHeuristicLanguage } from "@/lib/chat/language/detect";
import type { LanguageProfile } from "@/lib/chat/language/types";

/**
 * Adapt history so prior assistant language does not pull the model away from
 * the current LANGUAGE LOCK (especially BM → English switches).
 */
export function adaptHistoryForLanguage(
  history: ChatMessage[] | undefined,
  profile: LanguageProfile
): ChatMessage[] {
  if (!history?.length) return [];

  const adapted = history.map((msg) => ({ ...msg }));

  if (profile.replyLanguage !== "en" && profile.explicitOverride !== "en") {
    return adapted;
  }

  // When targeting English, soften strongly-Malay assistant turns so they do not dominate.
  return adapted.map((msg) => {
    if (msg.role !== "assistant") return msg;
    const sample = msg.content.slice(0, 500);
    const h = detectHeuristicLanguage(sample);
    if (h.replyLanguage !== "ms-MY" && h.replyLanguage !== "mixed") return msg;

    const note =
      "[Prior assistant reply was in Malay; for this turn answer in English per LANGUAGE LOCK.]\n";
    const trimmed =
      msg.content.length > 1200 ? msg.content.slice(0, 1200) + "\n...[truncated]" : msg.content;
    return { role: "assistant" as const, content: note + trimmed };
  });
}
