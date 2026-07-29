import type { MatchedActivity } from "@/lib/chat/activity-match";
import type { ChatToolName } from "@/lib/chat/agent/types";
import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import { detectUserLanguage, type UserLanguageMode } from "@/lib/chat-language";
import type { ChatTopic } from "@/lib/chat/topic-router";

export const MIN_REASONING_WORDS = 18;
export const MAX_REASONING_WORDS = 64;

export const FORBIDDEN_STATUS_TERMS =
  /\b(function[\s-]?calling|function calls?|tool calls?|\btools\b|\brag\b|embeddings?|vector search|loading data|internal apis?|\bapi\b|\bapis\b|databases?|composing answer|chain of thought|reasoning process|prefetch|\bprompts?\b)\b/i;

export type ReasoningPhase = "start" | "progress" | "final" | "retry";
export type ReasoningPhaseHint = "pre_answer" | "tool_progress" | "retry";
export type LangBucket = "en" | "malay";

/** Internal intent keys used for template fallback and LLM hints. */
export type ReasoningIntent =
  | "semester_start"
  | "short_semester"
  | "lecture_weeks"
  | "lecture_week_list"
  | "semester_break"
  | "exam_dates"
  | "public_holiday"
  | "registration"
  | "student_fees"
  | "uitm_general"
  | "matched_activity"
  | "multi_session"
  | "general_info"
  | "retry";

export interface ReasoningStatus {
  intent: string;
  topic: string;
  source: string;
  progress_summary: string;
}

export interface ReasoningStatusInput {
  message: string;
  topics: ChatTopic[];
  programLabel: string;
  sessionCount: number;
  hasMatchedActivity: boolean;
  activityMatches?: MatchedActivity[];
  contextIntent?: CalendarContextIntent;
  needsList?: boolean;
  phaseHint?: ReasoningPhaseHint;
  toolName?: ChatToolName;
  retryReason?: "dates" | "incomplete";
}

export interface ReasoningValidationResult {
  status: ReasoningStatus;
  /** True when status.topic does not match the final answer topic — handler should refine via LLM. */
  needsLlmRefine: boolean;
}

export function langBucket(mode: UserLanguageMode): LangBucket {
  return mode === "malay" ? "malay" : "en";
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickProgressPhrase(pool: readonly string[], seed: string): string {
  if (pool.length === 0) return "";
  if (pool.length === 1) return pool[0]!;
  return pool[hashSeed(seed) % pool.length]!;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

export function clampWords(
  text: string,
  min = MIN_REASONING_WORDS,
  max = MAX_REASONING_WORDS
): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= max && words.length >= min) return cleaned;
  if (words.length > max) {
    const trimmed = words.slice(0, max).join(" ");
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }
  return cleaned;
}

export function hasForbiddenStatusTerms(text: string): boolean {
  return FORBIDDEN_STATUS_TERMS.test(text);
}

export function isValidProgressSummary(text: string): boolean {
  const words = wordCount(text);
  return (
    words >= MIN_REASONING_WORDS &&
    words <= MAX_REASONING_WORDS &&
    !hasForbiddenStatusTerms(text) &&
    !text.includes("\n")
  );
}

function isStudentFeeMessage(message: string): boolean {
  return /\b(yuran pengajian|yuran kolej|tuition fee|college fee|hostel fee|bilik berdua|bilik bertiga|bilik berempat|barang elektrik|senarai yuran)\b/i.test(
    message
  );
}

function isShortSemesterMessage(message: string): boolean {
  return /\b(short semester|intersession|semester pendek|sesi pendek)\b/i.test(message);
}

function isSemesterStartMessage(message: string): boolean {
  return /\b(bermula|mula kuliah|kuliah.*mula|start(s|ing)?\s+(of\s+)?(the\s+)?(semester|lecture|class)|when\s+do(es)?\s+(lecture|class|semester)|semester\s+start|lecture\s+start)\b/i.test(
    message
  );
}

function isLectureWeekListMessage(message: string, needsList?: boolean): boolean {
  if (
    /\b(week\s*1\s*[-–to]+\s*14|minggu\s*1\s*[-–hingga]+\s*14|list\s+(semua\s+)?week|senarai\s+(semua\s+)?minggu|all\s+weeks?)\b/i.test(
      message
    )
  ) {
    return true;
  }
  return Boolean(needsList && /\b(week|minggu)\b/i.test(message));
}

function isStudentFocusedMessage(message: string): boolean {
  return /\b(pelajar|student|yuran|fee|fees|daftar|register|kampus|campus|asrama|hostel|biasiswa|scholarship|pendaftaran|semester intake)\b/i.test(
    message
  );
}

type TopicFocus =
  | "matched_activity"
  | "lecture_weeks"
  | "public_holiday"
  | "uitm_only"
  | "uitm_calendar"
  | "multi_session"
  | "student"
  | "academic_calendar";

function resolveTopicFocus(input: {
  message: string;
  topics: ChatTopic[];
  hasMatchedActivity: boolean;
  sessionCount: number;
}): TopicFocus {
  if (input.hasMatchedActivity) return "matched_activity";
  if (isStudentFocusedMessage(input.message) && input.topics.includes("uitm_general")) {
    return "student";
  }
  if (input.topics.includes("lecture_weeks")) return "lecture_weeks";
  if (input.topics.includes("public_holiday")) return "public_holiday";
  if (input.topics.includes("uitm_general") && !input.topics.includes("academic_calendar")) {
    return "uitm_only";
  }
  if (input.topics.includes("uitm_general")) return "uitm_calendar";
  if (input.sessionCount > 1) return "multi_session";
  return "academic_calendar";
}

export function resolveReasoningIntent(input: ReasoningStatusInput): ReasoningIntent {
  if (input.phaseHint === "retry") return "retry";

  const lower = input.message.toLowerCase().trim();
  const contextIntent = input.contextIntent ?? "all";

  if (input.hasMatchedActivity) return "matched_activity";
  if (input.sessionCount > 1) return "multi_session";

  if (isShortSemesterMessage(lower)) return "short_semester";
  if (isLectureWeekListMessage(lower, input.needsList)) return "lecture_week_list";
  if (
    isSemesterStartMessage(lower) ||
    (contextIntent === "lecture" && /\b(bermula|start|mula)\b/i.test(lower))
  ) {
    return "semester_start";
  }

  if (input.topics.includes("lecture_weeks") || contextIntent === "lecture_count") {
    return "lecture_weeks";
  }
  if (input.topics.includes("public_holiday")) return "public_holiday";

  if (
    isStudentFeeMessage(lower) ||
    (contextIntent === "fee" && input.topics.includes("uitm_general"))
  ) {
    return "student_fees";
  }
  if (contextIntent === "registration") return "registration";
  if (contextIntent === "exam") return "exam_dates";
  if (
    contextIntent === "break" ||
    /\b(cuti semester|semester break|mid-semester|cuti pertengahan)\b/i.test(lower)
  ) {
    return "semester_break";
  }

  if (input.topics.includes("uitm_general") && !input.topics.includes("academic_calendar")) {
    return isStudentFocusedMessage(lower) ? "student_fees" : "uitm_general";
  }
  if (input.topics.includes("uitm_general")) return "uitm_general";
  if (input.topics.includes("academic_calendar")) {
    if (contextIntent === "lecture") return "semester_start";
    return "general_info";
  }

  return "general_info";
}

export function resolveReasoningSource(
  intent: ReasoningIntent,
  topics: ChatTopic[]
): string {
  if (intent === "public_holiday" || topics.includes("public_holiday")) {
    return "official public holiday calendar";
  }
  if (
    intent === "uitm_general" ||
    intent === "student_fees" ||
    (topics.includes("uitm_general") && !topics.includes("academic_calendar"))
  ) {
    return "official UiTM information";
  }
  return "official academic calendar";
}

export function resolveReasoningTopic(
  intent: ReasoningIntent,
  input: ReasoningStatusInput
): string {
  const activityName = input.activityMatches?.[0]?.activity.name?.trim();
  switch (intent) {
    case "semester_start":
      return "lecture start date";
    case "short_semester":
      return "short semester dates";
    case "lecture_weeks":
    case "lecture_week_list":
      return "lecture week dates";
    case "semester_break":
      return "semester break dates";
    case "exam_dates":
      return "exam dates";
    case "public_holiday":
      return "public holiday dates";
    case "registration":
      return "registration dates";
    case "student_fees":
      return "student fees and services";
    case "uitm_general":
      return "UiTM general information";
    case "matched_activity":
      return activityName ? `${activityName} dates` : "calendar event dates";
    case "multi_session":
      return "multi-session calendar dates";
    case "retry":
      return "official calendar information";
    case "general_info":
    default:
      return "academic calendar information";
  }
}

const TOPIC_CATEGORY_ALIASES: Record<string, string[]> = {
  "lecture start date": ["lecture start date", "semester start", "kuliah mula", "lecture begin"],
  "short semester dates": ["short semester dates", "short semester", "intersession"],
  "lecture week dates": [
    "lecture week dates",
    "lecture weeks",
    "minggu kuliah",
    "week 1",
    "week 14",
  ],
  "semester break dates": [
    "semester break dates",
    "semester break",
    "cuti semester",
    "mid-semester",
  ],
  "exam dates": ["exam dates", "peperiksaan", "examination"],
  "public holiday dates": ["public holiday dates", "public holiday", "cuti umum", "cuti awam"],
  "registration dates": ["registration dates", "pendaftaran", "registration"],
  "student fees and services": [
    "student fees and services",
    "yuran",
    "fee",
    "fees",
    "kampus",
    "campus",
    "hostel",
    "asrama",
  ],
  "UiTM general information": [
    "UiTM general information",
    "uitm",
    "kampus",
    "campus",
    "fakulti",
    "faculty",
  ],
  "calendar event dates": ["calendar event dates", "activity", "acara"],
  "multi-session calendar dates": [
    "multi-session calendar dates",
    "session",
    "sesi",
    "compare",
  ],
  "official calendar information": ["official calendar information", "calendar", "kalendar"],
  "academic calendar information": [
    "academic calendar information",
    "academic calendar",
    "kalendar akademik",
    "semester",
    "tarikh",
  ],
};

function normalizeTopicKey(topic: string): string {
  return topic.trim().toLowerCase();
}

export function topicsMatch(a: string, b: string): boolean {
  const na = normalizeTopicKey(a);
  const nb = normalizeTopicKey(b);
  if (na === nb) return true;

  for (const [canonical, aliases] of Object.entries(TOPIC_CATEGORY_ALIASES)) {
    const set = new Set([canonical.toLowerCase(), ...aliases.map((x) => x.toLowerCase())]);
    if (set.has(na) && set.has(nb)) return true;
    if (na === canonical.toLowerCase() && aliases.some((al) => nb.includes(al.toLowerCase()))) {
      return true;
    }
    if (nb === canonical.toLowerCase() && aliases.some((al) => na.includes(al.toLowerCase()))) {
      return true;
    }
  }

  const tokensA = na.split(/\s+/).filter((t) => t.length > 3);
  const tokensB = new Set(nb.split(/\s+/).filter((t) => t.length > 3));
  return tokensA.some((t) => tokensB.has(t));
}

function classifyTopicFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(short semester|intersession|semester pendek)\b/i.test(lower)) {
    return "short semester dates";
  }
  if (
    /\b(week\s*1|week\s*14|minggu\s*1|minggu\s*14|lecture week|minggu kuliah)\b/i.test(lower)
  ) {
    return "lecture week dates";
  }
  if (/\b(public holiday|cuti umum|cuti awam|hari kelepasan)\b/i.test(lower)) {
    return "public holiday dates";
  }
  if (/\b(peperiksaan|examination|\bexam\b)\b/i.test(lower)) {
    return "exam dates";
  }
  if (/\b(cuti semester|semester break|mid-semester|cuti pertengahan)\b/i.test(lower)) {
    return "semester break dates";
  }
  if (/\b(pendaftaran|registration|add\/drop|tambah\/gugur)\b/i.test(lower)) {
    return "registration dates";
  }
  if (/\b(yuran|fee|fees|kampus|campus|asrama|hostel|biasiswa)\b/i.test(lower)) {
    return "student fees and services";
  }
  if (
    /\b(bermula|mula kuliah|lecture start|semester start|kuliah.*mula|classes?\s+begin)\b/i.test(
      lower
    )
  ) {
    return "lecture start date";
  }
  if (/\b(uitm|fakulti|faculty|intake|admission)\b/i.test(lower)) {
    return "UiTM general information";
  }
  if (/\b(kalendar|calendar|semester|tarikh|date)\b/i.test(lower)) {
    return "academic calendar information";
  }
  return null;
}

/**
 * Infer a topic label from the final answer (prefer reply; message is fallback)
 * so we can validate that progress_summary stayed on-topic.
 */
export function inferAnswerTopic(reply: string, message: string): string {
  return (
    classifyTopicFromText(reply) ??
    classifyTopicFromText(message) ??
    "academic calendar information"
  );
}

export const VALIDATION_FALLBACK: Record<LangBucket, string> = {
  en: "Reviewing the official information so the answer stays accurate and relevant.",
  malay: "Menyemak maklumat rasmi supaya jawapan kekal tepat dan relevan.",
};

/**
 * Compare status.topic with the final answer topic.
 * On mismatch, leave progress_summary unchanged and set needsLlmRefine so the
 * handler can call the post-answer LLM (or fall back to templates).
 */
export function validateReasoningStatus(
  status: ReasoningStatus,
  reply: string,
  message: string
): ReasoningValidationResult {
  const answerTopic = inferAnswerTopic(reply, message);
  if (topicsMatch(status.topic, answerTopic)) {
    return { status, needsLlmRefine: false };
  }
  return { status, needsLlmRefine: true };
}

/** Apply static bilingual fallback when LLM refine is unavailable. */
export function applyValidationFallback(
  status: ReasoningStatus,
  message: string
): ReasoningStatus {
  const lang = langBucket(detectUserLanguage(message));
  return {
    ...status,
    progress_summary: VALIDATION_FALLBACK[lang],
  };
}

export interface ReasoningParagraphInput {
  message: string;
  phase: ReasoningPhase;
  topics: ChatTopic[];
  programLabel: string;
  sessionCount: number;
  hasMatchedActivity: boolean;
  activityMatches?: MatchedActivity[];
  toolName?: ChatToolName;
  retryReason?: "dates" | "incomplete";
  contextIntent?: CalendarContextIntent;
  needsList?: boolean;
}

type RetryStatusFocus =
  | "academic_calendar"
  | "lecture_weeks"
  | "public_holiday"
  | "uitm_general"
  | "multi_session"
  | "matched_activity";

const RETRY_STATUS_POOLS: Record<
  "dates" | "incomplete",
  Record<RetryStatusFocus, Record<LangBucket, string[]>>
> = {
  dates: {
    academic_calendar: {
      en: ["Verifying calendar dates…", "Double-checking official dates…"],
      malay: ["Mengesahkan tarikh kalendar…", "Menyemak semula tarikh rasmi…"],
    },
    lecture_weeks: {
      en: ["Verifying lecture week dates…", "Double-checking week dates…"],
      malay: ["Mengesahkan tarikh minggu kuliah…", "Menyemak semula tarikh minggu…"],
    },
    public_holiday: {
      en: ["Verifying holiday dates…", "Double-checking public holidays…"],
      malay: ["Mengesahkan tarikh cuti…", "Menyemak semula cuti umum…"],
    },
    uitm_general: {
      en: ["Verifying dates and details…", "Double-checking official dates…"],
      malay: ["Mengesahkan tarikh dan butiran…", "Menyemak semula tarikh rasmi…"],
    },
    multi_session: {
      en: ["Verifying session dates…", "Double-checking semester dates…"],
      malay: ["Mengesahkan tarikh sesi…", "Menyemak semula tarikh semester…"],
    },
    matched_activity: {
      en: ["Verifying event dates…", "Double-checking calendar dates…"],
      malay: ["Mengesahkan tarikh acara…", "Menyemak semula tarikh kalendar…"],
    },
  },
  incomplete: {
    academic_calendar: {
      en: ["Completing your answer…", "Finishing the response…"],
      malay: ["Menyiapkan jawapan anda…", "Melengkapkan respons…"],
    },
    lecture_weeks: {
      en: ["Completing your answer…", "Finishing the response…"],
      malay: ["Menyiapkan jawapan anda…", "Melengkapkan respons…"],
    },
    public_holiday: {
      en: ["Completing your answer…", "Finishing the response…"],
      malay: ["Menyiapkan jawapan anda…", "Melengkapkan respons…"],
    },
    uitm_general: {
      en: ["Completing your answer…", "Finishing the response…"],
      malay: ["Menyiapkan jawapan anda…", "Melengkapkan respons…"],
    },
    multi_session: {
      en: ["Completing your answer…", "Finishing the response…"],
      malay: ["Menyiapkan jawapan anda…", "Melengkapkan respons…"],
    },
    matched_activity: {
      en: ["Completing your answer…", "Finishing the response…"],
      malay: ["Menyiapkan jawapan anda…", "Melengkapkan respons…"],
    },
  },
};

export type RetryStatusInput = Pick<
  ReasoningParagraphInput,
  "message" | "topics" | "sessionCount" | "hasMatchedActivity" | "retryReason"
>;

/** Short shimmer label for mid-stream regenerate (retry) — topic + language aware. */
export function buildRetryStatusLine(input: RetryStatusInput): string {
  const lang = langBucket(detectUserLanguage(input.message));
  const retryReason = input.retryReason ?? "incomplete";
  const focus = resolveTopicFocus({
    message: input.message,
    topics: input.topics,
    hasMatchedActivity: input.hasMatchedActivity,
    sessionCount: input.sessionCount,
  }) as RetryStatusFocus;
  const pool =
    RETRY_STATUS_POOLS[retryReason][focus]?.[lang] ??
    RETRY_STATUS_POOLS[retryReason].academic_calendar[lang];
  const seed = `${input.message}:retry-status:${retryReason}:${focus}`;
  return pickProgressPhrase(pool, seed);
}

export interface ReasoningOpenerInput {
  message: string;
  topics: ChatTopic[];
  hasMatchedActivity: boolean;
  activityMatches: MatchedActivity[];
  programLabel: string;
  sessionCount: number;
}

/** Replace the visible reasoning paragraph (never append). */
export function replaceReasoningParagraph(current: string, next: string): string {
  const paragraph = next.trim();
  if (!paragraph) return current;
  if (current.trim() === paragraph) return current;
  return paragraph;
}

export function truncateForReasoning(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  const max = 72;
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}
