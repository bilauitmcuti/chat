import { buildDateToWeekNumberMap } from "@/lib/lecture-weeks-resolve";
import type { LectureWeek, LectureWeeksResponse } from "@/lib/calendar-api";

const DEFAULT_BASE = "https://api.bilauitmcuti.com";

/** Strip trailing slash and accidental `/api` so we always append `/api/v1/...` once. */
export function normalizeCalendarApiOrigin(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (u.endsWith("/api")) u = u.slice(0, -4);
  return u;
}

/** Upstream origin for server-side fetches (Edge chat, RSC, proxy). */
export function getCalendarApiBase(): string {
  const raw = process.env.CALENDAR_API_BASE?.trim() || DEFAULT_BASE;
  return normalizeCalendarApiOrigin(raw);
}

export function buildUpstreamCalendarUrl(
  apiPath: string,
  searchParams?: URLSearchParams
): string {
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  return `${getCalendarApiBase()}/api/${apiPath}${search}`;
}

export function parseLectureWeeksResponse(data: unknown): LectureWeeksResponse {
  if (!data || typeof data !== "object") return { weeks: [] };
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.weeks)) return { weeks: [] };
  const weeks: LectureWeek[] = o.weeks.map((w) => {
    const week = w as Record<string, unknown>;
    const days = Array.isArray(week.days)
      ? week.days.map((d: unknown) => {
          const day = d as Record<string, unknown>;
          return {
            date: String(day.date ?? ""),
            weekday: String(day.weekday ?? ""),
            label: String(day.label ?? ""),
          };
        })
      : [];
    return {
      weekNumber: Number(week.weekNumber ?? 0),
      weekStart: String(week.weekStart ?? ""),
      weekEnd: String(week.weekEnd ?? ""),
      rangeLabel: String(week.rangeLabel ?? ""),
      days,
    };
  });
  return { weeks };
}

export function lectureWeeksToDateMap(
  weeks: LectureWeek[]
): Record<string, number> {
  const map = buildDateToWeekNumberMap(weeks);
  const record: Record<string, number> = {};
  map.forEach((weekNum, date) => {
    record[date] = weekNum;
  });
  return record;
}
