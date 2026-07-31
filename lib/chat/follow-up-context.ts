import type { ChatMessage } from "@/lib/ai";
import { isMinimalConversationalMessage } from "@/lib/chat/intent";
import { resolveStateSlugsFromMessage } from "@/lib/chat/public-holiday-context";
import {
  messageAsksAcademicCalendar,
  messageAsksDayStatus,
  messageAsksLectureWeeks,
  messageAsksPublicHoliday,
  messageAsksUitmGeneral,
  routeChatTopics,
  type ChatTopic,
} from "@/lib/chat/topic-router";

const YES_NO_RE =
  /^(ya|yes|yep|yup|ok|okay|baik|boleh|sure|no|tidak|tak|nope|nah)\b[.!]?\s*$/i;

const YEAR_ONLY_RE = /^\s*(20\d{2})\s*$/;

const SESSION_ID_RE = /\b[AB]-\d{4,5}\b/i;

const WEEK_TOKEN_RE = /\b(?:minggu|week)\s*\d{1,2}\b/i;

const ASSISTANT_CLARIFY_RE =
  /\b(negeri|state|tahun|year|sesi|session|kumpulan|group|program|which\s+state|negeri\s+mana|tahun\s+berapa)\b/i;

export interface FollowUpTurnResult {
  isClarifyingFollowUp: boolean;
  carriedTopics: ChatTopic[];
  /** Text for intent / prefetch / tools: prior substantive user + current. */
  effectiveQuery: string;
  /** When true, do not treat the turn as minimal chitchat. */
  suppressMinimalTurn: boolean;
}

function findPriorSubstantiveUser(
  history: ChatMessage[]
): { content: string; topics: ChatTopic[] } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (!msg || msg.role !== "user") continue;
    const content = msg.content.trim();
    if (!content) continue;
    if (isMinimalConversationalMessage(content)) continue;
    const route = routeChatTopics(content, false, { isMinimalTurn: false });
    if (route.topics.length === 0) continue;
    return { content, topics: route.topics };
  }
  return null;
}

function lastAssistantLooksLikeClarification(history: ChatMessage[]): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (!msg || msg.role !== "assistant") continue;
    return ASSISTANT_CLARIFY_RE.test(msg.content);
  }
  return false;
}

function looksLikeClarifyingReply(
  message: string,
  history: ChatMessage[]
): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;

  if (resolveStateSlugsFromMessage(trimmed).length > 0) return true;
  if (YEAR_ONLY_RE.test(trimmed)) return true;
  if (SESSION_ID_RE.test(trimmed)) return true;
  if (WEEK_TOKEN_RE.test(trimmed)) return true;

  if (YES_NO_RE.test(trimmed) && lastAssistantLooksLikeClarification(history)) {
    return true;
  }

  return false;
}

/**
 * Merge carried history topics with explicit signals on the current message,
 * without applying the router's default academic_calendar fallback.
 */
export function mergeFollowUpTopics(
  carriedTopics: ChatTopic[],
  message: string,
  hasNamedActivity: boolean
): ChatTopic[] {
  const topics = new Set<ChatTopic>(carriedTopics);

  if (messageAsksPublicHoliday(message)) topics.add("public_holiday");
  if (messageAsksLectureWeeks(message)) topics.add("lecture_weeks");
  if (messageAsksUitmGeneral(message)) topics.add("uitm_general");
  if (
    hasNamedActivity ||
    messageAsksDayStatus(message) ||
    messageAsksAcademicCalendar(message)
  ) {
    topics.add("academic_calendar");
  }

  return [...topics];
}

/**
 * History-aware follow-up: short replies (state, year, session, week, yes/no)
 * keep prior topic tools/prefetch instead of collapsing to chitchat.
 */
export function resolveFollowUpTurn(params: {
  message: string;
  history: ChatMessage[];
}): FollowUpTurnResult {
  const message = params.message.trim();
  const history = params.history ?? [];
  const prior = findPriorSubstantiveUser(history);
  const isClarifying =
    Boolean(prior) && looksLikeClarifyingReply(message, history);

  if (!isClarifying || !prior) {
    return {
      isClarifyingFollowUp: false,
      carriedTopics: [],
      effectiveQuery: message,
      suppressMinimalTurn: false,
    };
  }

  return {
    isClarifyingFollowUp: true,
    carriedTopics: prior.topics,
    effectiveQuery: `${prior.content} ${message}`.trim(),
    suppressMinimalTurn: true,
  };
}
