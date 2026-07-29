import { toDateFormat } from "@/lib/chat/dates";
import type { Activity } from "@/lib/data";
import type { LectureWeek } from "@/lib/calendar-api";

/** DD-MM-YYYY tokens the model may cite without triggering a date retry. */
export function collectAllowedDateTokens(activities: Activity[]): Set<string> {
  const allowed = new Set<string>();
  for (const a of activities) {
    if (a.startDate) allowed.add(toDateFormat(a.startDate));
    if (a.endDate) allowed.add(toDateFormat(a.endDate));
    if (a.regionalStartDate) allowed.add(toDateFormat(a.regionalStartDate));
    if (a.regionalEndDate) allowed.add(toDateFormat(a.regionalEndDate));
  }
  return allowed;
}

export function addLectureWeekDates(allowed: Set<string>, weeks: LectureWeek[]): void {
  for (const w of weeks) {
    if (w.weekStart) allowed.add(toDateFormat(w.weekStart));
    if (w.weekEnd) allowed.add(toDateFormat(w.weekEnd));
    for (const day of w.days) {
      if (day.date) allowed.add(toDateFormat(day.date));
    }
    if (w.rangeLabel) {
      for (const m of w.rangeLabel.matchAll(/\b(\d{2}-\d{2}-\d{4})\b/g)) {
        allowed.add(m[1]!);
      }
    }
  }
}

export function addPublicHolidayDates(
  allowed: Set<string>,
  holidayDatesISO: string[]
): void {
  for (const iso of holidayDatesISO) {
    if (iso) allowed.add(toDateFormat(iso));
  }
}

/** Extract DD-MM-YYYY tokens already present in injected context text. */
export function addDatesFromContextText(allowed: Set<string>, contextText: string): void {
  for (const m of contextText.matchAll(/\b(\d{2}-\d{2}-\d{4})\b/g)) {
    allowed.add(m[1]!);
  }
}
