import type { ChatMessage } from "@/lib/ai";
import { adaptHistoryForLanguage } from "@/lib/chat/language/history";
import { buildLanguageLockMessage } from "@/lib/chat/language/lock";
import { resolveLanguageProfile } from "@/lib/chat/language/profile";
import type { LanguageProfile } from "@/lib/chat/language/types";
import { verifyReplyLanguage } from "@/lib/chat/language/verify";

export type {
  ExplicitLanguageOverride,
  HeuristicDetectResult,
  LanguageProfile,
  LanguageVerifyResult,
  ReplyLanguage,
  UserLanguageMode,
} from "@/lib/chat/language/types";
export {
  modeToReplyLanguage,
  replyLanguageToMode,
} from "@/lib/chat/language/types";

export {
  detectExplicitLanguageOverride,
  detectHeuristicLanguage,
  detectUserLanguage,
  getLastUserMessage,
  inferStickyLanguageFromHistory,
  isShortFollowUpMessage,
} from "@/lib/chat/language/detect";

export {
  buildLanguageClassifyPrompt,
  classifyLanguageLlm,
  isChatLanguageLlmEnabled,
  parseLanguageClassifyJson,
} from "@/lib/chat/language/classify-llm";

export { resolveLanguageProfile } from "@/lib/chat/language/profile";
export { buildLanguageLockMessage, getLanguageTurnDirectiveFromProfile } from "@/lib/chat/language/lock";
export { adaptHistoryForLanguage } from "@/lib/chat/language/history";
export { verifyReplyLanguage } from "@/lib/chat/language/verify";
export {
  buildLanguageRetryNudge,
  LANGUAGE_RETRY_REASON,
} from "@/lib/chat/language/retry";

export interface ApplyLanguageToTurnResult {
  profile: LanguageProfile;
  history: ChatMessage[];
  languageLockMessage: string;
}

/**
 * Resolve profile, adapt history, and build trailing LANGUAGE LOCK message.
 * Shared by every chat model path (agent + legacy).
 */
export async function applyLanguageToTurn(options: {
  message: string;
  history?: ChatMessage[];
  modelId?: string | null;
  correlationId?: string;
  skipLlm?: boolean;
}): Promise<ApplyLanguageToTurnResult> {
  const profile = await resolveLanguageProfile(options);
  const history = adaptHistoryForLanguage(options.history, profile);
  const languageLockMessage = buildLanguageLockMessage(profile);
  return { profile, history, languageLockMessage };
}
