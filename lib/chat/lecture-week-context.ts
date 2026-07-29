import { fetchLectureWeeks } from "@/lib/calendar-api-server";
import type { LectureWeek } from "@/lib/calendar-api";
import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import { sessionLabelForContext } from "@/lib/chat/context";
import { toDateFormat } from "@/lib/chat/dates";
import {
  buildDateToWeekNumberMap,
  getLectureWeekNumberForDate,
} from "@/lib/lecture-weeks-resolve";
import type { SessionId } from "@/lib/data";

const LECTURE_WEEK_MESSAGE_HINTS = [
  "minggu kuliah",
  "lecture week",
  "lecture weeks",
  "week berapa",
  "minggu berapa",
  "current week",
  "minggu sekarang",
  "minggu ke",
  "berapa minggu",
  "how many weeks",
  "senarai minggu",
  "list of weeks",
  "week 1",
  "minggu 1",
  "weeks 1",
];

const LECTURE_WEEK_TABLE_HINTS = [
  "senarai minggu",
  "list of weeks",
  "list weeks",
  "list lecture",
  "all weeks",
  "every week",
  "setiap minggu",
  "minggu 1",
  "week 1",
  "weeks 1",
  "minggu kuliah 1",
  "berapa minggu",
  "how many weeks",
];

const WEEK_RANGE_RE = /\b(minggu|week)s?\s*\d+\s*(-|to|hingga|sehingga|sampai)\s*\d+\b/i;

export function needsLectureWeekContext(
  intent: CalendarContextIntent,
  message: string
): boolean {
  if (intent === "lecture" || intent === "lecture_count" || intent === "days_until") {
    return true;
  }
  const lower = message.toLowerCase();
  return LECTURE_WEEK_MESSAGE_HINTS.some((h) => lower.includes(h));
}

/** True when the user wants the full lecture-week table (weeks 1..N), not just the current week. */
export function needsLectureWeekTable(message: string): boolean {
  const lower = message.toLowerCase();
  if (WEEK_RANGE_RE.test(lower)) return true;
  return LECTURE_WEEK_TABLE_HINTS.some((h) => lower.includes(h));
}

function findWeekByNumber(weeks: LectureWeek[], weekNumber: number): LectureWeek | undefined {
  return weeks.find((w) => w.weekNumber === weekNumber);
}

export function formatLectureWeekLineFromWeeks(
  sessionId: SessionId,
  todayISO: string,
  weeks: LectureWeek[]
): string {
  const label = sessionLabelForContext(sessionId);
  const map = buildDateToWeekNumberMap(weeks);
  const weekNum = getLectureWeekNumberForDate(map, todayISO);
  if (weekNum == null) {
    return `CURRENT LECTURE WEEK [${label}]: Not in lecture period (today ${toDateFormat(todayISO)})`;
  }
  const week = findWeekByNumber(weeks, weekNum);
  const range =
    week?.rangeLabel ||
    (week?.weekStart && week?.weekEnd
      ? `${toDateFormat(week.weekStart)} to ${toDateFormat(week.weekEnd)}`
      : "");
  return `CURRENT LECTURE WEEK [${label}]: Minggu Kuliah ${weekNum}${range ? ` (${range})` : ""}`;
}

export async function buildLectureWeekQuickReference(
  sessionIds: SessionId[],
  todayISO: string
): Promise<string> {
  if (sessionIds.length === 0) return "";

  const results = await Promise.all(
    sessionIds.map(async (sid) => {
      try {
        const { weeks } = await fetchLectureWeeks(sid);
        return formatLectureWeekLineFromWeeks(sid, todayISO, weeks);
      } catch {
        return `CURRENT LECTURE WEEK [${sessionLabelForContext(sid)}]: (lecture week data unavailable)`;
      }
    })
  );

  return results.join("\n");
}

function formatWeekRange(week: LectureWeek): string {
  if (week.rangeLabel) return week.rangeLabel;
  if (week.weekStart && week.weekEnd) {
    return `${toDateFormat(week.weekStart)} to ${toDateFormat(week.weekEnd)}`;
  }
  return "";
}

export function formatLectureWeeksTable(
  sessionId: SessionId,
  weeks: LectureWeek[]
): string {
  const label = sessionLabelForContext(sessionId);
  if (weeks.length === 0) {
    return `LECTURE WEEKS [${label}]: (no lecture weeks data)`;
  }
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const lines = sorted.map((w) => {
    const range = formatWeekRange(w);
    return range
      ? `Week ${w.weekNumber}: ${range}`
      : `Week ${w.weekNumber}: (no range)`;
  });
  return [
    `LECTURE WEEKS [${label}] — WEEK_COUNT: ${sorted.length}`,
    ...lines,
  ].join("\n");
}

/**
 * Build the full "Week 1..N: range" block for each session. Used when the user
 * asks for the lecture-week list, total count, or a specific week range.
 */
export async function buildLectureWeeksTableBlock(
  sessionIds: SessionId[]
): Promise<string> {
  if (sessionIds.length === 0) return "";
  const results = await Promise.all(
    sessionIds.map(async (sid) => {
      try {
        const { weeks } = await fetchLectureWeeks(sid);
        return formatLectureWeeksTable(sid, weeks);
      } catch {
        return `LECTURE WEEKS [${sessionLabelForContext(sid)}]: (lecture week data unavailable)`;
      }
    })
  );
  return results.join("\n\n");
}
