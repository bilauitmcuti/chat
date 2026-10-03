import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import { CLEF_NOUL_THRESHOLD } from "@/lib/chat/clef/model";
import type { ReplyLanguage } from "@/lib/chat/language/types";
import type { ChatTopic } from "@/lib/chat/topic-router";

const TOPICS = new Set<ChatTopic>([
  "academic_calendar",
  "lecture_weeks",
  "public_holiday",
  "uitm_general",
]);

const INTENTS = new Set<CalendarContextIntent>([
  "all",
  "break",
  "exam",
  "lecture",
  "registration",
  "fee",
  "revision",
  "gugur",
  "days_until",
  "lecture_count",
  "festive",
]);

export interface ClefUnderstanding {
  primaryTopic: ChatTopic | null;
  primaryTopicConfidence: number;
  alsoLectureWeeks: boolean;
  alsoPublicHoliday: boolean;
  alsoUitmGeneral: boolean;
  calendarIntent: CalendarContextIntent | null;
  calendarIntentConfidence: number;
  /** null when the noul answer is missing. */
  isDayStatus: boolean | null;
  dayStatusScore: number;
  replyLanguage: ReplyLanguage | null;
  replyLanguageConfidence: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readChoice(
  answers: Record<string, unknown>,
  id: string
): { choice: string; confidence: number } | null {
  const answer = asRecord(answers[id]);
  if (!answer || answer.type !== "choice") return null;
  if (typeof answer.choice !== "string") return null;
  const confidence =
    typeof answer.confidence === "number" && Number.isFinite(answer.confidence)
      ? answer.confidence
      : 0;
  return { choice: answer.choice, confidence };
}

function readNoul(answers: Record<string, unknown>, id: string): number | null {
  const answer = asRecord(answers[id]);
  if (!answer || answer.type !== "noul") return null;
  if (typeof answer.noul !== "number" || !Number.isFinite(answer.noul)) return null;
  return answer.noul;
}

function toReplyLanguage(choice: string): ReplyLanguage | null {
  if (choice === "en") return "en";
  if (choice === "ms" || choice === "ms-MY") return "ms-MY";
  if (choice === "mixed") return "mixed";
  return null;
}

export function emptyClefUnderstanding(): ClefUnderstanding {
  return {
    primaryTopic: null,
    primaryTopicConfidence: 0,
    alsoLectureWeeks: false,
    alsoPublicHoliday: false,
    alsoUitmGeneral: false,
    calendarIntent: null,
    calendarIntentConfidence: 0,
    isDayStatus: null,
    dayStatusScore: 0,
    replyLanguage: null,
    replyLanguageConfidence: 0,
  };
}

/** Parse a Workers AI Clef payload (`answers.*.choice|noul`). */
export function parseClefResponse(raw: unknown): ClefUnderstanding | null {
  const root = asRecord(raw);
  const answers = root ? asRecord(root.answers) : null;
  if (!answers) return null;

  const parsed = emptyClefUnderstanding();
  const topic = readChoice(answers, "primary_topic");
  if (topic && TOPICS.has(topic.choice as ChatTopic)) {
    parsed.primaryTopic = topic.choice as ChatTopic;
    parsed.primaryTopicConfidence = topic.confidence;
  }

  const lecture = readNoul(answers, "also_lecture_weeks");
  const holiday = readNoul(answers, "also_public_holiday");
  const general = readNoul(answers, "also_uitm_general");
  parsed.alsoLectureWeeks = (lecture ?? 0) >= CLEF_NOUL_THRESHOLD;
  parsed.alsoPublicHoliday = (holiday ?? 0) >= CLEF_NOUL_THRESHOLD;
  parsed.alsoUitmGeneral = (general ?? 0) >= CLEF_NOUL_THRESHOLD;

  const intent = readChoice(answers, "calendar_intent");
  if (intent && INTENTS.has(intent.choice as CalendarContextIntent)) {
    parsed.calendarIntent = intent.choice as CalendarContextIntent;
    parsed.calendarIntentConfidence = intent.confidence;
  }

  const day = readNoul(answers, "is_day_status");
  if (day !== null) {
    parsed.dayStatusScore = day;
    parsed.isDayStatus = day >= CLEF_NOUL_THRESHOLD;
  }

  const language = readChoice(answers, "reply_language");
  if (language) {
    parsed.replyLanguage = toReplyLanguage(language.choice);
    parsed.replyLanguageConfidence = language.confidence;
  }

  return parsed;
}
