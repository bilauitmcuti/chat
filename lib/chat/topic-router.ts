/**
 * Classify user questions into API-backed topics without using activity-title
 * words as hard filters (e.g. "cuti" in an official event name).
 */

export type ChatTopic =
  | "academic_calendar"
  | "lecture_weeks"
  | "public_holiday"
  | "uitm_general";

export interface TopicRouteResult {
  topics: ChatTopic[];
  /** User message likely names a specific calendar row — skip keyword intent filter. */
  hasNamedActivity: boolean;
}

const LECTURE_WEEK_PHRASES = [
  "minggu kuliah",
  "lecture week",
  "lecture weeks",
  "week berapa",
  "minggu berapa",
  "minggu ke-",
  "minggu ke ",
  "week 1",
  "week 14",
  "minggu 1",
  "minggu 14",
  "senarai minggu",
  "list of weeks",
  "berapa minggu kuliah",
  "how many lecture weeks",
  "how many weeks",
  "current week",
  "minggu sekarang",
];

const PUBLIC_HOLIDAY_PHRASES = [
  "public holiday",
  "public holidays",
  "cuti umum",
  "cuti awam",
  "cuti kebangsaan",
  "cuti negeri",
  "hari kelepasan",
  "kelepasan am",
  "malaysia holiday",
  "state holiday",
  "cuti pada",
  "holiday in",
  "holiday on",
];

const ACADEMIC_BREAK_PHRASES = [
  "cuti semester",
  "semester break",
  "break semester",
  "cuti pertengahan",
  "mid-semester break",
  "study week",
  "minggu ulangkaji",
];

const UITM_GENERAL_PHRASES = [
  "kampus",
  "campus",
  "fakulti",
  "faculty",
  "faculties",
  "admission",
  "intake",
  "syarat kemasukan",
  "requirement",
  "scholarship",
  "biasiswa",
  "course detail",
  "course code",
  "subjek",
  "portal",
  "student portal",
  "istudent",
  "yuran pengajian",
  "yuran kolej",
  "tuition",
  "hostel fee",
  "college fee",
  "berapa yuran",
  "gred",
  "grade",
  "cgpa",
  "dean",
  "naib canselor",
];

const ACADEMIC_CALENDAR_PHRASES = [
  "bila",
  "when",
  "tarikh",
  "date",
  "jadual",
  "schedule",
  "calendar",
  "kalendar",
  "semester",
  "sesi",
  "session",
  "pendaftaran",
  "registration",
  "peperiksaan",
  "exam",
  "examination",
  "kuliah",
  "lecture",
  "cuti semester",
  "cuti pertengahan",
  "mid-semester",
  "minggu ulangkaji",
  "revision",
  "gugur taraf",
  "yuran",
  "fee",
  "deferment",
  "penangguhan",
  "gt",
  "rpgt",
  "group a",
  "group b",
  "kumpulan",
];

function includesAny(lower: string, phrases: string[]): boolean {
  return phrases.some((p) => lower.includes(p));
}

/** Lecture-week topic: phrase-based, not bare "kuliah" inside an activity title. */
export function messageAsksLectureWeeks(message: string): boolean {
  const lower = message.toLowerCase();
  if (includesAny(lower, LECTURE_WEEK_PHRASES)) return true;
  if (/\b(minggu|week)s?\s*\d+\s*(-|to|hingga|sehingga|sampai)\s*\d+\b/i.test(lower)) {
    return true;
  }
  return false;
}

export function messageAsksPublicHoliday(message: string): boolean {
  const lower = message.toLowerCase();
  const hasAcademicBreakPhrase = includesAny(lower, ACADEMIC_BREAK_PHRASES);
  const hasPublicHolidayScope = /\b(malaysia|negeri|state|umum|awam|johor|selangor|sabah|sarawak|kedah|kelantan|terengganu|kl|kuala lumpur)\b/.test(
    lower
  );

  if (hasAcademicBreakPhrase && !hasPublicHolidayScope) return false;
  if (includesAny(lower, PUBLIC_HOLIDAY_PHRASES)) return true;
  if (/\b(cuti|holiday)\b/.test(lower) && hasPublicHolidayScope) {
    return true;
  }
  return false;
}

export function messageAsksUitmGeneral(message: string): boolean {
  const lower = message.toLowerCase();
  return includesAny(lower, UITM_GENERAL_PHRASES);
}

export function messageAsksAcademicCalendar(message: string): boolean {
  const lower = message.toLowerCase();
  if (includesAny(lower, ACADEMIC_CALENDAR_PHRASES)) return true;
  if (/\b(bila|when|tarikh|date)\b/i.test(lower)) return true;
  return false;
}

/**
 * Route a user message to one or more topics. Default for ambiguous UiTM chat
 * is academic calendar when program/session context exists.
 */
export function routeChatTopics(
  message: string,
  hasNamedActivity: boolean
): TopicRouteResult {
  const topics = new Set<ChatTopic>();

  const wantsLecture = messageAsksLectureWeeks(message);
  const wantsHoliday = messageAsksPublicHoliday(message);
  const wantsGeneral = messageAsksUitmGeneral(message);
  const wantsAcademic =
    hasNamedActivity ||
    messageAsksAcademicCalendar(message) ||
    (!wantsLecture && !wantsHoliday && !wantsGeneral);

  if (wantsAcademic) topics.add("academic_calendar");
  if (wantsLecture) topics.add("lecture_weeks");
  if (wantsHoliday) topics.add("public_holiday");
  if (wantsGeneral) topics.add("uitm_general");

  if (topics.size === 0) {
    topics.add("academic_calendar");
  }

  return {
    topics: [...topics],
    hasNamedActivity,
  };
}

/** True when user asks for next/upcoming event without naming a specific activity. */
export function messageAsksNextUpcomingEvent(message: string): boolean {
  const lower = message.toLowerCase();
  if (/\b(next|upcoming|seterusnya|akan datang|lepas ni|yang akan datang)\b/.test(lower)) {
    return true;
  }
  if (/\b(bila|when)\b/.test(lower) && /\b(cuti|break|exam|peperiksaan|holiday)\b/.test(lower)) {
    if (!/\b(pendaftaran|registration|peperiksaan akhir|cuti semester|cuti pertengahan)\b/i.test(lower)) {
      return true;
    }
  }
  return false;
}
