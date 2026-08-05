import { TABLE_OUTPUT_RULE } from "@/lib/chat/intent";
import type { ChatTopic } from "@/lib/chat/topic-router";
import {
  CHAT_ANSWER_MODE_POLICY,
  CHAT_CONTEXT_SUFFICIENCY_POLICY,
  CHAT_GRACEFUL_FALLBACK_POLICY,
  CHAT_RESPONSE_FORMAT_RULES,
} from "@/lib/chat/response-format";

const CHATBOT_IDENTITY = `You are "Bila UiTM Cuti?" — a chatbot for UiTM students.

You can help with:
1) UiTM academic calendar — registration, lectures/classes, exams, breaks, fees, GT/RPGT, and other schedule rows (dates come from API activity lines below).
2) Malaysia public holidays — nationwide or by state/territory (from MALAYSIA PUBLIC HOLIDAYS block when provided).
3) Lecture weeks — week numbers and Week 1..N date ranges (from LECTURE WEEKS blocks only — not from Kuliah activity rows).
4) General UiTM information — campuses, faculties, courses, admissions, student life (from UITM KNOWLEDGE when provided).

Answer only what the user asked. Use the DATA CONTEXT blocks below as the source of truth for dates and facts. Do not invent dates. Session label months (e.g. Mar–Aug) are nicknames only — events may start before or end after those months; copy dates from activity lines.`;

const DATA_POLICY = `DATA RULES (short):
- Academic event dates → primary calendar / matched activity lines only.
- Lecture week numbers and ranges → lecture-week blocks only.
- Cuti umum / public holidays → public-holiday block only (not UiTM Cuti Semester unless they ask UiTM schedule).
- IMPORTANT TERM SPLIT: "cuti/holiday/break" can mean two different things. UiTM break terms (e.g. Cuti Semester, Cuti Pertengahan Semester, study/revision week) are academic calendar rows, not public holidays. Public holidays are only national/state holidays in the public-holiday data.
- Same activity name may exist for Group A and Group B with different dates — state group/session when both appear.
- If a matched activity row is listed for this turn, that row is authoritative for the user's question.
- Never invent dates. When retrieved data is missing or partial, answer directly with helpful UiTM student guidance and mark uncertainty — do not hard-refuse. For explain/opinion/hard/general questions, prefer a useful answer over silence.
- Never echo internal section banners, tool names, or API field names in the reply — only activity names and dates in plain language.`;

export interface BuildChatPromptParams {
  programLabel: string;
  primaryGroup: string;
  secondaryGroup: string;
  todayFormatted: string;
  sessionListContext: string;
  primaryContext: string;
  secondaryContext: string;
  dataContext: string;
  topics: ChatTopic[];
  selectedSessionCount: number;
  forceTableOutput?: boolean;
  multipleSessionsSelected?: boolean;
  uitmSupplement?: string;
  includeSecondaryContext?: boolean;
  maxPrimaryChars?: number;
}

export function buildChatAssistantSystemPrompt(params: BuildChatPromptParams): string {
  const {
    programLabel,
    primaryGroup,
    secondaryGroup,
    todayFormatted,
    sessionListContext,
    primaryContext,
    secondaryContext,
    dataContext,
    topics,
    selectedSessionCount,
    forceTableOutput,
    multipleSessionsSelected,
    uitmSupplement,
    includeSecondaryContext = false,
    maxPrimaryChars = 4500,
  } = params;

  const primaryCap = maxPrimaryChars;
  const truncatedPrimary =
    primaryContext.length > primaryCap
      ? primaryContext.slice(0, primaryCap) + "\n...[truncated]"
      : primaryContext;

  const secondaryForPrompt = includeSecondaryContext ? secondaryContext : "";
  const truncatedSecondary =
    secondaryForPrompt.length > 800
      ? secondaryForPrompt.slice(0, 800) + "\n...[truncated]"
      : secondaryForPrompt;

  const topicLine = `This turn topics: ${topics.join(", ")}.`;

  let result = [
    CHATBOT_IDENTITY,
    DATA_POLICY,
    CHAT_ANSWER_MODE_POLICY,
    CHAT_CONTEXT_SUFFICIENCY_POLICY,
    CHAT_GRACEFUL_FALLBACK_POLICY,
    CHAT_RESPONSE_FORMAT_RULES,
    topicLine,
    `Program: ${programLabel} (GROUP ${primaryGroup}). Default to GROUP ${primaryGroup} unless the user asks about Group ${secondaryGroup}.`,
    `TODAY (Malaysia, UTC+8): ${todayFormatted}`,
    "CONTEXT AWARENESS: Programme, session, and group are pre-selected. Do not re-ask them when clear and consistent; ask one clarifying question only if missing, ambiguous, or conflicting per CONTEXT SUFFICIENCY.",
    "",
    "=== DATA CONTEXT (API-backed for this turn) ===",
    dataContext || "(no supplemental blocks)",
  ].join("\n");

  if (topics.includes("academic_calendar")) {
    result += `\n\n=== SESSION LIST (GROUP ${primaryGroup}) ===\n${sessionListContext}`;
    result += `\n\n=== SELECTED SESSIONS ===\nCount: ${selectedSessionCount}. Rows marked (selected) in the session list are the user's choice.`;
    result += `\n\n=== GROUP ${primaryGroup} ACADEMIC CALENDAR (API) ===\n${truncatedPrimary}`;
    if (truncatedSecondary) {
      result += `\n\n=== GROUP ${secondaryGroup} (reference only) ===\n${truncatedSecondary}`;
    }
  }

  if (uitmSupplement && topics.includes("uitm_general")) {
    const cap = 3000;
    const uitm =
      uitmSupplement.length > cap
        ? uitmSupplement.slice(0, cap) + "\n...[truncated]"
        : uitmSupplement;
    result += `\n\n=== UITM KNOWLEDGE (supplement) ===\n${uitm}`;
  }

  if (multipleSessionsSelected) {
    result +=
      "\n\nFor multiple selected sessions, label every date with session id + label.";
  }
  if (forceTableOutput) {
    result += TABLE_OUTPUT_RULE;
  }

  return result;
}

export function usesResearchStylePrompt(topics: ChatTopic[]): boolean {
  return (
    !topics.includes("academic_calendar") &&
    !topics.includes("lecture_weeks") &&
    !topics.includes("public_holiday") &&
    topics.includes("uitm_general")
  );
}
