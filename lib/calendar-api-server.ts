import "server-only";

import { applyGroupASessionsToMeta } from "@/lib/group-a-sessions";
import {
  buildUpstreamCalendarUrl,
  lectureWeeksToDateMap,
  parseLectureWeeksResponse,
} from "@/lib/calendar-upstream";
import {
  CalendarApiError,
  normalizeDefaultSession,
  parseCalendarSessionResponse,
  parsePublicHolidayMetaResponse,
  parsePublicHolidaysResponse,
  parseTodayResponse,
  buildPublicHolidaySearchParams,
  type CalendarSessionResult,
  type FetchCalendarSessionParams,
  type FetchMetaOptions,
  type FetchPublicHolidaysOptions,
  type FetchTodayStatusParams,
  type MetaResponse,
  type ProgramOptionRow,
  type PublicHolidayMetaResponse,
  type PublicHolidaysResponse,
  type SessionOptionRow,
  type TodayResponse,
} from "@/lib/calendar-api";
import type { LectureWeeksResponse } from "@/lib/calendar-api";

export async function fetchUpstreamJson(
  apiPath: string,
  searchParams?: URLSearchParams
): Promise<unknown> {
  const url = buildUpstreamCalendarUrl(apiPath, searchParams);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text.slice(0, 200) || res.statusText);
  }
  return (await res.json()) as unknown;
}

const lectureWeeksInflight = new Map<string, Promise<LectureWeeksResponse>>();
const lectureWeeksCache = new Map<
  string,
  { data: LectureWeeksResponse; at: number }
>();
const LECTURE_WEEKS_TTL_MS = 5 * 60 * 1000;

/** Server-only upstream fetch for chat / RSC (never exposed to the browser). */
export async function fetchLectureWeeks(
  sessionId: string
): Promise<LectureWeeksResponse> {
  const now = Date.now();
  const cached = lectureWeeksCache.get(sessionId);
  if (cached && now - cached.at < LECTURE_WEEKS_TTL_MS) return cached.data;

  const existing = lectureWeeksInflight.get(sessionId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson(
        "v1/lecture-weeks",
        new URLSearchParams({ session: sessionId })
      );
      const result = parseLectureWeeksResponse(data);
      lectureWeeksCache.set(sessionId, { data: result, at: Date.now() });
      return result;
    } finally {
      lectureWeeksInflight.delete(sessionId);
    }
  })();

  lectureWeeksInflight.set(sessionId, promise);
  return promise;
}

const publicHolidaysInflight = new Map<string, Promise<PublicHolidaysResponse>>();
const publicHolidaysCache = new Map<
  string,
  { data: PublicHolidaysResponse; at: number }
>();
const PUBLIC_HOLIDAYS_TTL_MS = 5 * 60 * 1000;

/** Server-only upstream fetch for chat (never routed through the browser proxy). */
export async function fetchPublicHolidays(
  options?: FetchPublicHolidaysOptions
): Promise<PublicHolidaysResponse> {
  const q = buildPublicHolidaySearchParams(options);
  const cacheKey = q.toString();

  const now = Date.now();
  const cached = publicHolidaysCache.get(cacheKey);
  if (cached && now - cached.at < PUBLIC_HOLIDAYS_TTL_MS) return cached.data;

  const existing = publicHolidaysInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson("v1/public-holiday", q);
      const result = parsePublicHolidaysResponse(data);
      publicHolidaysCache.set(cacheKey, { data: result, at: Date.now() });
      return result;
    } finally {
      publicHolidaysInflight.delete(cacheKey);
    }
  })();

  publicHolidaysInflight.set(cacheKey, promise);
  return promise;
}

const publicHolidayMetaInflight = new Map<string, Promise<PublicHolidayMetaResponse>>();
const publicHolidayMetaCache = new Map<
  string,
  { data: PublicHolidayMetaResponse; at: number }
>();
const PUBLIC_HOLIDAY_META_TTL_MS = 5 * 60 * 1000;

export async function fetchPublicHolidayMeta(): Promise<PublicHolidayMetaResponse> {
  const cacheKey = "default";
  const now = Date.now();
  const cached = publicHolidayMetaCache.get(cacheKey);
  if (cached && now - cached.at < PUBLIC_HOLIDAY_META_TTL_MS) return cached.data;

  const existing = publicHolidayMetaInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson("v1/public-holiday/meta");
      const result = parsePublicHolidayMetaResponse(data);
      publicHolidayMetaCache.set(cacheKey, { data: result, at: Date.now() });
      return result;
    } finally {
      publicHolidayMetaInflight.delete(cacheKey);
    }
  })();

  publicHolidayMetaInflight.set(cacheKey, promise);
  return promise;
}

const todayStatusInflight = new Map<string, Promise<TodayResponse>>();
const todayStatusCache = new Map<string, { data: TodayResponse; at: number }>();
const TODAY_STATUS_TTL_MS = 60 * 1000;

export async function fetchTodayStatus(
  params: FetchTodayStatusParams
): Promise<TodayResponse> {
  const q = new URLSearchParams({ group: params.group });
  if (params.date) q.set("date", params.date);
  if (params.session) q.set("session", params.session);
  if (params.program) q.set("program", params.program);
  const cacheKey = q.toString();

  const now = Date.now();
  const cached = todayStatusCache.get(cacheKey);
  if (cached && now - cached.at < TODAY_STATUS_TTL_MS) return cached.data;

  const existing = todayStatusInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson("v1/today", q);
      const result = parseTodayResponse(data);
      todayStatusCache.set(cacheKey, { data: result, at: Date.now() });
      return result;
    } finally {
      todayStatusInflight.delete(cacheKey);
    }
  })();

  todayStatusInflight.set(cacheKey, promise);
  return promise;
}

function asMetaPayload(data: unknown): MetaResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Calendar API meta: invalid JSON");
  }
  const o = data as Record<string, unknown>;
  const sessionOptions = Array.isArray(o.sessionOptions)
    ? (o.sessionOptions as SessionOptionRow[])
    : [];
  const programOptions = Array.isArray(o.programOptions)
    ? (o.programOptions as ProgramOptionRow[])
    : [];
  return applyGroupASessionsToMeta({
    defaultSession: normalizeDefaultSession(o.defaultSession),
    sessionOptions,
    programOptions,
  });
}

function metaCacheKey(options?: FetchMetaOptions): "default" | "entire" {
  return options?.entire ? "entire" : "default";
}

const metaInflight = new Map<"default" | "entire", Promise<MetaResponse>>();
const metaCache = new Map<
  "default" | "entire",
  { meta: MetaResponse; at: number }
>();
const META_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchMeta(options?: FetchMetaOptions): Promise<MetaResponse> {
  const key = metaCacheKey(options);
  const existing = metaInflight.get(key);
  if (existing) return existing;

  const search = options?.entire
    ? new URLSearchParams({ all: "true" })
    : undefined;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson("v1/meta", search);
      return asMetaPayload(data);
    } finally {
      metaInflight.delete(key);
    }
  })();

  metaInflight.set(key, promise);
  return promise;
}

export async function fetchMetaCached(
  options?: FetchMetaOptions
): Promise<MetaResponse> {
  const key = metaCacheKey(options);
  const now = Date.now();
  const hit = metaCache.get(key);
  if (hit && now - hit.at < META_CACHE_TTL_MS) return hit.meta;
  const meta = await fetchMeta(options);
  metaCache.set(key, { meta, at: now });
  return meta;
}

const calendarSessionInflight = new Map<string, Promise<CalendarSessionResult>>();
let sessionResultCache: Map<
  string,
  { result: CalendarSessionResult; at: number }
> | null = null;
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const SESSION_CACHE_MAX_KEYS = 48;

function getSessionFromCache(url: string): CalendarSessionResult | null {
  if (!sessionResultCache) return null;
  const hit = sessionResultCache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at >= SESSION_CACHE_TTL_MS) {
    sessionResultCache.delete(url);
    return null;
  }
  return hit.result;
}

function putSessionInCache(url: string, result: CalendarSessionResult): void {
  if (!sessionResultCache) sessionResultCache = new Map();
  if (
    sessionResultCache.size >= SESSION_CACHE_MAX_KEYS &&
    !sessionResultCache.has(url)
  ) {
    const first = sessionResultCache.keys().next().value as string | undefined;
    if (first) sessionResultCache.delete(first);
  }
  sessionResultCache.set(url, { result, at: Date.now() });
}

/** Upstream calendar + lecture weeks for RSC / chat (never routed through the browser). */
export async function fetchCalendarSession(
  params: FetchCalendarSessionParams
): Promise<CalendarSessionResult> {
  const q = new URLSearchParams();
  q.set("session", params.sessionId);
  q.set("group", params.group);
  if (params.group === "B" && params.program !== undefined && params.program !== "") {
    q.set("program", params.program);
  }
  const cacheKey = buildUpstreamCalendarUrl("v1/calendar", q);

  const cached = getSessionFromCache(cacheKey);
  if (cached) return cached;

  const existing = calendarSessionInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const [calendarData, lectureWeekData] = await Promise.all([
        fetchUpstreamJson("v1/calendar", q),
        fetchUpstreamJson(
          "v1/lecture-weeks",
          new URLSearchParams({ session: params.sessionId })
        ).catch(() => null),
      ]);

      const result = parseCalendarSessionResponse(calendarData);
      if (lectureWeekData) {
        const weekMap = lectureWeeksToDateMap(
          parseLectureWeeksResponse(lectureWeekData).weeks
        );
        if (Object.keys(weekMap).length > 0) {
          result.lectureWeekByDate = weekMap;
        }
      }

      putSessionInCache(cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new CalendarApiError(500, error.message);
      }
      throw error;
    } finally {
      calendarSessionInflight.delete(cacheKey);
    }
  })();

  calendarSessionInflight.set(cacheKey, promise);
  return promise;
}
