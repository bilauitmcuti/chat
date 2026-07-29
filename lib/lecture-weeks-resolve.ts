import type { LectureWeek } from "@/lib/calendar-api";

/**
 * Builds a Map from ISO date string ("YYYY-MM-DD") to lecture week number.
 * Each week's days are iterated so any day Mon–Sun maps to that week's number.
 */
export function buildDateToWeekNumberMap(
  weeks: LectureWeek[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const week of weeks) {
    for (const day of week.days) {
      if (day.date) map.set(day.date, week.weekNumber);
    }
  }
  return map;
}

export function getLectureWeekNumberForDate(
  map: Map<string, number>,
  dateStr: string
): number | null {
  return map.get(dateStr) ?? null;
}

export function lectureWeekMapFromRecord(
  rec: Record<string, number> | null | undefined
): Map<string, number> | null {
  if (!rec) return null;
  const entries = Object.entries(rec);
  if (entries.length === 0) return null;
  return new Map(entries);
}

export function mergeLectureWeekRecords(
  records: Record<string, number>[]
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const rec of records) {
    for (const [date, weekNum] of Object.entries(rec)) {
      merged[date] = weekNum;
    }
  }
  return merged;
}

export function mergeLectureWeekRecordsForSessions(
  lectureWeekBySession: Record<string, Record<string, number>>,
  sessionIds: readonly string[]
): Record<string, number> {
  const records = sessionIds
    .map((sessionId) => lectureWeekBySession[sessionId])
    .filter(
      (record): record is Record<string, number> =>
        !!record && Object.keys(record).length > 0
    );
  return mergeLectureWeekRecords(records);
}

export function resolveLectureWeekMapForSessions(params: {
  lectureWeekBySession: Record<string, Record<string, number>>;
  selectedSessions: readonly string[];
  initialLectureWeekByDate?: Record<string, number> | null;
}): Map<string, number> | null {
  const merged = mergeLectureWeekRecordsForSessions(
    params.lectureWeekBySession,
    params.selectedSessions
  );
  if (Object.keys(merged).length > 0) {
    return lectureWeekMapFromRecord(merged);
  }

  const hasLoadedSessionWeeks =
    Object.keys(params.lectureWeekBySession).length > 0;
  if (
    !hasLoadedSessionWeeks &&
    params.initialLectureWeekByDate &&
    params.selectedSessions.length > 0
  ) {
    return lectureWeekMapFromRecord(params.initialLectureWeekByDate);
  }

  return null;
}
