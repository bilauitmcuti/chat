import { CHAT_LONG_MESSAGE_THRESHOLD_CHARS } from "@/lib/chat/limits";
import { CHAT_IN_SCOPE_COMPLETION_HINT } from "@/lib/chat/response-format";
import {
  messageAsksAcademicCalendar,
  messageAsksLectureWeeks,
  messageAsksPublicHoliday,
  messageAsksUitmGeneral,
} from "@/lib/chat/topic-router";

/** Soft cap for "simple date Q" completion style (not a hard block on fast path). */
const SIMPLE_QUESTION_MAX_CHARS = CHAT_LONG_MESSAGE_THRESHOLD_CHARS * 2; // 640

const PUBLIC_HOLIDAY_KEYWORDS = [
  "public holiday",
  "cuti umum",
  "cuti awam",
  "cuti kebangsaan",
  "hari kelepasan",
  "kelepasan am",
  "cuti negeri",
];

const CALENDAR_STRONG_KEYWORDS = [
  "cuti",
  "semester",
  "peperiksaan",
  "exam",
  "tarikh",
  "date",
  "break",
  "kuliah",
  "lecture",
  "pendaftaran",
  "registration",
  "minggu ulangkaji",
  "revision",
  "gugur taraf",
  "group a",
  "group b",
  "kumpulan",
  "jadual",
  "schedule",
  "hari raya",
  "aidil",
  "short semester",
  "intersession classes",
  "penangguhan",
  "deferment",
  "tempoh",
  "permohonan",
];

const CALENDAR_AMBIGUOUS_KEYWORDS = [
  "class",
  "classes",
  "lectures",
  "yuran",
  "fee",
  "bila",
  "when",
  "mds",
];

const GENERAL_UITM_INFO_KEYWORDS = [
  "kampus",
  "campus",
  "fakulti",
  "faculty",
  "program",
  "course",
  "courses",
  "subjek",
  "subject",
  "subjects",
  "admission",
  "intake",
  "syarat",
  "requirement",
  "requirements",
  "scholarship",
  "biasiswa",
  "gred",
  "grade",
  "yuran pengajian",
  "yuran kolej",
  "bilik berdua",
  "bilik bertiga",
  "bilik berempat",
  "barang elektrik",
];

const UITM_SUPPLEMENT_KEYWORDS = [
  "gred",
  "grade",
  "lulus (lu)",
  "gagal (ga)",
  "yuran pengajian",
  "yuran kolej",
  "bilik berdua",
  "bilik bertiga",
  "bilik berempat",
  "barang elektrik",
  "senarai yuran",
  "yuran diploma",
  "yuran degree",
  "yuran ijazah",
  "tuition fee",
  "college fee",
  "hostel fee",
  "berapa yuran",
  "exam grade",
  "peperiksaan gred",
];

const CALENDAR_INTENT_HINTS = [
  "mula",
  "start",
  "akhir",
  "end",
  "next",
  "upcoming",
  "seterusnya",
  "akan datang",
  "lepas ni",
  "current",
  "sekarang",
  "tarikh",
  "date",
  "jadual",
  "schedule",
  "cuti",
  "semester",
  "exam",
  "peperiksaan",
  "registration",
  "pendaftaran",
  "bila",
  "when",
  "tempoh",
  "penangguhan",
  "deferment",
  "berkaitan",
  "related",
];

const SCHEDULE_DATE_PHRASES = /\b(bila|when|tarikh|date|tempoh|ada tarikh)\b/i;
const FEE_CALENDAR_PHRASES =
  /\b(yuran|fee|fees|bayaran|pembayaran|penangguhan|deferment|gt\b|rpgt)\b/i;

export function isPublicHolidayQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  if (PUBLIC_HOLIDAY_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  if (/\b(cuti|holiday)\b/.test(lower) && /\b(malaysia|negeri|state|umum|awam)\b/.test(lower)) {
    return true;
  }
  return false;
}

export function isCalendarQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  if (isPublicHolidayQuestion(message)) return true;
  if (CALENDAR_STRONG_KEYWORDS.some((kw) => lower.includes(kw))) return true;

  if (SCHEDULE_DATE_PHRASES.test(lower) && FEE_CALENDAR_PHRASES.test(lower)) {
    return true;
  }

  const hasAmbiguousKeyword = CALENDAR_AMBIGUOUS_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );
  if (!hasAmbiguousKeyword) return false;

  const hasGeneralUitmIntent = GENERAL_UITM_INFO_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );
  if (hasGeneralUitmIntent) return false;

  return CALENDAR_INTENT_HINTS.some((kw) => lower.includes(kw));
}

const COMPARE_KEYWORDS = [
  "compare",
  "comparison",
  "difference",
  "different",
  "vs",
  "versus",
  "bezakan",
  "beza",
  "perbandingan",
  "banding",
];

export function isComparisonQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return COMPARE_KEYWORDS.some((kw) => lower.includes(kw));
}

const TABLE_FORMAT_KEYWORDS = [
  "table",
  "jadual",
  "in table",
  "into table",
  "as table",
  "tabular",
  "format table",
  "write table",
  "list in table",
  "show in table",
  "bentuk jadual",
  "dalam jadual",
  "dalam bentuk jadual",
  "senarai jadual",
];

export function isTableFormatRequested(message: string): boolean {
  const lower = message.toLowerCase();
  return TABLE_FORMAT_KEYWORDS.some((kw) => lower.includes(kw));
}

export const TABLE_OUTPUT_RULE =
  "\n\nTABLE OUTPUT RULE (MANDATORY): The user asked for a table. Put the schedule or comparison inside a [TABLE]...[/TABLE] block only. Format:\n[TABLE]\n| Activity | Date |\n| --- | --- |\n| (event name) | (date or range) |\n[/TABLE]\nRules: First row inside [TABLE] MUST be real column headers (e.g. Activity, Date)—NOT a group title. Put group/program title as ONE plain-text line immediately BEFORE [TABLE]. Use pipe | between columns. Do NOT output raw markdown tables outside [TABLE]. For session comparisons, first column = session id + label. Sort data rows by date ascending (earliest first) unless the user asked for latest first.";

const LIST_OR_SCHEDULE_KEYWORDS = [
  "senarai",
  "list",
  "list all",
  "list out",
  "semua",
  "all activities",
  "all dates",
  "jadual",
  "schedule",
  "calendar for",
  "kalendar",
  "this month",
  "next month",
  "bulan ini",
  "bulan depan",
  "minggu ini",
  "minggu depan",
  "week 1",
  "week 14",
  "minggu 1",
  "minggu 14",
  "weeks 1",
  "minggu 1 -",
  "minggu 1-",
  "weeks 1 -",
  "weeks 1-",
  "every week",
  "setiap minggu",
  "minggu kuliah",
  "lecture week",
  "lecture weeks",
  "weekly",
  "mingguan",
  "berapa minggu",
  "how many weeks",
  "berapa hari",
  "between",
  "antara",
  "from ",
  "dari tarikh",
  "sehingga",
  "until",
  "compare",
  "banding",
  "bezakan",
  "perbandingan",
];

const WEEK_RANGE_REGEX = /\b(minggu|week)s?\s*\d+\s*(-|to|hingga|sehingga|sampai)\s*\d+\b/i;
const MONTH_NAME_REGEX =
  /\b(jan|feb|mac|march|apr|april|may|mei|jun|jul|julai|ogos|aug|august|sep|sept|september|okt|oct|october|nov|november|dis|dec|december|disember)\b/i;

export function messageNeedsListOrSchedule(message: string): boolean {
  const lower = message.toLowerCase();
  if (WEEK_RANGE_REGEX.test(lower)) return true;
  if (LIST_OR_SCHEDULE_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  if (MONTH_NAME_REGEX.test(lower)) {
    return /\b(senarai|list|jadual|schedule|aktiviti|activities|kalendar|calendar|semua|all|every|setiap)\b/.test(
      lower
    );
  }
  return false;
}

export function isSimpleCalendarQuestion(
  message: string,
  options?: { hasMatchedActivity?: boolean }
): boolean {
  if (options?.hasMatchedActivity) return false;
  const lower = message.toLowerCase().trim();
  const simpleHints = [
    "when",
    "bila",
    "tarikh",
    "date",
    "next",
    "seterusnya",
    "mula",
    "start",
    "end",
    "akhir",
  ];
  const hasSimpleHint = simpleHints.some((kw) => lower.includes(kw));
  if (!hasSimpleHint) return false;
  if (lower.length > SIMPLE_QUESTION_MAX_CHARS) return false;
  if (messageNeedsListOrSchedule(message)) return false;
  if (messageAsksDetail(message)) return false;
  if (isTableFormatRequested(message)) return false;
  return true;
}

const MINIMAL_CHITCHAT_MAX_WORDS = 2;
const MINIMAL_CHITCHAT_MAX_CHARS = 24;

const MINIMAL_CHITCHAT_PATTERNS = [
  /^h(i|ey|ai|alo)\b/i,
  /^hello\b/i,
  /^salam\b/i,
  /^ass?alamu/i,
  /^thanks?\b/i,
  /^thank you\b/i,
  /^ok(ay)?\b/i,
  /^test\b/i,
  /^yo\b/i,
  /^good\s+(morning|afternoon|evening|night)\b/i,
  /^apa\s+khabar/i,
  /^how\s+are\s+you\b/i,
  /^hmm+\b/i,
];

function hasSubstantiveTopicIntent(message: string): boolean {
  return (
    messageAsksAcademicCalendar(message) ||
    messageAsksLectureWeeks(message) ||
    messageAsksPublicHoliday(message) ||
    messageAsksUitmGeneral(message) ||
    messageAsksDetail(message) ||
    messageNeedsListOrSchedule(message) ||
    isTableFormatRequested(message)
  );
}

/** Short chitchat or random typing with no calendar/UiTM intent — skip thinking/reasoning UI. */
export function isMinimalConversationalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (hasSubstantiveTopicIntent(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (MINIMAL_CHITCHAT_PATTERNS.some((pattern) => pattern.test(lower))) {
    return true;
  }

  return words.length <= MINIMAL_CHITCHAT_MAX_WORDS && trimmed.length <= MINIMAL_CHITCHAT_MAX_CHARS;
}

/** Long user input — allow a larger completion budget. */
export function messageIsLong(message: string): boolean {
  return message.trim().length > CHAT_LONG_MESSAGE_THRESHOLD_CHARS;
}

export function messageAsksDetail(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("explain") ||
    lower.includes("why") ||
    lower.includes("how") ||
    lower.includes("detail") ||
    lower.includes("huraikan") ||
    lower.includes("jelaskan") ||
    lower.includes("full") ||
    lower.includes("complete") ||
    lower.includes("lengkap") ||
    lower.includes("semua") ||
    lower.includes("list all") ||
    lower.includes("senarai")
  );
}

/** User explicitly asks about the other academic group (A vs B). */
export function needsSecondaryGroupContext(
  message: string,
  primaryGroup: "A" | "B"
): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("group a") || lower.includes("kumpulan a")) return true;
  if (lower.includes("group b") || lower.includes("kumpulan b")) return true;
  const other = primaryGroup === "A" ? "b" : "a";
  if (lower.includes(`group ${other}`) || lower.includes(`kumpulan ${other}`)) return true;
  if (
    primaryGroup === "A" &&
    (lower.includes("march") ||
      lower.includes("ogos") ||
      lower.includes("august") ||
      lower.includes("pre-diploma") ||
      lower.includes("diploma"))
  ) {
    return true;
  }
  if (
    primaryGroup === "B" &&
    (lower.includes("december") ||
      lower.includes("disember") ||
      lower.includes("foundation") ||
      lower.includes("professional"))
  ) {
    return true;
  }
  return isComparisonQuestion(message);
}

/** Force uitm-info.json into calendar prompts for grades and study-fee questions. */
export function needsUitmKnowledgeSupplement(message: string): boolean {
  const lower = message.toLowerCase();
  return UITM_SUPPLEMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Per-turn hints so the model maps synonyms (e.g. Fee Deferment ↔ penangguhan yuran). */
export function getCalendarUnderstandingDirective(message: string): string {
  const lower = message.toLowerCase();
  const feeRelated =
    /\b(yuran|fee|deferment|penangguhan|gt\b|gt2|rpgt|bayaran|pembayaran)\b/.test(
      lower
    );
  if (!feeRelated) return "";

  const wantsList =
    lower.includes("berkaitan") ||
    lower.includes("related") ||
    lower.includes("semua") ||
    lower.includes("list") ||
    lower.includes("senarai") ||
    lower.includes("tempoh") ||
    lower.includes("permohonan");

  let directive =
    "\n\nTHIS TURN — FEE/DEFERMENT: Treat Online Fee Deferment, fee deferment, and penangguhan pembayaran yuran as the same topic. Use every matching row in the calendar context (including Tarikh Akhir … Penangguhan …, keputusan, diluluskan penangguhan, GT/RPGT yuran lines). Do not say data is unavailable if any such row appears in context.";

  if (wantsList) {
    directive +=
      " List each related activity with its date (and end date if present), oldest to newest.";
  } else {
    directive += " Answer the specific deadline or tempoh asked; if only tarikh akhir exists, state those dates clearly.";
  }

  return directive;
}

/**
 * Tells the model which API-backed block is authoritative for each topic.
 */
export function getCalendarDataSourcesDirective(): string {
  return [
    "\n\nTHREE API DATA SOURCES (mandatory — never mix or guess):",
    "1) UiTM ACADEMIC CALENDAR — GROUP sections and activity lines (pendaftaran, kuliah, peperiksaan, cuti, yuran, GT). Copy each event's start/end dates exactly as shown. Session label months (e.g. Mar–Aug in the session name) are NOT boundaries: events may start before March and end after August — trust the activity dates and SESSION TIMELINE API span, not the label alone.",
    "2) LECTURE WEEKS — LECTURE WEEKS / CURRENT LECTURE WEEK blocks only (from lecture-week data). Use for minggu kuliah, week number, and Week 1..N date ranges. Do NOT derive lecture week dates from GROUP 'Kuliah' activity rows.",
    "3) MALAYSIA PUBLIC HOLIDAYS — MALAYSIA PUBLIC HOLIDAYS block only (cuti umum). Do NOT list UiTM semester breaks as public holidays, or vice versa. For 'is UiTM off on X', check both GROUP break/cuti rows and the public holiday block if relevant.",
    "If blocks disagree, prefer the specialized block (lecture weeks for weeks; public holidays for cuti umum; GROUP for academic events).",
  ].join("\n");
}

export function getCompletionInstruction(
  isSimple: boolean,
  asksDetail: boolean,
  needsList: boolean = false,
  hasMatchedActivity: boolean = false
): string {
  if (hasMatchedActivity) {
    return "\n\nIMPORTANT: The user named a specific calendar activity. Answer using MATCHED ACTIVITIES dates exactly. Do not substitute a different event or NEXT BREAK.";
  }
  if (needsList) {
    return "\n\nIMPORTANT (LIST/SCHEDULE ANSWER): Write the FULL list the user asked for. Never end the reply at a header, colon, or empty line. Every dash/numbered/[TABLE] row must have its date filled in. If a section header is written (e.g. \"Group B (Diploma):\"), follow it with at least one content line on the next line. Continue until the list is complete.";
  }
  if (isSimple) {
    return "\n\nKeep the reply to 1–3 sentences with the date. No planning or checklists in the output. Always end with a full sentence and proper punctuation.";
  }
  if (asksDetail) {
    return "\n\nIMPORTANT: Finish every sentence and paragraph completely—never stop mid-thought, mid-list, or right after a colon. Use enough length to answer fully without truncating.";
  }
  return (
    "\n\nIMPORTANT: Be concise but complete. Finish every sentence; never end after a colon or header. Avoid filler and unrelated calendar items." +
    CHAT_IN_SCOPE_COMPLETION_HINT
  );
}
